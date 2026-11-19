import { createHash } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

/**
 * Integration tests against a real PostgreSQL database with pgvector.
 * Requires migrations to have been applied to TEST_DATABASE_URL.
 */
const testUrl =
  process.env.TEST_DATABASE_URL ??
  "postgres://postgres@127.0.0.1:5433/recallai_test";
process.env.DATABASE_URL = testUrl;
process.env.SESSION_SECRET = "integration-test-secret-value-0123456789";
process.env.EMBEDDING_DIM = "1536";

type SqlFn = typeof import("@/lib/db").sql;

let sql: SqlFn;
let processDocument: typeof import("@/lib/ingest/pipeline").processDocument;
let searchMemories: typeof import("@/lib/search").searchMemories;
let getDocument: typeof import("@/lib/documents").getDocument;

async function createUser(email: string): Promise<string> {
  const rows = await sql<{ id: string }>(
    `INSERT INTO users (email, name, password_hash) VALUES ($1, $2, 'test-hash') RETURNING id`,
    [email, email.split("@")[0]],
  );
  return rows[0].id;
}

async function createTextDocument(userId: string, title: string, text: string): Promise<string> {
  const bytes = Buffer.from(text, "utf8");
  const checksum = createHash("sha256").update(bytes).digest("hex");
  const rows = await sql<{ id: string }>(
    `INSERT INTO documents (user_id, title, filename, file_type, mime_type, size_bytes, checksum, file_data)
     VALUES ($1, $2, $3, 'txt', 'text/plain', $4, $5, $6)
     RETURNING id`,
    [userId, title, `${title}.txt`, bytes.length, checksum, bytes],
  );
  return rows[0].id;
}

beforeAll(async () => {
  ({ sql } = await import("@/lib/db"));
  ({ processDocument } = await import("@/lib/ingest/pipeline"));
  ({ searchMemories } = await import("@/lib/search"));
  ({ getDocument } = await import("@/lib/documents"));
  await sql("TRUNCATE users CASCADE");
});

afterAll(async () => {
  const { getPool } = await import("@/lib/db");
  await sql("TRUNCATE users CASCADE").catch(() => undefined);
  await getPool().end();
});

describe("document processing and isolation", () => {
  it("extracts, chunks and indexes a document with page context", async () => {
    const userId = await createUser("owner@example.com");
    const documentId = await createTextDocument(
      userId,
      "DBMS normal forms",
      "First normal form requires atomic values.\n\nSecond normal form removes partial dependencies.\n\nThird normal form removes transitive dependencies and reduces redundancy.",
    );

    const result = await processDocument(documentId, userId);
    expect(result.status).toBe("indexed");
    expect(result.chunks).toBeGreaterThan(0);

    const rows = await sql<{ status: string; chunk_count: number; embedding_model: string | null }>(
      `SELECT d.status,
              (SELECT count(*)::int FROM document_chunks c WHERE c.document_id = d.id) AS chunk_count,
              d.embedding_model
         FROM documents d WHERE d.id = $1`,
      [documentId],
    );
    expect(rows[0].status).toBe("indexed");
    expect(rows[0].chunk_count).toBeGreaterThan(0);
    expect(rows[0].embedding_model).toContain("local-hash");
  });

  it("never returns another account's passages", async () => {
    const owner = await createUser("owner2@example.com");
    const stranger = await createUser("stranger@example.com");
    const documentId = await createTextDocument(
      owner,
      "Two-phase locking",
      "Strict two-phase locking holds all locks until commit, which prevents cascading aborts.",
    );
    await processDocument(documentId, owner);

    const ownerResults = await searchMemories(owner, "two-phase locking", {}, 10);
    expect(ownerResults.hits.length).toBeGreaterThan(0);
    expect(ownerResults.hits[0].documentId).toBe(documentId);

    const strangerResults = await searchMemories(stranger, "two-phase locking", {}, 10);
    expect(strangerResults.hits).toHaveLength(0);

    expect(await getDocument(stranger, documentId)).toBeNull();
    expect(await getDocument(owner, documentId)).not.toBeNull();
  });

  it("cascades passages when a document is deleted", async () => {
    const userId = await createUser("cascade@example.com");
    const documentId = await createTextDocument(
      userId,
      "Ephemeral notes",
      "This passage should disappear together with its parent document.",
    );
    await processDocument(documentId, userId);

    await sql(`DELETE FROM documents WHERE id = $1 AND user_id = $2`, [documentId, userId]);
    const chunks = await sql<{ count: number }>(
      `SELECT count(*)::int AS count FROM document_chunks WHERE document_id = $1`,
      [documentId],
    );
    expect(chunks[0].count).toBe(0);
  });

  it("rejects a duplicate file per account but allows it for another account", async () => {
    const first = await createUser("dupe-a@example.com");
    const second = await createUser("dupe-b@example.com");
    const text = "Identical content for checksum testing.";
    await createTextDocument(first, "First copy", text);

    await expect(createTextDocument(first, "Second copy", text)).rejects.toThrow();
    await expect(createTextDocument(second, "Other account copy", text)).resolves.toBeTruthy();
  });

  it("reports no results rather than unrelated documents", async () => {
    const userId = await createUser("empty@example.com");
    const results = await searchMemories(userId, "quantum chromodynamics", {}, 10);
    expect(results.hits).toHaveLength(0);
  });
});
