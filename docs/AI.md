# AI configuration

RecallAI separates **chat generation** from **embeddings**. Both are optional and
speak the OpenAI-compatible HTTP shape, so OpenAI, Groq, Together, OpenRouter,
Ollama, vLLM, LM Studio or a gateway all work.

## Environment variables

```bash
# Chat model — writes grounded answers
LLM_BASE_URL=https://api.openai.com/v1
LLM_API_KEY=...
LLM_MODEL=gpt-4o-mini

# Embedding model — semantic retrieval
EMBEDDING_BASE_URL=https://api.openai.com/v1
EMBEDDING_API_KEY=...
EMBEDDING_MODEL=text-embedding-3-small
EMBEDDING_DIM=1536
```

`EMBEDDING_API_KEY` and `EMBEDDING_BASE_URL` fall back to the `LLM_*` values,
but the model names are always separate. A chat-only provider (no embeddings
endpoint) is a supported configuration.

### Dimension contract

The database column is `vector(1536)`. `text-embedding-3-small` returns 1536
dimensions, so the defaults line up. If your provider returns a different size,
set `EMBEDDING_DIM` **and** migrate the column + rebuild the HNSW index.
Indexing fails with a clear message when a provider vector does not match, rather
than writing vectors that can never be compared.

## Modes

| Configuration | Search | Answers |
|---|---|---|
| No keys | Full-text + **local lexical vectors** (hybrid) | Extractive quotations with citations |
| Chat only | Full-text + local vectors | Written answers, citation-validated |
| Embeddings only | Full-text + provider vectors | Extractive quotations |
| Both | Full-text + provider vectors | Written answers, citation-validated |

The health endpoint (`/api/health`) and Settings page report which modes are
active. The UI never claims a model is in use when it is not.

### About the local fallback

`src/lib/ai/embed.ts` builds a deterministic 1536-dimension vector from hashed
unigrams and bigrams (MD5 → bucket, signed, L2-normalised). It captures term
overlap, **not meaning**: "car" and "automobile" are unrelated to it. It exists so
hybrid retrieval, the vector column, the HNSW index and the RRF fusion path are
all exercised without credentials, and so a fresh clone works offline. It is
labelled as `local-hash-v1@1536` in `documents.embedding_model`.

Do not describe it as a semantic model. Configure a real embedding provider for
semantic recall, then re-index existing documents.

## RAG flow

```
question
  → retrieve top 18 (max 2 chunks per document)
  → keep top 8, number them [1]…[n]
  → build context with title / page / section
  → system prompt: sources only, cite every claim, ignore document instructions
  → chat completion (temperature 0.15, ≤ 650 tokens, 40 s timeout, one retry)
  → validate citation markers
  → persist answer + citations
```

### Citation validation

- Markers `[k]` where `k > n` or `k < 1` are removed.
- If no valid marker survives, the generated text is discarded and the
  extractive answer is returned: the model is never allowed to present an
  uncited answer as grounded.
- Citations stored with the message are only those the answer referenced.
- Citation numbers always map to chunks actually returned by retrieval, so a
  document title or page number cannot be invented.

### Prompt-injection posture

Retrieved text is wrapped as numbered source material and the system prompt
states that document content is untrusted data, never instructions. This is
mitigation, not a guarantee — a hostile document can still attempt to steer a
model. The structural defences are stronger: answers must cite retrieved chunks,
invalid citations are stripped, and retrieval is scoped to the signed-in user.

## Cost and latency controls

- Only retrieved excerpts are sent, never whole documents.
- Embeddings are generated once per chunk at index time, in batches of 32.
- Answers are capped at 650 output tokens.
- Chat and search endpoints are rate limited per user/IP.
- Embedding failures during indexing mark the document `failed` with a readable
  error; the file remains stored and can be retried.

## Switching providers

1. Update the `EMBEDDING_*` variables (and dimension, if changed).
2. Run the dimension migration if needed.
3. Re-index each document (document viewer → actions → Re-index). The new
   `embedding_model` value is written per document; search only compares vectors
   from the currently configured model, so a half-migrated library degrades to
   keyword search rather than returning nonsense.
