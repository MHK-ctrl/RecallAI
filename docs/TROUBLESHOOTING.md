# Troubleshooting

## `extension "vector" is not available`

pgvector is not installed for the Postgres server that is running.

- Homebrew: install `pgvector` for the same major version as your server, or use
  a Postgres build that bundles it.
- Docker: use `pgvector/pgvector:pg16`.
- Hosted: enable the `vector` extension in the provider dashboard.

Confirm with:

```sql
SELECT extversion FROM pg_extension WHERE extname = 'vector';
```

## `type "vector" does not exist` during migration

`CREATE EXTENSION vector` failed earlier in the migration output. Fix that error
first; the rest of the schema depends on the type.

## Embedding dimension mismatch

```
Embedding dimension mismatch: provider returned 3072, schema expects 1536
```

The database column is fixed at 1536. Either choose a 1536-dimension model
(`text-embedding-3-small`) or add a migration that alters
`document_chunks.embedding` and rebuilds the HNSW index, then set
`EMBEDDING_DIM` to match and re-index.

## Upload returns 413

- File larger than `MAX_UPLOAD_MB` (8 by default locally, set 4 on Vercel).
- Account quota exceeded (`USER_STORAGE_QUOTA_MB`).
- On Vercel, the platform rejects request bodies over 4.5 MB before the route
  runs, with a generic 413. Keep the limit below that.

## Upload returns 415

The extension is not in the allow-list, or the file signature does not match the
extension (for example a `.pdf` that is really a zip). Upload a genuine file.

## "already in your library"

The SHA-256 checksum matches an existing document for that account. Open the
existing document instead; delete it first if you want to re-import.

## Document stuck in `uploaded`

The client never called `/api/documents/[id]/process`, usually because the tab was
closed. Open the document and use the actions menu → **Re-index document**.

## Status `failed`

The error message is shown on the document page. Common causes:

- A scanned PDF with no text layer — export pages as images and upload those.
- A CSV that is not UTF-8.
- A DOCX that is not a valid zip archive.
- The embedding provider rejected the request (rate limit, wrong key, wrong
  dimension).

Retry from the actions menu after fixing the cause.

## OCR does nothing or takes long

OCR is disabled (`OCR_ENABLED=false`), tesseract could not download its language
data (serverless cold start / restricted network), or the image has no text. The
document is still stored; add a description or tag so it can be found by title.

## Search returns nothing for an obvious phrase

1. Confirm the document is `indexed` and has passages.
2. Try fewer words — FTS stems English, the substring fallback needs 3+ letters.
3. Check active filters (type, collection, tag, dates).
4. If you recently switched embedding providers, re-index the document: vectors
   from different models are intentionally not mixed.

## Ask answers only quote passages

No chat model is configured. Set `LLM_API_KEY` and `LLM_MODEL`, then redeploy.
The Settings page shows the current mode. This is expected fallback behaviour,
not a bug.

## Ask says it could not find the answer

No passage above the retrieval threshold was returned for that question. This is
an honest no-evidence response; it will not answer from outside your library.
Upload the source, or rephrase using words that appear in it.

## Session keeps expiring / sign-in loops on a custom domain

Set `APP_URL` to the canonical HTTPS domain and make sure cookies are not blocked.
The session cookie is `Secure` in production, so plain HTTP on a custom host will
not persist it.

## `npm run build` fails with a database connection error

Pages are dynamic, but the build still typechecks and may prerender `/demo`. A
missing `DATABASE_URL` should not fail the build — if it does, check the stack
trace: a page was made static while calling the database. Keep authenticated
pages under the `(app)` group.

## Tests fail to connect

The integration tests use `TEST_DATABASE_URL`, defaulting to
`postgres://postgres@127.0.0.1:5433/recallai_test`. Start Postgres, create the
database, enable `vector`, and run migrations against it:

```bash
DATABASE_URL=postgres://postgres@127.0.0.1:5433/recallai_test npx tsx scripts/migrate.ts
npm test
```
