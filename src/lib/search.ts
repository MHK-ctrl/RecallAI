import { sql } from "@/lib/db";
import { embedTexts, toVectorLiteral } from "@/lib/ai/embed";
import { activeEmbeddingModel } from "@/lib/env";
import { highlightTerms } from "@/lib/utils";

export { highlightTerms };

export type SearchFilters = {
  fileTypes?: string[];
  collectionId?: string;
  tag?: string;
  documentId?: string;
  from?: string;
  to?: string;
};

export type ChunkHit = {
  chunkId: string;
  chunkIndex: number;
  documentId: string;
  title: string;
  filename: string;
  fileType: string;
  content: string;
  pageFrom: number | null;
  pageTo: number | null;
  section: string | null;
  createdAt: string;
  score: number;
  matchedTitle: boolean;
};

export type SearchOutcome = {
  hits: ChunkHit[];
  mode: "hybrid" | "keyword" | "fallback";
  vectorUsed: boolean;
};

function buildConditions(
  userId: string,
  filters: SearchFilters,
  params: unknown[],
): { where: string; nextIndex: () => number } {
  const conditions: string[] = ["c.user_id = $1"];
  params.push(userId);
  const add = (value: unknown) => {
    params.push(value);
    return `$${params.length}`;
  };

  if (filters.fileTypes && filters.fileTypes.length > 0) {
    conditions.push(`d.file_type = ANY(${add(filters.fileTypes)}::text[])`);
  }
  if (filters.collectionId) {
    conditions.push(
      `EXISTS (SELECT 1 FROM document_collections dc WHERE dc.document_id = d.id AND dc.collection_id = ${add(filters.collectionId)} AND dc.user_id = $1)`,
    );
  }
  if (filters.tag) {
    conditions.push(
      `EXISTS (SELECT 1 FROM document_tags dt JOIN tags t ON t.id = dt.tag_id WHERE dt.document_id = d.id AND dt.user_id = $1 AND lower(t.name) = lower(${add(filters.tag)}))`,
    );
  }
  if (filters.documentId) {
    conditions.push(`d.id = ${add(filters.documentId)}`);
  }
  if (filters.from) {
    conditions.push(`d.created_at >= ${add(filters.from)}::timestamptz`);
  }
  if (filters.to) {
    conditions.push(`d.created_at <= (${add(filters.to)}::timestamptz + interval '1 day')`);
  }

  return {
    where: conditions.join(" AND "),
    nextIndex: () => params.length + 1,
  };
}

function mapHit(row: Record<string, unknown>, matchedTitle = false): ChunkHit {
  return {
    chunkId: String(row.chunk_id),
    chunkIndex: Number(row.chunk_index ?? 0),
    documentId: String(row.document_id),
    title: String(row.title),
    filename: String(row.filename),
    fileType: String(row.file_type),
    content: String(row.content),
    pageFrom: row.page_from === null ? null : Number(row.page_from),
    pageTo: row.page_to === null ? null : Number(row.page_to),
    section: row.section ? String(row.section) : null,
    createdAt: String(row.created_at),
    score: Number(row.score ?? 0),
    matchedTitle,
  };
}

/**
 * Hybrid retrieval: Postgres full-text search + pgvector cosine similarity,
 * fused with Reciprocal Rank Fusion. Falls back to substring matching so a
 * query never silently returns nothing just because stemming missed.
 */
export async function searchMemories(
  userId: string,
  query: string,
  filters: SearchFilters = {},
  limit = 12,
): Promise<SearchOutcome> {
  const trimmed = query.trim();
  if (trimmed.length === 0) return { hits: [], mode: "keyword", vectorUsed: false };

  const params: unknown[] = [];
  const { where } = buildConditions(userId, filters, params);
  const queryIndex = params.length + 1;
  params.push(trimmed);

  let vectorLiteral: string | null = null;
  if (trimmed.length > 1) {
    try {
      const [vector] = await embedTexts([trimmed]);
      if (vector) vectorLiteral = toVectorLiteral(vector);
    } catch (error) {
      console.warn("[search] query embedding failed, keyword only:", (error as Error).message);
    }
  }

  let vectorIndex = 0;
  let modelIndex = 0;
  if (vectorLiteral) {
    params.push(vectorLiteral);
    vectorIndex = params.length;
    params.push(activeEmbeddingModel());
    modelIndex = params.length;
  }
  params.push(limit);
  const limitIndex = params.length;

  const keywordSql = `
    SELECT c.id,
           row_number() OVER (
             ORDER BY ts_rank_cd(c.tsv, websearch_to_tsquery('english', $${queryIndex})) DESC
           ) AS rank
      FROM document_chunks c
      JOIN documents d ON d.id = c.document_id
     WHERE ${where}
       AND c.tsv @@ websearch_to_tsquery('english', $${queryIndex})
     ORDER BY ts_rank_cd(c.tsv, websearch_to_tsquery('english', $${queryIndex})) DESC
     LIMIT 60`;

  const vectorSql = vectorLiteral
    ? `, vec AS (
        SELECT c.id,
               1 - (c.embedding <=> $${vectorIndex}::vector) AS sim,
               row_number() OVER (ORDER BY c.embedding <=> $${vectorIndex}::vector) AS rank
          FROM document_chunks c
          JOIN documents d ON d.id = c.document_id
         WHERE ${where}
           AND c.embedding IS NOT NULL
           AND d.embedding_model = $${modelIndex}
         ORDER BY c.embedding <=> $${vectorIndex}::vector
         LIMIT 60
      )`
    : "";

  const idsSql = vectorLiteral
    ? `SELECT id FROM kw UNION SELECT id FROM vec`
    : `SELECT id FROM kw`;

  const fusedSql = `
    WITH kw AS (${keywordSql})${vectorSql}, ids AS (${idsSql})
    SELECT c.id AS chunk_id, c.chunk_index, c.document_id, c.content,
           c.page_from, c.page_to, c.section,
           d.title, d.filename, d.file_type, d.created_at::text AS created_at,
           COALESCE(1.0 / (60 + kw.rank), 0)
             + COALESCE(1.0 / (60 + vec.rank), 0) AS score
      FROM ids
      JOIN document_chunks c ON c.id = ids.id
      JOIN documents d ON d.id = c.document_id
      LEFT JOIN kw ON kw.id = c.id
      ${vectorLiteral ? "LEFT JOIN vec ON vec.id = c.id" : ""}
     WHERE c.user_id = $1
     ORDER BY score DESC
     LIMIT $${limitIndex}`;

  const rows = await sql<Record<string, unknown>>(fusedSql, params);
  const hits = rows.map((row) => mapHit(row));

  // Filename/title matches are useful even when the body text does not contain
  // the words (for example searching "semester 4 notes").
  const titleRows = await sql<Record<string, unknown>>(
    `SELECT DISTINCT ON (d.id)
            c.id AS chunk_id, c.chunk_index, c.document_id, c.content,
            c.page_from, c.page_to, c.section,
            d.title, d.filename, d.file_type, d.created_at::text AS created_at
       FROM documents d
       JOIN document_chunks c ON c.document_id = d.id AND c.user_id = d.user_id
      WHERE d.user_id = $1
        AND (d.title ILIKE $2 OR d.filename ILIKE $2)
      ORDER BY d.id, c.chunk_index
      LIMIT 5`,
    [userId, `%${trimmed}%`],
  );

  const seen = new Set(hits.map((hit) => hit.chunkId));
  for (const row of titleRows) {
    if (seen.has(String(row.chunk_id))) continue;
    const hit = mapHit(row, true);
    hit.score = 0.014;
    hits.push(hit);
    seen.add(hit.chunkId);
  }
  hits.sort((a, b) => b.score - a.score);

  if (hits.length > 0) {
    return {
      hits: hits.slice(0, limit),
      mode: vectorLiteral ? "hybrid" : "keyword",
      vectorUsed: Boolean(vectorLiteral),
    };
  }

  // Fallback: substring matching on content, title and filename.
  const terms = highlightTerms(trimmed);
  if (terms.length === 0) return { hits: [], mode: "keyword", vectorUsed: false };
  const patterns = terms.map((term) => `%${term}%`);
  const fallbackRows = await sql<Record<string, unknown>>(
    `SELECT c.id AS chunk_id, c.chunk_index, c.document_id, c.content,
            c.page_from, c.page_to, c.section,
            d.title, d.filename, d.file_type, d.created_at::text AS created_at,
            0.01 + 0.002 * (
              SELECT count(*) FROM unnest($3::text[]) AS term
               WHERE c.content ILIKE term OR d.title ILIKE term
            ) AS score
       FROM document_chunks c
       JOIN documents d ON d.id = c.document_id
      WHERE c.user_id = $1
        AND ($3::text[] IS NOT NULL)
        AND (
          EXISTS (SELECT 1 FROM unnest($3::text[]) AS term WHERE c.content ILIKE term)
          OR EXISTS (SELECT 1 FROM unnest($3::text[]) AS term WHERE d.title ILIKE term OR d.filename ILIKE term)
        )
      ORDER BY score DESC, d.created_at DESC
      LIMIT $2`,
    [userId, limit, patterns],
  );

  return {
    hits: fallbackRows.map((row) => mapHit(row)),
    mode: "fallback",
    vectorUsed: false,
  };
}

export async function recordSearch(userId: string, query: string, resultCount: number) {
  const trimmed = query.trim().slice(0, 500);
  if (!trimmed) return;
  await sql(`INSERT INTO search_history (user_id, query, result_count) VALUES ($1, $2, $3)`, [
    userId,
    trimmed,
    resultCount,
  ]);
  await sql(
    `DELETE FROM search_history
      WHERE user_id = $1
        AND id NOT IN (SELECT id FROM search_history WHERE user_id = $1 ORDER BY created_at DESC LIMIT 100)`,
    [userId],
  );
}

/**
 * Retrieves context for RAG: at most two chunks per document so answers draw
 * from several sources instead of one long file.
 */
export async function retrieveForAnswer(
  userId: string,
  question: string,
  limit = 8,
): Promise<SearchOutcome> {
  const outcome = await searchMemories(userId, question, {}, Math.max(limit * 3, 18));
  const perDocument = new Map<string, number>();
  const hits = outcome.hits.filter((hit) => {
    const count = perDocument.get(hit.documentId) ?? 0;
    if (count >= 2) return false;
    perDocument.set(hit.documentId, count + 1);
    return true;
  });
  return { ...outcome, hits: hits.slice(0, limit) };
}
