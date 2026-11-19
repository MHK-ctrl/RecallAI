/**
 * Central configuration. Every value has a development-safe default so the app
 * can boot locally without a .env file, but production requires explicit
 * secrets (see assertProductionConfig).
 */

function bool(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined) return fallback;
  return ["1", "true", "yes", "on"].includes(value.toLowerCase());
}

function int(value: string | undefined, fallback: number): number {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

const isProd = process.env.NODE_ENV === "production";

export const env = {
  isProd,
  appUrl: process.env.APP_URL?.replace(/\/$/, "") ?? "http://localhost:3000",
  databaseUrl:
    process.env.DATABASE_URL ?? "postgres://postgres@127.0.0.1:5433/recallai",
  sessionSecret: process.env.SESSION_SECRET ?? "",
  maxUploadMb: int(process.env.MAX_UPLOAD_MB, 8),
  maxChunksPerDocument: int(process.env.MAX_CHUNKS_PER_DOCUMENT, 400),
  ocrEnabled: bool(process.env.OCR_ENABLED, true),
  // Show password-reset links in the UI when no email provider is configured.
  devShowResetLink:
    bool(process.env.DEV_SHOW_RESET_LINK, !isProd) && !process.env.SMTP_URL,
  llm: {
    baseUrl: (process.env.LLM_BASE_URL ?? "https://api.openai.com/v1").replace(/\/$/, ""),
    apiKey: process.env.LLM_API_KEY ?? "",
    model: process.env.LLM_MODEL ?? "",
  },
  embedding: {
    baseUrl: (process.env.EMBEDDING_BASE_URL ?? process.env.LLM_BASE_URL ?? "https://api.openai.com/v1").replace(/\/$/, ""),
    apiKey: process.env.EMBEDDING_API_KEY ?? process.env.LLM_API_KEY ?? "",
    model: process.env.EMBEDDING_MODEL ?? "",
    dim: int(process.env.EMBEDDING_DIM, 1536),
  },
  storageQuotaMb: int(process.env.USER_STORAGE_QUOTA_MB, 250),
};

export function isLlmConfigured(): boolean {
  return Boolean(env.llm.apiKey && env.llm.model);
}

export function isEmbeddingProviderConfigured(): boolean {
  return Boolean(env.embedding.apiKey && env.embedding.model);
}

/** Identifier stored with each vector so mixed embedding models never mix. */
export function activeEmbeddingModel(): string {
  return isEmbeddingProviderConfigured()
    ? `${env.embedding.model}@${env.embedding.dim}`
    : `local-hash-v1@${env.embedding.dim}`;
}

/**
 * Called from the health endpoint and before bootstrapping, never at import
 * time, so a missing secret fails loudly at runtime instead of during build.
 */
export function assertProductionConfig(): string[] {
  const problems: string[] = [];
  if (isProd) {
    if (!process.env.SESSION_SECRET || process.env.SESSION_SECRET.length < 32) {
      problems.push("SESSION_SECRET must be set to at least 32 characters in production.");
    }
    if (!process.env.DATABASE_URL) {
      problems.push("DATABASE_URL must be set in production.");
    }
  }
  return problems;
}
