/**
 * Local-only seed: one demo account with a small synthetic library, two
 * collections, tags, search history and two cited conversations.
 *
 * Usage: npm run db:seed
 * Never run this against a production database.
 */
import { createHash } from "node:crypto";
import { config } from "dotenv";

config({ path: ".env.local" });
config();

import { sql } from "../src/lib/db";
import { hashPassword } from "../src/lib/auth/password";
import { processDocument } from "../src/lib/ingest/pipeline";
import { retrieveForAnswer } from "../src/lib/search";
import { buildCitations, extractiveAnswer } from "../src/lib/ai/answer";

const EMAIL = "demo@recallai.app";
const PASSWORD = "RecallDemo123";

const DBMS = `# DBMS — Normalization Notes

## Why normalize

Normalization organises relational tables so that redundancy is reduced and update anomalies are avoided. Insertion, deletion and update anomalies all come from storing the same fact in more than one place.

## Functional dependencies

A functional dependency X → Y means that each value of X determines exactly one value of Y. The left-hand side is the determinant. A partial dependency exists when a non-key attribute depends on only part of a composite key.

## Normal forms

First normal form requires atomic values and no repeating groups. Second normal form removes partial dependencies on a composite key. Third normal form removes transitive dependencies, so every non-key attribute depends only on the candidate key.

## BCNF and denormalization

Boyce-Codd normal form strengthens 3NF: every determinant must be a candidate key. Teams sometimes denormalize deliberately for read performance, then document the trade-off. Normalization is a design discipline, not a law.
`;

const DISTRIBUTED = `# Distributed Systems — Lecture 7

## Two-phase locking

Two-phase locking has a growing phase where a transaction acquires locks and a shrinking phase where it releases them. Strict two-phase locking holds all locks until commit, which prevents cascading aborts and keeps schedules recoverable.

## Deadlock

Deadlock happens when two transactions each hold a lock the other needs. Detection builds a wait-for graph and aborts a victim. Prevention uses timestamps: wait-die lets older transactions wait, wound-wait aborts the younger requester.

## Isolation levels

Serializable is the strongest isolation level. Snapshot isolation avoids many anomalies but permits write skew. Read committed prevents dirty reads but not non-repeatable reads.
`;

const ARCHITECTURE = `# RecallAI — Architecture Notes

## Ingestion pipeline

The pipeline validates file signatures, extracts text page by page, cleans whitespace, then splits content into overlapping passages of roughly 750 tokens with 120 tokens of overlap. Every passage keeps its document, owner, page range and section heading.

## Retrieval

Retrieval is hybrid. PostgreSQL full-text search produces a keyword ranking, pgvector cosine similarity produces a semantic ranking, and Reciprocal Rank Fusion merges the two lists. Every query is filtered by the authenticated user id.

## Answer generation

Before calling a language model, the system retrieves a small set of passages and numbers them. The model may only cite those numbers. A validator removes markers that do not exist, and an extractive fallback is used when no valid citation remains.
`;

const NETWORKS = `# Computer Networks — Revision Sheet

## TCP handshake

The three-way handshake exchanges SYN, SYN-ACK and ACK to agree on sequence numbers. Teardown uses FIN and ACK in both directions, with a TIME_WAIT state that absorbs delayed segments.

## Congestion control

TCP congestion control maintains a congestion window. Slow start doubles the window each round trip until the slow-start threshold, then congestion avoidance grows it linearly. Loss triggers fast retransmit and reduces the window.
`;

const READING_LIST = `title,author,topic
Designing Data-Intensive Applications,Martin Kleppmann,replication and consistency
Database System Concepts,Silberschatz,relational algebra and transactions
Introduction to Algorithms,Cormen,dynamic programming and graph search
`;

const DOCUMENTS = [
  { title: "DBMS — Normalization Notes", filename: "DBMS_Normalization_Notes.md", type: "md", text: DBMS, collection: "Semester 4" },
  { title: "Distributed Systems — Lecture 7", filename: "distributed-systems-lecture-7.md", type: "md", text: DISTRIBUTED, collection: "Semester 4" },
  { title: "RecallAI — Architecture Notes", filename: "recallai-architecture.md", type: "md", text: ARCHITECTURE, collection: "Projects" },
  { title: "Computer Networks — Revision Sheet", filename: "computer-networks-revision.md", type: "md", text: NETWORKS, collection: "Semester 4" },
  { title: "Reading List", filename: "reading-list.csv", type: "csv", text: READING_LIST, collection: "Projects" },
];

async function main() {
  console.log("Seeding local demo library…");
  await sql(`DELETE FROM users WHERE email = $1`, [EMAIL]);

  const hash = await hashPassword(PASSWORD);
  const [user] = await sql<{ id: string }>(
    `INSERT INTO users (email, name, password_hash) VALUES ($1, $2, $3) RETURNING id`,
    [EMAIL, "Hamza Khan", hash],
  );

  const collections = new Map<string, string>();
  for (const name of ["Semester 4", "Projects"]) {
    const [row] = await sql<{ id: string }>(
      `INSERT INTO collections (user_id, name, color) VALUES ($1, $2, $3) RETURNING id`,
      [user.id, name, name === "Projects" ? "amber" : "sage"],
    );
    collections.set(name, row.id);
  }

  const documentIds: string[] = [];
  for (const document of DOCUMENTS) {
    const bytes = Buffer.from(document.text, "utf8");
    const checksum = createHash("sha256").update(bytes).digest("hex");
    const [row] = await sql<{ id: string }>(
      `INSERT INTO documents
         (user_id, title, filename, file_type, mime_type, size_bytes, checksum, file_data, metadata)
       VALUES ($1, $2, $3, $4, 'text/plain', $5, $6, $7, '{}'::jsonb)
       RETURNING id`,
      [user.id, document.title, document.filename, document.type, bytes.length, checksum, bytes],
    );
    documentIds.push(row.id);

    const result = await processDocument(row.id, user.id);
    console.log(`  • ${document.title} — ${result.status}, ${result.chunks} passages`);

    const collectionId = collections.get(document.collection);
    if (collectionId) {
      await sql(
        `INSERT INTO document_collections (document_id, collection_id, user_id) VALUES ($1, $2, $3)`,
        [row.id, collectionId, user.id],
      );
    }
  }

  const tags: Array<[string, number]> = [
    ["dbms", 0],
    ["distributed-systems", 1],
    ["architecture", 2],
    ["networks", 3],
    ["reading", 4],
  ];
  for (const [name, index] of tags) {
    const [tag] = await sql<{ id: string }>(
      `INSERT INTO tags (user_id, name) VALUES ($1, $2) RETURNING id`,
      [user.id, name],
    );
    await sql(
      `INSERT INTO document_tags (document_id, tag_id, user_id) VALUES ($1, $2, $3)`,
      [documentIds[index], tag.id, user.id],
    );
  }

  for (const query of ["normalization", "two-phase locking", "congestion control"]) {
    const outcome = await retrieveForAnswer(user.id, query, 5);
    await sql(`INSERT INTO search_history (user_id, query, result_count) VALUES ($1, $2, $3)`, [
      user.id,
      query,
      outcome.hits.length,
    ]);
  }

  const conversations = [
    "What do my notes say about normalization?",
    "Where did I write about two-phase locking?",
  ];
  for (const question of conversations) {
    const [session] = await sql<{ id: string }>(
      `INSERT INTO chat_sessions (user_id, title) VALUES ($1, $2) RETURNING id`,
      [user.id, question.slice(0, 70)],
    );
    await sql(
      `INSERT INTO chat_messages (session_id, user_id, role, content) VALUES ($1, $2, 'user', $3)`,
      [session.id, user.id, question],
    );
    const outcome = await retrieveForAnswer(user.id, question, 6);
    const citations = buildCitations(outcome.hits);
    const answer = extractiveAnswer(question, citations);
    await sql(
      `INSERT INTO chat_messages (session_id, user_id, role, content, citations, answer_mode)
       VALUES ($1, $2, 'assistant', $3, $4::jsonb, 'extractive')`,
      [session.id, user.id, answer, JSON.stringify(citations)],
    );
  }

  console.log(`\nDemo account ready:\n  email:    ${EMAIL}\n  password: ${PASSWORD}`);
  console.log("Open http://localhost:3000/login and sign in.");
}

main()
  .then(async () => {
    const { getPool } = await import("../src/lib/db");
    await getPool().end();
  })
  .catch(async (error) => {
    console.error("Seed failed:", error);
    process.exit(1);
  });
