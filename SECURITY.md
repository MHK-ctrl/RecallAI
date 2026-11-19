# Security policy

## Reporting a vulnerability

Please open a private security advisory on the GitHub repository, or email the
maintainer through the address on the GitHub profile. Do not open a public issue
for a vulnerability that exposes other users' data. Please include reproduction
steps and the affected route or file. Expect an initial response within a week.

## What RecallAI protects

RecallAI stores personal documents. The security model assumes:

- every request is untrusted until a session is verified;
- every row belongs to exactly one user;
- uploaded files are data, never code or instructions;
- an AI provider, if configured, is an external processor.

### Controls implemented

| Area | Control |
|---|---|
| Authentication | scrypt password hashing (64-byte key, per-user salt), no plaintext secrets stored. |
| Sessions | 256-bit random token in an `HttpOnly`, `SameSite=Lax`, `Secure` (production) cookie. Only a SHA-256 hash is stored server-side. 30-day expiry, revocable. |
| Password reset | 256-bit single-use token, hashed at rest, one-hour expiry, invalidates all sessions on use. |
| Authorization | Every data-access function takes the authenticated `user_id` and filters by it in SQL. Postgres RLS policies are also defined in `db/migrations/001_init.sql` for non-owner roles. |
| CSRF | Mutating routes require a same-origin `Origin` header and use `SameSite=Lax` cookies. |
| Uploads | Extension allow-list plus magic-byte inspection (PDF, ZIP/DOCX, PNG, JPEG, WEBP, text heuristics). Size and per-account quota limits. Files are never executed. |
| Private file access | Files live in Postgres, not a public bucket, and are streamed through an authenticated route with a short-lived HMAC-signed query string. `X-Content-Type-Options: nosniff` and `private, no-store` are set. |
| Prompt injection | Retrieved chunks are labelled as untrusted source data in the system prompt; the model is told to ignore instructions inside documents. Answers must cite real chunks or fall back to extractive quotations. |
| Citation integrity | Citation markers are validated against the retrieved set; non-existent markers are stripped, and an answer without a valid citation is replaced by a quoted extractive answer. |
| Secrets | Server-only environment variables, no `NEXT_PUBLIC_*` secrets, `.env*.local` ignored by Git, error messages redact key-shaped strings. |
| Headers | CSP, `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy`, `X-Content-Type-Options`. |
| Rate limiting | Fixed-window limits on signup, login, reset, search, upload and ask endpoints. |

### Known limitations

- Rate limiting is in-memory per instance. A multi-instance deployment should
  move the limiter to a shared store (Redis/Upstash) behind
  `src/lib/rate-limit.ts`'s interface.
- The CSP allows `'unsafe-inline'` for scripts because Next.js injects inline
  hydration data. A nonce-based policy would require a custom document.
- Password reset links are surfaced in the UI and server logs when no email
  provider is configured (`DEV_SHOW_RESET_LINK`). Configure an email provider
  before inviting real users.
- Uploaded file bytes are capped by the deployment platform's request body
  limit (4.5 MB on Vercel serverless functions). Raise `MAX_UPLOAD_MB` only if
  you move uploads to a signed direct-to-storage flow.
- The AI provider receives retrieved excerpts when a chat model is configured.
  Do not configure a provider if that is unacceptable for your data.

## Dependency hygiene

Run `npm audit` after dependency changes. The project pins a lockfile and has no
post-install scripts from third-party packages beyond standard tooling.
