import { createHash } from "node:crypto";
import { z } from "zod";
import { sql } from "@/lib/db";
import {
  ApiError,
  apiJson,
  assertSameOrigin,
  handleApiError,
  requireApiUser,
} from "@/lib/api";
import { storageUsage } from "@/lib/documents";
import { env } from "@/lib/env";
import { detectKindFromBytes, extensionOf, kindForExtension, mimeForKind, sanitiseFilename, titleFromFilename } from "@/lib/ingest/detect";
import { clientKey, rateLimit } from "@/lib/rate-limit";

export const maxDuration = 30;

const metaSchema = z.object({
  title: z.string().trim().max(160).optional(),
  description: z.string().trim().max(1000).optional(),
});

export async function GET(request: Request) {
  try {
    const user = await requireApiUser();
    const url = new URL(request.url);
    const { listDocuments } = await import("@/lib/documents");
    const result = await listDocuments(user.id, {
      query: url.searchParams.get("query") ?? undefined,
      status: url.searchParams.get("status") ?? undefined,
      fileType: url.searchParams.get("type") ?? undefined,
      collectionId: url.searchParams.get("collection") ?? undefined,
      tag: url.searchParams.get("tag") ?? undefined,
      page: Number(url.searchParams.get("page") ?? "1") || 1,
      pageSize: Number(url.searchParams.get("pageSize") ?? "12") || 12,
      order: (url.searchParams.get("order") as "newest" | "oldest" | "title" | null) ?? "newest",
    });
    return apiJson(result);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const user = await requireApiUser();
    rateLimit(clientKey(request, `upload:${user.id}`), 20, 60_000);

    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      throw new ApiError(400, "Choose a file to upload.", "missing_file");
    }
    const meta = metaSchema.parse({
      title: form.get("title") || undefined,
      description: form.get("description") || undefined,
    });

    const maxBytes = env.maxUploadMb * 1024 * 1024;
    if (file.size === 0) throw new ApiError(400, "That file is empty.", "empty_file");
    if (file.size > maxBytes) {
      throw new ApiError(
        413,
        `Files must be ${env.maxUploadMb} MB or smaller on this deployment.`,
        "file_too_large",
      );
    }

    const filename = sanitiseFilename(file.name);
    const extension = extensionOf(filename);
    const kind = kindForExtension(extension);
    if (!kind) {
      throw new ApiError(
        415,
        "Supported formats: PDF, DOCX, TXT, MD, CSV, PNG, JPG, JPEG, WEBP.",
        "unsupported_type",
      );
    }

    const bytes = Buffer.from(await file.arrayBuffer());
    if (!detectKindFromBytes(bytes, extension)) {
      throw new ApiError(
        415,
        "The file contents do not match its extension. Please upload a genuine document.",
        "invalid_content",
      );
    }

    const usage = await storageUsage(user.id);
    if (usage.bytes + bytes.length > env.storageQuotaMb * 1024 * 1024) {
      throw new ApiError(
        413,
        `This would exceed your ${env.storageQuotaMb} MB storage allowance. Delete a document or raise USER_STORAGE_QUOTA_MB.`,
        "quota_exceeded",
      );
    }

    const checksum = createHash("sha256").update(bytes).digest("hex");
    const existing = await sql<{ id: string; title: string }>(
      `SELECT id, title FROM documents WHERE user_id = $1 AND checksum = $2 LIMIT 1`,
      [user.id, checksum],
    );
    if (existing[0]) {
      throw new ApiError(
        409,
        `“${existing[0].title}” is already in your library (identical file).`,
        "duplicate",
      );
    }

    const rows = await sql<{ id: string; status: string; title: string }>(
      `INSERT INTO documents
         (user_id, title, filename, file_type, mime_type, size_bytes, checksum, file_data, description, metadata)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb)
       RETURNING id, status, title`,
      [
        user.id,
        meta.title?.trim() || titleFromFilename(filename),
        filename,
        kind,
        mimeForKind(kind, file.type),
        bytes.length,
        checksum,
        bytes,
        meta.description?.trim() || null,
        JSON.stringify({ originalName: file.name, uploadedVia: "web" }),
      ],
    );

    return apiJson({ document: rows[0] }, 201);
  } catch (error) {
    return handleApiError(error);
  }
}
