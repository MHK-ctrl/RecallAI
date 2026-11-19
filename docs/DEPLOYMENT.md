# Deployment

The reference deployment is **Vercel (Next.js)** + **Neon Postgres with
pgvector**, both on free plans. No paid add-ons are required.

## 1. Database

Create a Postgres project (Neon, Supabase, RDS, or your own), then enable
pgvector if it is not already available:

```sql
CREATE EXTENSION IF NOT EXISTS vector;
```

Copy the pooled connection string. It must include TLS (`sslmode=require`) for
hosted databases; the app enables SSL automatically for non-local hosts.

Apply migrations from your machine:

```bash
DATABASE_URL='postgres://…' npx tsx scripts/migrate.ts
```

Or with the Neon SQL editor, paste `db/migrations/001_init.sql`.

## 2. Vercel project

1. Push the repository to GitHub.
2. Vercel → **Add New → Project → Import** the repository.
3. Framework preset: Next.js. Build command `npm run build`, install `npm install`.
4. Node.js 22.x (matches CI).

Environment variables (Production and Preview):

| Variable | Required | Notes |
|---|---|---|
| `DATABASE_URL` | yes | Hosted Postgres with pgvector. |
| `SESSION_SECRET` | yes | 32+ random characters (`openssl rand -hex 32`). |
| `APP_URL` | yes | `https://<your-domain>` — used in metadata and reset links. |
| `MAX_UPLOAD_MB` | no | Default 8 locally; **keep 4 or lower on Vercel** because serverless request bodies cap at 4.5 MB. |
| `USER_STORAGE_QUOTA_MB` | no | Default 250. |
| `MAX_CHUNKS_PER_DOCUMENT` | no | Default 400. |
| `OCR_ENABLED` | no | `true` by default. OCR runs in a tesseract.js worker on first use. |
| `LLM_BASE_URL` / `LLM_API_KEY` / `LLM_MODEL` | no | Enable written answers. |
| `EMBEDDING_BASE_URL` / `EMBEDDING_API_KEY` / `EMBEDDING_MODEL` / `EMBEDDING_DIM` | no | Enable semantic vectors. |
| `DEV_SHOW_RESET_LINK` | no | Leave unset in production. |

Never prefix a secret with `NEXT_PUBLIC_`.

## 3. Deploy

```bash
npx vercel --prod
```

or let the Git integration deploy on push. Function duration is set per route:
`/api/documents/[id]/process` and `/api/ask` request 60 seconds.

## 4. Verify

```bash
curl -s https://<domain>/api/health
```

Expect `status: ok`, `database: ok`, `migrations: true`, and the AI mode. Then in
a browser:

1. landing page loads, demo workspace searches;
2. sign up, upload a small PDF and a text file;
3. status reaches **Indexed**, passages appear in the document viewer;
4. search returns the passage with a page number;
5. Ask returns an answer with citations (or an extractive answer labelled as
   such);
6. a second account cannot see the first account's documents;
7. delete the document — passages disappear with it.

## Platform limits to design around

- **4.5 MB request body** on Vercel Node functions. Files are uploaded through a
  route handler, so keep `MAX_UPLOAD_MB ≤ 4`. A production-scale version would
  issue a signed direct-to-object-storage URL instead.
- **60 s function duration** on Hobby. Very large PDFs with a remote embedding
  provider may exceed it; the document is marked failed and can be retried.
- **Cold starts** for OCR; the first image upload may take several seconds while
  the tesseract worker and language data load.
- **In-memory rate limiting** is per instance. Move it to a shared store before
  running multiple instances.

## Email

Password reset currently creates a single-use token and, when
`DEV_SHOW_RESET_LINK` is enabled, surfaces the link. Production should connect
an email provider (Resend, Postmark, SES) inside
`src/app/api/auth/reset/route.ts` and leave `DEV_SHOW_RESET_LINK` unset. Until
then, do not invite users who cannot recover an account another way.

## Custom domain

Vercel → Project → Domains → add the domain, then update `APP_URL` and redeploy
so metadata and reset links use the canonical host.
