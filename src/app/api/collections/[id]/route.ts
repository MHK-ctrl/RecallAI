import { z } from "zod";
import { sql } from "@/lib/db";
import { ApiError, apiJson, assertSameOrigin, handleApiError, notFound, parseBody, requireApiUser } from "@/lib/api";

const patchSchema = z.object({
  name: z.string().trim().min(1, "Give the collection a name.").max(60).optional(),
  color: z.enum(["sage", "ink", "amber", "clay", "slate"]).optional(),
});

type Params = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: Params) {
  try {
    assertSameOrigin(request);
    const user = await requireApiUser();
    const { id } = await params;
    const body = await parseBody(request, patchSchema);
    try {
      const rows = await sql<{ id: string; name: string; color: string }>(
        `UPDATE collections
            SET name = COALESCE($3, name), color = COALESCE($4, color), updated_at = now()
          WHERE id = $1 AND user_id = $2
          RETURNING id, name, color`,
        [id, user.id, body.name ?? null, body.color ?? null],
      );
      if (!rows[0]) throw notFound("That collection does not exist.");
      return apiJson({ collection: rows[0] });
    } catch (error) {
      if (error instanceof ApiError) throw error;
      throw new ApiError(409, "A collection with that name already exists.", "duplicate");
    }
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
      `DELETE FROM collections WHERE id = $1 AND user_id = $2 RETURNING id`,
      [id, user.id],
    );
    if (!deleted[0]) throw notFound("That collection does not exist.");
    return apiJson({ ok: true });
  } catch (error) {
    return handleApiError(error);
  }
}
