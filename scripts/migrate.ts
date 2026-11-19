/**
 * Applies every SQL file in db/migrations in filename order exactly once.
 * Usage: npm run db:migrate        (DATABASE_URL from .env.local)
 */
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { Client } from "pg";
import { config } from "dotenv";

config({ path: ".env.local" });
config();

const MIGRATIONS_DIR = join(process.cwd(), "db", "migrations");

async function main() {
  const connectionString =
    process.env.DATABASE_URL ?? "postgres://postgres@127.0.0.1:5433/recallai";
  const isLocal = /localhost|127\.0\.0\.1|::1/.test(connectionString);
  const client = new Client({
    connectionString,
    ssl: isLocal ? undefined : { rejectUnauthorized: false },
  });
  await client.connect();

  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        filename   text PRIMARY KEY,
        applied_at timestamptz NOT NULL DEFAULT now()
      )
    `);
    await client.query("SELECT pg_advisory_lock(918273645)");

    const applied = new Set(
      (await client.query<{ filename: string }>("SELECT filename FROM schema_migrations")).rows.map(
        (row) => row.filename,
      ),
    );
    const files = readdirSync(MIGRATIONS_DIR)
      .filter((file) => file.endsWith(".sql"))
      .sort();

    for (const file of files) {
      if (applied.has(file)) {
        console.log(`• ${file} (already applied)`);
        continue;
      }
      const statements = readFileSync(join(MIGRATIONS_DIR, file), "utf8");
      console.log(`→ applying ${file}`);
      await client.query("BEGIN");
      try {
        await client.query(statements);
        await client.query("INSERT INTO schema_migrations (filename) VALUES ($1)", [file]);
        await client.query("COMMIT");
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      }
    }
    console.log("✓ migrations up to date");
  } finally {
    await client.query("SELECT pg_advisory_unlock(918273645)").catch(() => undefined);
    await client.end();
  }
}

main().catch((error) => {
  console.error("Migration failed:", error instanceof Error ? error.message : error);
  process.exit(1);
});
