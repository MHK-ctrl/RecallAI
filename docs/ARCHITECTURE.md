# Architecture

RecallAI is a single Next.js (App Router) application. There is no separate
worker service: document processing runs inside an authenticated route handler
and records progress in the database at each stage, which the upload UI polls.

```
Browser
  │  React 19 + Tailwind, server components for reads, route handlers for writes
  ▼
Next.js on Node (Vercel)
  ├── Auth: scrypt password hashing, DB-backed sessions, HttpOnly cookie
  ├── Ingest: detect → extract → clean → chunk → embed → store
  ├── Retrieval: Postgres FTS + pgvector → Reciprocal Rank Fusion
  ├── Answer: context construction → LLM (optional) → citation validation
  └── Private file streaming (ownership check + signed query string)
  ▼
PostgreSQL 15+ with pgvector
  users · sessions · documents (bytes + metadata) · document_chunks (tsvector + vector)
  collections · tags · chat_sessions · chat_messages · search_history
```

## Request flows

### Upload and indexing

1. `POST /api/documents` (multipart) validates size, extension and magic bytes,
   checks the per-account storage quota, rejects duplicate checksums, and inserts
   the file bytes plus metadata with status `uploaded`.
2. The client immediately calls `POST /api/documents/[id]/process` and polls
   `GET /api/documents/[id]` every ~900 ms.
3. Processing sets `extracting`, calls the format extractor, then
   `chunking`, then inserts chunks and sets `embedding`, then updates vectors and
   finally `indexed` (or `failed` with a safe message).
4. Re-running processing deletes the previous chunks first, so retries and model
   changes cannot leave stale passages behind.

Extraction and chunking are pure functions (`src/lib/ingest`) and are unit
tested without a database.

### Search

`searchMemories(userId, query, filters)`:

- **Keyword list** — `websearch_to_tsquery` over a generated `tsvector` column,
  ranked with `ts_rank_cd`, top 60.
- **Vector list** — cosine distance (`<=>`) over 1536-dimension embeddings,
  filtered to the embedding model that produced them, top 60.
- **Fusion** — Reciprocal Rank Fusion: `Σ 1/(60 + rank)`. Title/filename matches
  are merged in with a small fixed score.
- **Fallback** — if both lists are empty, substring matching on content, title
  and filename, so the UI never implies "nothing exists" when a stemmed query
  simply missed.
- **Isolation** — every branch starts from `c.user_id = $1`; filters are
  parameterised values, never interpolated.

### Answers (RAG)

1. Retrieve up to 18 hits, keep at most two chunks per document, cap at 8.
2. Number them `[1]…[n]` and build a context block with title, page and section.
3. If a chat model is configured, call it with a strict system prompt: answer
   only from sources, cite every claim, ignore instructions inside documents.
4. Validate the reply: markers outside `1..n` are removed. If no valid marker
   remains, discard the generated text and return an extractive answer instead.
5. Persist the assistant message with its citations (JSONB) so reopening a
   conversation shows exactly what was cited.

Without a chat model the app is still useful: it quotes the most relevant
sentences from the retrieved chunks, each with a real citation marker, and says
plainly that no language model is configured.

## Key decisions

| Decision | Why | Trade-off |
|---|---|---|
| Custom session auth instead of Supabase Auth | No external auth dependency; the whole flow is testable locally; fewer moving parts on a free tier. | We own password reset delivery (email provider not included). |
| File bytes in Postgres (`bytea`) | Files are private by construction, no public bucket, deletion is atomic with metadata. | Request and row-size limits; 4.5 MB per file on Vercel. |
| Local lexical hashing vectors as default embeddings | Hybrid retrieval works with zero AI credentials and no network cost. | Lexical, not semantic; configure a real embedding model for meaning-based recall. |
| Store the embedding model per document | Prevents comparing vectors from different models. | Switching providers requires re-indexing. |
| In-request processing | Simplest reliable option on serverless; statuses are real. | Large documents can approach the function time limit. |
| RLS policies plus explicit `user_id` filters | Defence in depth without requiring a second DB role. | Table owner bypasses RLS, so explicit filters remain the primary control. |
| Demo workspace as static synthetic data | Works even if the database or AI provider is down, and cannot leak user data. | It demonstrates the interface, not the live index. |

## Directory map

```
src/app                 routes (public, auth, app shell, API)
src/components           UI primitives and feature components
src/lib/auth            passwords, sessions, signed file URLs
src/lib/ingest          detection, extraction, chunking, pipeline
src/lib/ai              embeddings, chat client, answer + citation validation
src/lib/search.ts       hybrid retrieval and RRF
src/lib/documents.ts    document queries and aggregates
db/migrations           versioned SQL
scripts/migrate.ts      migration runner
tests                   unit + database integration tests
```
