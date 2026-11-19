# Database

## Requirements

- PostgreSQL 15 or newer
- `pgvector` 0.5+ (HNSW index support)
- Extensions: `vector` (created by the migration)

Tested locally on PostgreSQL 17 with pgvector 0.8.7, and in CI with
`pgvector/pgvector:pg16`.

## Applying migrations

```bash
npm run db:migrate
```

`scripts/migrate.ts` reads `.env.local`, then the environment, then:

1. creates `schema_migrations` if missing;
2. takes the advisory lock `918273645`;
3. applies each `db/migrations/*.sql` exactly once inside a transaction;
4. records the filename.

Never edit an applied migration in a deployed environment — add `002_*.sql`.
The migration itself uses `IF NOT EXISTS`, so a fresh database and a partially
provisioned one both converge.

## Tables

| Table | Purpose | Ownership |
|---|---|---|
| `users` | Account, scrypt hash, display name | — |
| `sessions` | SHA-256 hash of the cookie token, expiry, user agent | `user_id` |
| `password_reset_tokens` | Single-use reset tokens (hashed), expiry | `user_id` |
| `documents` | Metadata, original bytes (`bytea`), checksum, status, preview | `user_id` |
| `document_chunks` | Extracted passage, page range, section, `tsvector`, `vector(1536)` | `user_id` |
| `collections` | Named groups | `user_id` |
| `document_collections` | Many-to-many membership | `user_id` |
| `tags` | Normalised tag names | `user_id` |
| `document_tags` | Many-to-many tagging | `user_id` |
| `chat_sessions` | Conversation title and recency | `user_id` |
| `chat_messages` | Role, content, citations JSONB, answer mode | `user_id` |
| `search_history` | Last 100 queries per account | `user_id` |

### Constraints worth knowing

- `documents (user_id, checksum)` is unique — the same bytes cannot be uploaded
  twice by one account, but two accounts may hold the same file.
- `document_chunks (document_id, chunk_index)` is unique; reprocessing deletes
  and reinserts.
- `collections (user_id, lower(name))` and `tags (user_id, lower(name))` are
  unique — case-insensitive names per account.
- Every user-owned foreign key uses `ON DELETE CASCADE`, so deleting an account
  or a document removes all derived rows. `document_chunks` has no separate
  cleanup path.

### Indexes

- `documents (user_id, created_at DESC)`, `(user_id, status)`, `(user_id, file_type)`
- `document_chunks (user_id)`, `(document_id)`
- GIN on `document_chunks.tsv`
- HNSW (`vector_cosine_ops`) on `document_chunks.embedding`

### Vector dimension

The column is `vector(1536)`. If you change `EMBEDDING_DIM`, add a migration
that alters the column and rebuilds the HNSW index, and re-index documents.
Provider embeddings whose dimension does not match are rejected with an explicit
error rather than silently stored.

## Row level security

`001_init.sql` enables RLS on every user-owned table and creates an `*_owner`
policy keyed on:

```sql
nullif(current_setting('app.user_id', true), '')::uuid
```

The application connects as the table owner in the default setup, and owners
bypass RLS — the primary isolation control is the explicit `user_id` filter in
every query. To use RLS as an enforced second layer:

1. create a non-owner role (`CREATE ROLE recallai_app LOGIN PASSWORD '…'`);
2. grant `SELECT, INSERT, UPDATE, DELETE` on the tables and `USAGE` on sequences;
3. connect the app as that role;
4. wrap request-scoped queries in a transaction and run
   `SET LOCAL app.user_id = '<uuid>'` first.

Integration test `tests/search-isolation.test.ts` verifies the explicit-filter
layer: a second account cannot retrieve another account's chunks or document.

## Vector search query shape

```sql
SELECT c.id, 1 - (c.embedding <=> $2::vector) AS similarity
  FROM document_chunks c
  JOIN documents d ON d.id = c.document_id
 WHERE c.user_id = $1
   AND c.embedding IS NOT NULL
   AND d.embedding_model = $3
 ORDER BY c.embedding <=> $2::vector
 LIMIT 60;
```

`embedding_model` prevents a mixed index after switching providers.

## Backup and restore

- Managed Postgres: use the provider's point-in-time recovery.
- Local: `pg_dump -Fc recallai > recallai.dump` and
  `pg_restore -d recallai recallai.dump`.
- Restoring into a fresh database requires the `vector` extension to be
  available before the dump is restored.
