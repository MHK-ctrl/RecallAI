# Privacy

RecallAI exists to make private information easier to find. This page describes
what is stored, where it goes, and how to remove it.

## What is stored

| Data | Where | Why |
|---|---|---|
| Name, email, scrypt password hash | `users` | Account and sign-in |
| Session token hash, user agent, expiry | `sessions` | Keep you signed in |
| Original file bytes | `documents.file_data` (`bytea`) | Open/download the source |
| Extracted text, page range, section, embeddings | `document_chunks` | Search and citations |
| Titles, descriptions, tags, collections | `documents`, `tags`, `collections` | Organisation |
| Questions, answers, citations | `chat_messages` | Conversation history |
| Queries and result counts | `search_history` | Recent searches on the dashboard |

Uploaded files are never placed in a public bucket. Downloads go through
`/api/documents/[id]/file`, which requires a session and verifies ownership; the
viewer adds a ten-minute HMAC-signed query string on top.

## What leaves the server

Only if you configure the corresponding provider:

- **Chat model configured** — when you ask a question, your question plus the
  retrieved excerpts (up to 8 passages, ~320 characters each) are sent to
  `LLM_BASE_URL`. Full documents are not sent.
- **Embedding provider configured** — each chunk's text is sent, in batches, to
  `EMBEDDING_BASE_URL` when a document is indexed.
- **Neither configured** — no document text leaves the application server for
  AI processing. The local hashing embedder runs in-process.

Hosting and database providers necessarily process the stored data as part of
running the service. Check their data-processing terms for your region.

## What is not collected

- No advertising or analytics SDKs.
- No third-party fonts or scripts; the UI ships its own assets.
- No content of documents in application logs. Logs contain status transitions
  and sanitised error messages.
- No cross-account retrieval, recommendations, or training on your documents by
  this application.

## Retention and deletion

- Deleting a document cascades to its chunks, embeddings, tags and collection
  links immediately.
- Deleting a conversation deletes its messages.
- Deleting your account deletes the profile and all owned rows.
- Search history keeps the most recent 100 queries per account.
- Sessions expire after 30 days or on sign-out/password reset.

## Export

Settings → **Download JSON** (`/api/account/export`) returns account metadata,
document metadata, all extracted passages and embeddings' source text, tags,
collections, conversations and search history. Original file bytes are excluded;
download them individually from each document.

## Children and sensitive data

RecallAI is a general document tool, not a records system for regulated data.
Do not upload medical records, government identifiers, or other high-risk data
without reviewing the hosting and AI provider agreements yourself.

## Contact

Open an issue on the repository for privacy questions that do not involve
personal data.
