import { createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { cache } from "react";
import { sql } from "@/lib/db";
import { env } from "@/lib/env";

export const SESSION_COOKIE = "recallai_session";
const SESSION_DAYS = 30;

export type SessionUser = {
  id: string;
  email: string;
  name: string;
  created_at: string;
};

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function requireSecret(): string {
  if (env.sessionSecret.length >= 16) return env.sessionSecret;
  if (!env.isProd) return "recallai-development-secret";
  throw new Error("SESSION_SECRET is not configured");
}

export function signValue(value: string): string {
  return createHash("sha256")
    .update(`${requireSecret()}:${value}`)
    .digest("base64url");
}

export async function createSession(userId: string, userAgent?: string | null) {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);
  await sql(
    `INSERT INTO sessions (user_id, token_hash, user_agent, expires_at)
     VALUES ($1, $2, $3, $4)`,
    [userId, sha256(token), userAgent?.slice(0, 300) ?? null, expiresAt],
  );
  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: env.isProd,
    path: "/",
    expires: expiresAt,
  });
  return { token, expiresAt };
}

export async function destroySession() {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (token) {
    await sql(`DELETE FROM sessions WHERE token_hash = $1`, [sha256(token)]);
  }
  store.delete(SESSION_COOKIE);
}

/**
 * Resolves the signed-in user for the current request. Memoised per request so
 * a page and its layout do not hit the database twice.
 */
export const getSessionUser = cache(async (): Promise<SessionUser | null> => {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token || token.length < 20) return null;

  try {
    const rows = await sql<SessionUser>(
      `SELECT u.id, u.email, u.name, u.created_at::text AS created_at
         FROM sessions s
         JOIN users u ON u.id = s.user_id
        WHERE s.token_hash = $1 AND s.expires_at > now()
        LIMIT 1`,
      [sha256(token)],
    );
    return rows[0] ?? null;
  } catch (error) {
    console.error("[auth] session lookup failed", (error as Error).message);
    return null;
  }
});

export async function deleteExpiredSessions() {
  await sql(`DELETE FROM sessions WHERE expires_at < now()`);
}
