import { z } from "zod";
import { sql } from "@/lib/db";
import { apiJson, assertSameOrigin, handleApiError, notFound, parseBody, requireApiUser } from "@/lib/api";
import { answerFromMemories, buildCitations, citationsForStorage } from "@/lib/ai/answer";
import { retrieveForAnswer } from "@/lib/search";
import { clientKey, rateLimit } from "@/lib/rate-limit";

export const maxDuration = 60;

const schema = z.object({
  question: z.string().trim().min(3, "Ask a longer question.").max(1000),
  sessionId: z.string().uuid().optional(),
});

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const user = await requireApiUser();
    rateLimit(clientKey(request, `ask:${user.id}`), 20, 60_000);
    const body = await parseBody(request, schema);

    let sessionId = body.sessionId;
    if (sessionId) {
      const owned = await sql<{ id: string }>(
        `SELECT id FROM chat_sessions WHERE id = $1 AND user_id = $2`,
        [sessionId, user.id],
      );
      if (!owned[0]) throw notFound("That conversation does not exist.");
    } else {
      const created = await sql<{ id: string }>(
        `INSERT INTO chat_sessions (user_id, title) VALUES ($1, $2) RETURNING id`,
        [user.id, body.question.slice(0, 70)],
      );
      sessionId = created[0].id;
    }

    const history = await sql<{ role: "user" | "assistant"; content: string }>(
      `SELECT role, content FROM chat_messages
        WHERE session_id = $1 AND user_id = $2 AND role IN ('user','assistant')
        ORDER BY created_at DESC LIMIT 4`,
      [sessionId, user.id],
    );

    await sql(
      `INSERT INTO chat_messages (session_id, user_id, role, content) VALUES ($1, $2, 'user', $3)`,
      [sessionId, user.id, body.question],
    );

    const retrieval = await retrieveForAnswer(user.id, body.question, 8);
    const citations = buildCitations(retrieval.hits);
    const result = await answerFromMemories({
      question: body.question,
      citations,
      history: history.reverse(),
    });

    const messageRows = await sql<{ id: string; created_at: string }>(
      `INSERT INTO chat_messages (session_id, user_id, role, content, citations, answer_mode)
       VALUES ($1, $2, 'assistant', $3, $4::jsonb, $5)
       RETURNING id, created_at::text AS created_at`,
      [
        sessionId,
        user.id,
        result.answer,
        JSON.stringify(citationsForStorage(result.citations)),
        result.mode,
      ],
    );

    await sql(`UPDATE chat_sessions SET updated_at = now() WHERE id = $1 AND user_id = $2`, [
      sessionId,
      user.id,
    ]);

    return apiJson({
      sessionId,
      message: {
        id: messageRows[0].id,
        role: "assistant",
        content: result.answer,
        created_at: messageRows[0].created_at,
      },
      citations: result.citations,
      mode: result.mode,
      notices: result.notices,
      retrievalMode: retrieval.mode,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
