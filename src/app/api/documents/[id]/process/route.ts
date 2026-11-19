import { apiJson, ApiError, assertSameOrigin, handleApiError, notFound, requireApiUser } from "@/lib/api";
import { sql } from "@/lib/db";
import { processDocument } from "@/lib/ingest/pipeline";
import { clientKey, rateLimit } from "@/lib/rate-limit";

export const maxDuration = 60;

type Params = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: Params) {
  try {
    assertSameOrigin(request);
    const user = await requireApiUser();
    const { id } = await params;
    rateLimit(clientKey(request, `process:${user.id}`), 30, 60_000);

    const rows = await sql<{ id: string }>(
      `SELECT id FROM documents WHERE id = $1 AND user_id = $2`,
      [id, user.id],
    );
    if (!rows[0]) throw notFound("That document does not exist.");

    const result = await processDocument(id, user.id);
    if (result.status === "failed") {
      throw new ApiError(422, result.error ?? "Processing failed.", "processing_failed");
    }
    return apiJson(result);
  } catch (error) {
    return handleApiError(error);
  }
}
