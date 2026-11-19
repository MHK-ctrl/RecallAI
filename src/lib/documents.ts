import { one, sql } from "@/lib/db";

export type DocumentSummary = {
  id: string;
  title: string;
  filename: string;
  file_type: string;
  status: string;
  size_bytes: string;
  page_count: number | null;
  word_count: number;
  created_at: string;
  indexed_at: string | null;
  preview_text: string | null;
  error_message: string | null;
  chunk_count: number;
  collections: Array<{ id: string; name: string; color: string }>;
  tags: string[];
};

const SUMMARY_SELECT = `
  SELECT d.id, d.title, d.filename, d.file_type, d.status, d.size_bytes,
         d.page_count, d.word_count, d.created_at::text AS created_at,
         d.indexed_at::text AS indexed_at, d.preview_text, d.error_message,
         d.description, d.metadata,
         COALESCE(ch.cnt, 0)::int AS chunk_count,
         COALESCE(cols.items, '[]'::json) AS collections,
         COALESCE(tg.items, '[]'::json) AS tags
    FROM documents d
    LEFT JOIN (
      SELECT document_id, count(*) AS cnt FROM document_chunks GROUP BY document_id
    ) ch ON ch.document_id = d.id
    LEFT JOIN (
      SELECT dc.document_id,
             json_agg(json_build_object('id', c.id, 'name', c.name, 'color', c.color) ORDER BY c.name) AS items
        FROM document_collections dc
        JOIN collections c ON c.id = dc.collection_id
       WHERE dc.user_id = $1
       GROUP BY dc.document_id
    ) cols ON cols.document_id = d.id
    LEFT JOIN (
      SELECT dt.document_id, json_agg(t.name ORDER BY t.name) AS items
        FROM document_tags dt
        JOIN tags t ON t.id = dt.tag_id
       WHERE dt.user_id = $1
       GROUP BY dt.document_id
    ) tg ON tg.document_id = d.id
`;

export type ListOptions = {
  query?: string;
  status?: string;
  fileType?: string;
  collectionId?: string;
  tag?: string;
  page?: number;
  pageSize?: number;
  order?: "newest" | "oldest" | "title";
};

function parseJsonArray<T>(value: unknown): T[] {
  if (Array.isArray(value)) return value as T[];
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? (parsed as T[]) : [];
    } catch {
      return [];
    }
  }
  return [];
}

function normaliseSummary(row: Record<string, unknown>): DocumentSummary {
  return {
    ...(row as unknown as DocumentSummary),
    chunk_count: Number(row.chunk_count ?? 0),
    word_count: Number(row.word_count ?? 0),
    collections: parseJsonArray(row.collections),
    tags: parseJsonArray(row.tags),
  };
}

export async function listDocuments(
  userId: string,
  options: ListOptions = {},
): Promise<{ items: DocumentSummary[]; total: number; page: number; pageSize: number }> {
  const page = Math.max(1, options.page ?? 1);
  const pageSize = Math.min(60, Math.max(5, options.pageSize ?? 12));
  const params: unknown[] = [userId];
  const conditions: string[] = ["d.user_id = $1"];

  if (options.query?.trim()) {
    params.push(`%${options.query.trim()}%`);
    conditions.push(`(d.title ILIKE $${params.length} OR d.filename ILIKE $${params.length})`);
  }
  if (options.status && options.status !== "all") {
    params.push(options.status);
    conditions.push(`d.status = $${params.length}`);
  }
  if (options.fileType && options.fileType !== "all") {
    params.push(options.fileType);
    conditions.push(`d.file_type = $${params.length}`);
  }
  if (options.collectionId) {
    params.push(options.collectionId);
    conditions.push(
      `EXISTS (SELECT 1 FROM document_collections dc WHERE dc.document_id = d.id AND dc.collection_id = $${params.length} AND dc.user_id = $1)`,
    );
  }
  if (options.tag) {
    params.push(options.tag);
    conditions.push(
      `EXISTS (SELECT 1 FROM document_tags dt JOIN tags t ON t.id = dt.tag_id WHERE dt.document_id = d.id AND dt.user_id = $1 AND lower(t.name) = lower($${params.length}))`,
    );
  }

  const where = conditions.join(" AND ");
  const order =
    options.order === "oldest"
      ? "d.created_at ASC"
      : options.order === "title"
        ? "d.title ASC"
        : "d.created_at DESC";

  const rows = await sql<Record<string, unknown>>(
    `${SUMMARY_SELECT} WHERE ${where} ORDER BY ${order} LIMIT ${pageSize} OFFSET ${(page - 1) * pageSize}`,
    params,
  );
  const totalRow = await one<{ count: string }>(
    `SELECT count(*)::text AS count FROM documents d WHERE ${where}`,
    params,
  );

  return {
    items: rows.map(normaliseSummary),
    total: Number(totalRow?.count ?? 0),
    page,
    pageSize,
  };
}

export async function getDocument(
  userId: string,
  id: string,
): Promise<(DocumentSummary & { description: string | null; metadata: Record<string, unknown> }) | null> {
  const rows = await sql<Record<string, unknown>>(
    `${SUMMARY_SELECT} WHERE d.id = $2 AND d.user_id = $1 LIMIT 1`,
    [userId, id],
  );
  if (!rows[0]) return null;
  return {
    ...normaliseSummary(rows[0]),
    description: (rows[0].description as string | null) ?? null,
    metadata: (rows[0].metadata as Record<string, unknown>) ?? {},
  };
}

export async function getDocumentChunks(userId: string, documentId: string) {
  return sql<{
    id: string;
    chunk_index: number;
    content: string;
    page_from: number | null;
    page_to: number | null;
    section: string | null;
    token_count: number;
  }>(
    `SELECT id, chunk_index, content, page_from, page_to, section, token_count
       FROM document_chunks
      WHERE document_id = $1 AND user_id = $2
      ORDER BY chunk_index ASC`,
    [documentId, userId],
  );
}

export async function storageUsage(userId: string) {
  const row = await one<{ bytes: string; documents: string }>(
    `SELECT COALESCE(sum(size_bytes), 0)::text AS bytes, count(*)::text AS documents
       FROM documents WHERE user_id = $1`,
    [userId],
  );
  return { bytes: Number(row?.bytes ?? 0), documents: Number(row?.documents ?? 0) };
}

export async function listCollectionsWithCounts(userId: string) {
  return sql<{ id: string; name: string; color: string; document_count: number; created_at: string }>(
    `SELECT c.id, c.name, c.color, c.created_at::text AS created_at,
            count(dc.document_id)::int AS document_count
       FROM collections c
       LEFT JOIN document_collections dc ON dc.collection_id = c.id AND dc.user_id = c.user_id
      WHERE c.user_id = $1
      GROUP BY c.id
      ORDER BY c.name ASC`,
    [userId],
  );
}

export async function listTags(userId: string) {
  return sql<{ id: string; name: string; usage_count: number }>(
    `SELECT t.id, t.name, count(dt.document_id)::int AS usage_count
       FROM tags t
       LEFT JOIN document_tags dt ON dt.tag_id = t.id AND dt.user_id = t.user_id
      WHERE t.user_id = $1
      GROUP BY t.id
      ORDER BY count(dt.document_id) DESC, t.name ASC
      LIMIT 100`,
    [userId],
  );
}
