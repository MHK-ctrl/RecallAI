import { sql } from "@/lib/db";
import { handleApiError, requireApiUser } from "@/lib/api";

export const maxDuration = 60;

/** GDPR-style export of everything the account owns, as a single JSON file. */
export async function GET() {
  try {
    const user = await requireApiUser();

    const [documents, chunks, collections, tags, chats, messages, searches, sessions] =
      await Promise.all([
        sql(`SELECT id, title, filename, file_type, mime_type, size_bytes::text, checksum, status,
                    page_count, word_count, preview_text, description, metadata,
                    created_at, indexed_at FROM documents WHERE user_id = $1 ORDER BY created_at`, [user.id]),
        sql(`SELECT document_id, chunk_index, content, page_from, page_to, section, token_count
               FROM document_chunks WHERE user_id = $1 ORDER BY document_id, chunk_index`, [user.id]),
        sql(`SELECT id, name, color, created_at FROM collections WHERE user_id = $1 ORDER BY name`, [user.id]),
        sql(`SELECT t.name, dt.document_id FROM tags t JOIN document_tags dt ON dt.tag_id = t.id
              WHERE t.user_id = $1 ORDER BY t.name`, [user.id]),
        sql(`SELECT id, title, created_at FROM chat_sessions WHERE user_id = $1 ORDER BY created_at`, [user.id]),
        sql(`SELECT session_id, role, content, citations, answer_mode, created_at
               FROM chat_messages WHERE user_id = $1 ORDER BY created_at`, [user.id]),
        sql(`SELECT query, result_count, created_at FROM search_history WHERE user_id = $1 ORDER BY created_at`, [user.id]),
        sql(`SELECT created_at, expires_at FROM sessions WHERE user_id = $1 ORDER BY created_at`, [user.id]),
      ]);

    const payload = {
      exportedAt: new Date().toISOString(),
      account: { id: user.id, name: user.name, email: user.email, createdAt: user.created_at },
      documents,
      documentChunks: chunks,
      collections,
      documentTags: tags,
      conversations: chats,
      messages,
      searchHistory: searches,
      sessions,
      notes:
        "Original file bytes are not included in this export. Download them individually from the document viewer.",
    };

    return new Response(JSON.stringify(payload, null, 2), {
      headers: {
        "Content-Type": "application/json",
        "Content-Disposition": `attachment; filename="recallai-export-${new Date().toISOString().slice(0, 10)}.json"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
