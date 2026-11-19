# Contributing

Thanks for taking a look at RecallAI. This guide covers the local workflow.

## Setup

```bash
git clone https://github.com/MHK-ctrl/RecallAI.git
cd RecallAI
npm install
cp .env.example .env.local
```

You need a PostgreSQL database with the `pgvector` extension.

Fastest local option (Homebrew on macOS):

```bash
brew install postgresql@17 pgvector
initdb -D .localdb -U postgres --auth=trust
pg_ctl -D .localdb -l .localdb/server.log -o "-p 5433" start
createdb -h 127.0.0.1 -p 5433 -U postgres recallai
createdb -h 127.0.0.1 -p 5433 -U postgres recallai_test
psql -h 127.0.0.1 -p 5433 -U postgres -d recallai -c "CREATE EXTENSION vector;"
psql -h 127.0.0.1 -p 5433 -U postgres -d recallai_test -c "CREATE EXTENSION vector;"
```

Or use any Postgres 15+ instance that supports pgvector (Neon, Supabase, RDS,
or `docker run pgvector/pgvector:pg16`).

Set `DATABASE_URL` and a random `SESSION_SECRET` (32+ characters) in
`.env.local`, then:

```bash
npm run db:migrate
npm run dev
```

## Checks before opening a pull request

```bash
npm run typecheck
npm run lint
npm test
npm run build
```

Database tests use `TEST_DATABASE_URL`, defaulting to
`postgres://postgres@127.0.0.1:5433/recallai_test`. Apply migrations to that
database first.

## Conventions

- TypeScript strict mode; no `any` in new code unless unavoidable.
- Server-only code lives under `src/lib` and never imports client components.
- Every data-access function takes `userId` as its first argument and filters in
  SQL. Do not rely on the UI to hide other users' rows.
- Add new file formats by extending `src/lib/ingest/detect.ts` and
  `src/lib/ingest/extract.ts`; keep the `ExtractionResult` contract.
- Preserve citations: any new answer path must map back to real chunk ids.
- Avoid new heavy dependencies. The app should stay deployable on a free tier.

## Migrations

Add a numbered file to `db/migrations` (`002_....sql`). Never edit an applied
migration in a deployed environment; add a new one. `npm run db:migrate` records
applied files in `schema_migrations` and takes an advisory lock.

## Commit style

Short imperative subject, optional body explaining the why. Keep unrelated
changes out of the same commit.
