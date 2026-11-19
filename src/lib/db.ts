import { Pool, type PoolClient, type QueryResultRow } from "pg";
import { env } from "./env";

type GlobalWithPool = typeof globalThis & { __recallaiPool?: Pool };
const globalWithPool = globalThis as GlobalWithPool;

function sslOption() {
  const url = env.databaseUrl;
  if (url.includes("sslmode=disable")) return undefined;
  const isLocal =
    url.includes("localhost") || url.includes("127.0.0.1") || url.includes("::1");
  if (url.includes("sslmode=require") || url.includes("sslmode=verify-full") || !isLocal) {
    return { rejectUnauthorized: false };
  }
  return undefined;
}

export function getPool(): Pool {
  if (!globalWithPool.__recallaiPool) {
    const pool = new Pool({
      connectionString: env.databaseUrl,
      max: env.isProd ? 5 : 8,
      idleTimeoutMillis: 20_000,
      connectionTimeoutMillis: 10_000,
      ssl: sslOption(),
    });
    pool.on("error", (error) => {
      console.error("[db] idle client error", error.message);
    });
    globalWithPool.__recallaiPool = pool;
  }
  return globalWithPool.__recallaiPool;
}

export async function sql<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params: unknown[] = [],
): Promise<T[]> {
  const result = await getPool().query<T>(text, params as never[]);
  return result.rows;
}

export async function one<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params: unknown[] = [],
): Promise<T | null> {
  const rows = await sql<T>(text, params);
  return rows[0] ?? null;
}

export async function tx<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

/** Postgres error codes we care about. */
export const PG_UNIQUE_VIOLATION = "23505";
export const PG_FOREIGN_KEY_VIOLATION = "23503";

export function pgErrorCode(error: unknown): string | undefined {
  if (typeof error === "object" && error !== null && "code" in error) {
    const code = (error as { code?: unknown }).code;
    return typeof code === "string" ? code : undefined;
  }
  return undefined;
}

export function isDatabaseConfigured(): boolean {
  return Boolean(env.databaseUrl);
}
