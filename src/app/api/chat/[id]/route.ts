import { sql } from "@/lib/db";
import { apiJson, assertSameOrigin, handleApiError, notFound, requireApiUser } from "@/lib/api";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Params) {
  try {
    const user = await requireApiUser();
    const { id } = await params;
    const session = await sql<{ id: string; title: string; updated_at: string }>(
      `SELECT id, title, updated_at::text AS updated_at FROM chat_sessions
        WHERE id = $1 AND user_id = $2`,
      [id, user.id],
    );
    if (!session[0]) throw notFound("That conversation does not exist.");

    const messages = await sql<{
      id: string;
      role: string;
      content: string;
      citations: unknown;
      answer_mode: string | null;
      created_at: string;
    }>(
      `SELECT id, role, content, citations, answer_mode, created_at::text AS created_at
         FROM chat_messages WHERE session_id = $1 AND user_id = $2 ORDER BY created_at ASC`,
      [id, user.id],
    );
    return apiJson({ session: session[0], messages });
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
      `DELETE FROM chat_sessions WHERE id = $1 AND user_id = $2 RETURNING id`,
      [id, user.id],
    );
    if (!deleted[0]) throw notFound("That conversation does not exist.");
    return apiJson({ ok: true });
  } catch (error) {
    return handleApiError(error);
  }
}
