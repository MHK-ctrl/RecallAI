# LinkedIn announcement

Status: ready to publish. Publish from the account signed in to Brave Browser and
attach `docs/screenshots/ask.png` (a real screenshot of the running app with the
synthetic sample library).

---

I kept losing things I had already learned.

Lecture notes, PDFs, screenshots, half-finished markdown files — the information
existed, but finding the exact page again meant opening folder after folder.

So I built RecallAI: a private search engine for my own documents.

Upload your notes, PDFs, slides or screenshots. RecallAI extracts the text, keeps
page numbers and sections, splits it into overlapping passages, and stores them in
PostgreSQL with pgvector.

Then you can ask a normal question, like "Where did I write about two-phase
locking?", and it retrieves the most relevant passages before answering — with
numbered citations back to the real document and page.

A few things I cared about while building it:

• Answers must be grounded. If retrieval finds nothing, it says so instead of
inventing a source.
• Every query is scoped to the signed-in user. Private by default, and files are
served through an authenticated route rather than a public bucket.
• It works without an AI key: hybrid retrieval and cited extractive answers still
function, clearly labelled. Add a chat and embedding provider for written answers
and semantic recall.

Stack: Next.js 16, React 19, TypeScript, Tailwind, PostgreSQL + pgvector, scrypt
auth with database-backed sessions, unpdf/mammoth/tesseract.js for extraction,
deployed on Vercel with Neon Postgres.

The hardest parts were not the UI: page-aware PDF extraction, avoiding duplicate
passages when a document is reprocessed, validating citations, and proving that
one account can never see another account's data.

Live demo (no account needed): https://recallai-ten.vercel.app/demo
Source: https://github.com/MHK-ctrl/RecallAI

#BuildInPublic #RAG #FullStackDevelopment #PostgreSQL #AI
