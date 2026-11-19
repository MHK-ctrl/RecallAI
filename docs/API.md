# API

All endpoints are JSON unless noted. Authenticated endpoints use the
`recallai_session` HttpOnly cookie; a request without it returns
`401 { "error": "You need to sign in to do that.", "code": "unauthorized" }`.
Mutating requests send a same-origin `Origin` header, and errors use
`{ "error": string, "code": string }` with an appropriate status.

Rate limits are per IP (auth) or per user (search/ask/upload) in a fixed window.

## Auth

| Method | Path | Body | Notes |
|---|---|---|---|
| `POST` | `/api/auth/signup` | `{ name, email, password }` | Creates the account, an `Inbox` collection, and a session. `409` if the email exists. |
| `POST` | `/api/auth/login` | `{ email, password }` | `401` with a generic message on failure. |
| `POST` | `/api/auth/logout` | — | Deletes the server-side session. |
| `POST` | `/api/auth/reset` | `{ email }` | Always a generic success. Returns `resetUrl` only when `DEV_SHOW_RESET_LINK` is on. |
| `POST` | `/api/auth/reset/confirm` | `{ token, password }` | Single use; invalidates all sessions. |

## Documents

| Method | Path | Notes |
|---|---|---|
| `GET` | `/api/documents?query=&type=&status=&collection=&tag=&page=&pageSize=` | Paginated summaries with chunk counts, collections and tags. |
| `POST` | `/api/documents` | `multipart/form-data` with `file` (and optional `title`, `description`). Max `MAX_UPLOAD_MB`. `409` on duplicate checksum, `415` on type/signature mismatch, `413` on size or quota. |
| `GET` | `/api/documents/[id]` | Full summary for one owned document. |
| `PATCH` | `/api/documents/[id]` | `{ title?, description?, tags?: string[] }` (tags replace the set, max 12). |
| `DELETE` | `/api/documents/[id]` | Cascades to chunks, vectors, tags and collection links. |
| `POST` | `/api/documents/[id]/process` | Runs extract → chunk → embed synchronously (max 60 s). Returns `{ status, chunks, warnings }`; `422` on processing failure. |
| `GET` | `/api/documents/[id]/file` | Streams the original bytes. Requires the session; the viewer appends `exp`/`sig` signed parameters valid for 10 minutes. |
| `POST` | `/api/documents/[id]/collections` | `{ collectionId, action: "add" \| "remove" }`. |

## Search and answers

| Method | Path | Body | Response |
|---|---|---|---|
| `POST` | `/api/search` | `{ query, fileTypes?, collectionId?, tag?, from?, to? }` | `{ hits, mode: hybrid\|keyword\|fallback, terms, count }`. Records the query. |
| `POST` | `/api/ask` | `{ question, sessionId? }` | `{ sessionId, message, citations, mode: llm\|extractive, notices, retrievalMode }`. Creates a session when `sessionId` is absent. |
| `GET` | `/api/chat/[id]` | — | Session and ordered messages (with stored citations). |
| `DELETE` | `/api/chat/[id]` | — | Deletes the conversation and its messages. |

A hit is:

```json
{
  "chunkId": "uuid",
  "chunkIndex": 4,
  "documentId": "uuid",
  "title": "DBMS — Normalization Notes",
  "fileType": "pdf",
  "content": "Normalization organises tables…",
  "pageFrom": 24,
  "pageTo": 24,
  "section": "Normal forms",
  "createdAt": "2026-11-19T10:00:00.000Z",
  "score": 0.031,
  "matchedTitle": false
}
```

A citation is:

```json
{
  "index": 1,
  "documentId": "uuid",
  "documentTitle": "DBMS — Normalization Notes",
  "fileType": "pdf",
  "page": 24,
  "section": "Normal forms",
  "chunkIndex": 4,
  "excerpt": "Normalization organises tables…",
  "score": 0.031
}
```

## Collections and tags

| Method | Path | Body |
|---|---|---|
| `GET` | `/api/collections` | — |
| `POST` | `/api/collections` | `{ name, color? }` — `409` on duplicate name |
| `PATCH` | `/api/collections/[id]` | `{ name?, color? }` |
| `DELETE` | `/api/collections/[id]` | — (documents remain) |

Tags are managed through `PATCH /api/documents/[id]`.

## Account

| Method | Path | Notes |
|---|---|---|
| `PATCH` | `/api/account` | `{ name? }` or `{ currentPassword, newPassword }` |
| `DELETE` | `/api/account` | Deletes the account and all owned data |
| `GET` | `/api/account/export` | JSON download of the account's data |

## Operations

| Method | Path | Notes |
|---|---|---|
| `GET` | `/api/health` | `200` when the database and required config are healthy, `503` otherwise. Reports AI mode and migration presence. |
