import { sql } from "@/lib/db";
import { apiError, handleApiError, notFound, requireApiUser } from "@/lib/api";
import { verifyFileParams } from "@/lib/auth/sign-url";

type Params = { params: Promise<{ id: string }> };

const INLINE_TYPES = new Set(["application/pdf", "image/png", "image/jpeg", "image/webp"]);

export async function GET(request: Request, { params }: Params) {
  try {
    const user = await requireApiUser();
    const { id } = await params;
    const url = new URL(request.url);

    const hasSignature = url.searchParams.has("sig") || url.searchParams.has("exp");
    if (hasSignature) {
      const valid = verifyFileParams(
        id,
        user.id,
        url.searchParams.get("exp"),
        url.searchParams.get("sig"),
      );
      if (!valid) return apiError(403, "This file link has expired.", "expired_link");
    }

    const rows = await sql<{
      filename: string;
      mime_type: string;
      file_data: Buffer;
      size_bytes: string;
    }>(
      `SELECT filename, mime_type, file_data, size_bytes::text AS size_bytes
         FROM documents WHERE id = $1 AND user_id = $2 LIMIT 1`,
      [id, user.id],
    );
    const row = rows[0];
    if (!row) throw notFound("That document does not exist.");

    const inline = INLINE_TYPES.has(row.mime_type);
    const body = new Uint8Array(row.file_data);
    return new Response(body, {
      headers: {
        "Content-Type": row.mime_type,
        "Content-Length": String(body.byteLength),
        "Content-Disposition": `${inline ? "inline" : "attachment"}; filename="${encodeURIComponent(row.filename)}"`,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
