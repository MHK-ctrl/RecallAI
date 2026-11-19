import { sql } from "@/lib/db";
import { apiJson } from "@/lib/api";
import { assertProductionConfig, isEmbeddingProviderConfigured, isLlmConfigured, activeEmbeddingModel } from "@/lib/env";

export async function GET() {
  const started = Date.now();
  let database: "ok" | "unavailable" = "unavailable";
  let migrations = false;

  try {
    await sql(`SELECT 1`);
    database = "ok";
    const rows = await sql<{ count: string }>(
      `SELECT count(*)::text AS count FROM schema_migrations`,
    );
    migrations = Number(rows[0]?.count ?? 0) > 0;
  } catch {
    database = "unavailable";
  }

  const problems = assertProductionConfig();
  const healthy = database === "ok" && problems.length === 0;

  return apiJson(
    {
      status: healthy ? "ok" : "degraded",
      database,
      migrations,
      configProblems: problems,
      ai: {
        chat: isLlmConfigured() ? "configured" : "extractive-fallback",
        embeddings: isEmbeddingProviderConfigured() ? "provider" : "local-lexical",
        embeddingModel: activeEmbeddingModel(),
      },
      latencyMs: Date.now() - started,
      version: process.env.npm_package_version ?? "0.1.0",
    },
    healthy ? 200 : 503,
  );
}
