# Changelog

All notable changes to RecallAI are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project uses
semantic versioning.

## [0.1.0] — 2026-11-19

### Added

- Email/password authentication with scrypt hashing, server-side sessions,
  password reset tokens, and protected application routes.
- Private document upload with drag and drop, magic-byte validation, per-account
  quotas, checksum de-duplication and live processing status.
- Extraction pipeline for PDF (page-aware), DOCX, Markdown (heading-aware), TXT,
  CSV (RFC 4180) and images (OCR through tesseract.js when available).
- Overlapping, page- and section-aware chunking with configurable targets.
- pgvector storage plus a deterministic local lexical embedding fallback, so
  hybrid retrieval works without an external embedding provider.
- Hybrid search combining Postgres full-text ranking and vector similarity via
  Reciprocal Rank Fusion, with substring fallback, filters and highlights.
- "Ask your memories" chat with retrieval-first RAG, citation validation,
  extractive fallback when no chat model is configured, and stored conversations.
- Dashboard with real aggregates, 7-day activity, recent uploads, searches and
  conversations.
- Collections, tags, memory timeline, and a document viewer with page-linked
  citations, in-document matches and metadata editing.
- Settings and privacy page with profile and password changes, JSON data export,
  account deletion, and a plain-language data-processing summary.
- Public landing page and a separate synthetic demo workspace with local search
  and cited sample answers.
- Light and dark themes, responsive layout, keyboard-visible focus states and
  reduced-motion support.
- Unit and database-backed integration tests for chunking, extraction, password
  hashing, citation integrity and cross-account isolation.
- CI workflow that provisions pgvector Postgres and runs migrations, typecheck,
  lint, tests and a production build.
