import { z } from "zod";
import { sql } from "@/lib/db";
import {
  ApiError,
  apiJson,
  assertSameOrigin,
  handleApiError,
  notFound,
  parseBody,
  requireApiUser,
} from "@/lib/api";
import { getDocument } from "@/lib/documents";

const patchSchema = z.object({
  title: z.string().trim().min(1, "Title cannot be empty.").max(160).optional(),
  description: z.string().trim().max(1000).optional(),
  tags: z.array(z.string().trim().min(1).max(32)).max(12).optional(),
});

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Params) {
  try {
    const user = await requireApiUser();
    const { id } = await params;
    const document = await getDocument(user.id, id);
    if (!document) throw notFound("That document does not exist.");
    return apiJson({ document });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(request: Request, { params }: Params) {
  try {
    assertSameOrigin(request);
    const user = await requireApiUser();
    const { id } = await params;
    const body = await parseBody(request, patchSchema);

    const owned = await sql<{ id: string }>(
      `SELECT id FROM documents WHERE id = $1 AND user_id = $2`,
      [id, user.id],
    );
    if (!owned[0]) throw notFound("That document does not exist.");

    if (body.title !== undefined || body.description !== undefined) {
      await sql(
        `UPDATE documents
            SET title = COALESCE($3, title),
                description = COALESCE($4, description)
          WHERE id = $1 AND user_id = $2`,
        [id, user.id, body.title ?? null, body.description ?? null],
      );
    }

    if (body.tags) {
      const unique = Array.from(new Set(body.tags.map((tag) => tag.toLowerCase()))).slice(0, 12);
      await sql(`DELETE FROM document_tags WHERE document_id = $1 AND user_id = $2`, [id, user.id]);
      for (const tag of unique) {
        const tagRow = await sql<{ id: string }>(
          `INSERT INTO tags (user_id, name) VALUES ($1, $2)
           ON CONFLICT (user_id, lower(name)) DO UPDATE SET name = EXCLUDED.name
           RETURNING id`,
          [user.id, tag],
        );
        if (tagRow[0]) {
          await sql(
            `INSERT INTO document_tags (document_id, tag_id, user_id) VALUES ($1, $2, $3)
             ON CONFLICT DO NOTHING`,
            [id, tagRow[0].id, user.id],
          );
        }
      }
      await sql(
        `DELETE FROM tags t WHERE t.user_id = $1 AND NOT EXISTS (SELECT 1 FROM document_tags dt WHERE dt.tag_id = t.id)`,
        [user.id],
      );
    }

    const document = await getDocument(user.id, id);
    return apiJson({ document });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(request: Request, { params }: Params) {
  try {
    assertSameOrigin(request);
    const user = await requireApiUser();
    const { id } = await params;
    const deleted = await sql<{ id: string }>(
      `DELETE FROM documents WHERE id = $1 AND user_id = $2 RETURNING id`,
      [id, user.id],
    );
    if (!deleted[0]) throw new ApiError(404, "That document does not exist.", "not_found");
    return apiJson({ ok: true });
  } catch (error) {
    return handleApiError(error);
  }
}
