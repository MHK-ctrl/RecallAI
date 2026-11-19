import { requirePageUser } from "@/lib/api";
import { sql } from "@/lib/db";
import { isLlmConfigured } from "@/lib/env";
import { storageUsage } from "@/lib/documents";
import { PageHeader } from "@/components/ui";
import { AskView, type ChatMessage } from "@/components/ask-view";
import type { Citation } from "@/lib/ai/answer";

export const metadata = { title: "Ask your memories" };

export default async function AskPage({
  searchParams,
}: {
  searchParams: Promise<{ session?: string }>;
}) {
  const user = await requirePageUser("/ask");
  const { session } = await searchParams;

  const sessions = await sql<{
    id: string;
    title: string;
    message_count: number;
    updated_at: string;
  }>(
    `SELECT s.id, s.title, count(m.id)::int AS message_count, s.updated_at::text AS updated_at
       FROM chat_sessions s
       LEFT JOIN chat_messages m ON m.session_id = s.id
      WHERE s.user_id = $1
      GROUP BY s.id
      ORDER BY s.updated_at DESC
      LIMIT 30`,
    [user.id],
  );

  let activeSessionId: string | null = null;
  let initialMessages: ChatMessage[] = [];

  if (session) {
    const owned = await sql<{ id: string }>(
      `SELECT id FROM chat_sessions WHERE id = $1 AND user_id = $2 LIMIT 1`,
      [session, user.id],
    );
    if (owned[0]) {
      activeSessionId = session;
      const rows = await sql<{
        id: string;
        role: "user" | "assistant";
        content: string;
        citations: Citation[] | null;
        answer_mode: "llm" | "extractive" | null;
        created_at: string;
      }>(
        `SELECT id, role, content, citations, answer_mode, created_at::text AS created_at
           FROM chat_messages
          WHERE session_id = $1 AND user_id = $2 AND role IN ('user','assistant')
          ORDER BY created_at ASC`,
        [session, user.id],
      );
      initialMessages = rows.map((row) => ({
        id: row.id,
        role: row.role,
        content: row.content,
        citations: Array.isArray(row.citations) ? row.citations : [],
        answerMode: row.answer_mode,
        created_at: row.created_at,
      }));
    }
  }

  const usage = await storageUsage(user.id);

  return (
    <div>
      <PageHeader
        title="Ask your memories"
        description="A conversation grounded in your own documents — with a citation for every claim and an honest answer when the evidence is missing."
      />
      <AskView
        key={activeSessionId ?? "new-conversation"}
        sessions={sessions}
        activeSessionId={activeSessionId}
        initialMessages={initialMessages}
        aiConfigured={isLlmConfigured()}
        hasDocuments={usage.documents > 0}
      />
    </div>
  );
}
