import { z } from "zod";
import { PG_UNIQUE_VIOLATION, pgErrorCode, sql } from "@/lib/db";
import { ApiError, apiJson, assertSameOrigin, handleApiError, parseBody, requireApiUser } from "@/lib/api";
import { listCollectionsWithCounts } from "@/lib/documents";

const schema = z.object({
  name: z.string().trim().min(1, "Give the collection a name.").max(60),
  color: z.enum(["sage", "ink", "amber", "clay", "slate"]).optional(),
});

export async function GET() {
  try {
    const user = await requireApiUser();
    const collections = await listCollectionsWithCounts(user.id);
    return apiJson({ collections });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const user = await requireApiUser();
    const body = await parseBody(request, schema);
    try {
      const rows = await sql<{ id: string; name: string; color: string }>(
        `INSERT INTO collections (user_id, name, color) VALUES ($1, $2, $3)
         RETURNING id, name, color`,
        [user.id, body.name, body.color ?? "sage"],
      );
      return apiJson({ collection: rows[0] }, 201);
    } catch (error) {
      if (pgErrorCode(error) === PG_UNIQUE_VIOLATION) {
        throw new ApiError(409, "A collection with that name already exists.", "duplicate");
      }
      throw error;
    }
  } catch (error) {
    return handleApiError(error);
  }
}
