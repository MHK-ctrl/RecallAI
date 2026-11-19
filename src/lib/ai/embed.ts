import { createHash } from "node:crypto";
import { env } from "@/lib/env";

/**
 * Deterministic local embedding used when no embedding provider is configured.
 * It is a lexical hashing vector (unigrams + bigrams), not a neural embedding:
 * it captures term overlap, not meaning. It is normalised so pgvector cosine
 * distance behaves, and it keeps hybrid retrieval working without an API key.
 * Documented in docs/AI.md.
 */
export function localEmbedding(text: string, dim = env.embedding.dim): number[] {
  const vector = new Float64Array(dim);
  const normalised = text.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, " ");
  const words = normalised.split(/\s+/).filter((word) => word.length > 1);
  const stop = new Set([
    "the", "and", "for", "with", "that", "this", "from", "have", "were", "was", "are",
    "but", "not", "you", "your", "our", "their", "its", "into", "about", "than", "then",
    "they", "them", "there", "here", "what", "when", "which", "who", "will", "would",
    "can", "could", "should", "also", "been", "being", "has", "had", "does", "did",
  ]);

  const add = (term: string, weight: number) => {
    const hash = createHash("md5").update(term).digest();
    const index = hash.readUInt32BE(0) % dim;
    const sign = hash[4] % 2 === 0 ? 1 : -1;
    vector[index] += weight * sign;
  };

  words.forEach((word, index) => {
    if (!stop.has(word) && word.length > 2) add(word, 1);
    if (index + 1 < words.length) {
      const bigram = `${word}_${words[index + 1]}`;
      if (!stop.has(word) && !stop.has(words[index + 1])) add(bigram, 0.5);
    }
  });

  let norm = 0;
  for (let index = 0; index < dim; index += 1) norm += vector[index] * vector[index];
  norm = Math.sqrt(norm);
  if (norm === 0) return Array.from({ length: dim }, () => 0);
  return Array.from(vector, (value) => Number((value / norm).toFixed(6)));
}

export function toVectorLiteral(vector: number[]): string {
  return `[${vector.join(",")}]`;
}

export function isProviderConfigured(): boolean {
  return Boolean(env.embedding.apiKey && env.embedding.model);
}

async function providerEmbedding(texts: string[]): Promise<number[][]> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30_000);
  try {
    const response = await fetch(`${env.embedding.baseUrl}/embeddings`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${env.embedding.apiKey}`,
      },
      body: JSON.stringify({ model: env.embedding.model, input: texts }),
      signal: controller.signal,
    });
    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      throw new Error(
        `Embedding provider returned ${response.status}${detail ? `: ${detail.slice(0, 200)}` : ""}`,
      );
    }
    const payload = (await response.json()) as { data?: Array<{ embedding: number[] }> };
    const vectors = payload.data?.map((item) => item.embedding);
    if (!vectors || vectors.length !== texts.length) {
      throw new Error("Embedding provider returned an unexpected payload.");
    }
    for (const vector of vectors) {
      if (vector.length !== env.embedding.dim) {
        throw new Error(
          `Embedding dimension mismatch: provider returned ${vector.length}, schema expects ${env.embedding.dim}. Set EMBEDDING_DIM and migrate the vector column, or choose a matching model.`,
        );
      }
    }
    return vectors;
  } finally {
    clearTimeout(timeout);
  }
}

export type EmbeddingMode = "provider" | "local";

export function embeddingMode(): EmbeddingMode {
  return isProviderConfigured() ? "provider" : "local";
}

/** Batched so large documents do not exceed provider request limits. */
export async function embedTexts(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) return [];
  if (isProviderConfigured()) {
    const results: number[][] = [];
    const batchSize = 32;
    for (let index = 0; index < texts.length; index += batchSize) {
      const batch = texts.slice(index, index + batchSize).map((text) => text.slice(0, 8000));
      results.push(...(await providerEmbedding(batch)));
    }
    return results;
  }
  return texts.map((text) => localEmbedding(text));
}
