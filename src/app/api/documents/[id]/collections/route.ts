import { z } from "zod";
import { sql } from "@/lib/db";
import { ApiError, apiJson, assertSameOrigin, handleApiError, notFound, parseBody, requireApiUser } from "@/lib/api";

const schema = z.object({
  collectionId: z.string().uuid("Choose a collection."),
  action: z.enum(["add", "remove"]),
});

type Params = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: Params) {
  try {
    assertSameOrigin(request);
    const user = await requireApiUser();
    const { id } = await params;
    const body = await parseBody(request, schema);

    const owns = await sql<{ id: string }>(
      `SELECT id FROM documents WHERE id = $1 AND user_id = $2`,
      [id, user.id],
    );
    if (!owns[0]) throw notFound("That document does not exist.");

    const collection = await sql<{ id: string }>(
      `SELECT id FROM collections WHERE id = $1 AND user_id = $2`,
      [body.collectionId, user.id],
    );
    if (!collection[0]) throw new ApiError(404, "That collection does not exist.", "not_found");

    if (body.action === "add") {
      await sql(
        `INSERT INTO document_collections (document_id, collection_id, user_id)
         VALUES ($1, $2, $3) ON CONFLICT DO NOTHING`,
        [id, body.collectionId, user.id],
      );
    } else {
      await sql(
        `DELETE FROM document_collections
          WHERE document_id = $1 AND collection_id = $2 AND user_id = $3`,
        [id, body.collectionId, user.id],
      );
    }
    return apiJson({ ok: true });
  } catch (error) {
    return handleApiError(error);
  }
}
