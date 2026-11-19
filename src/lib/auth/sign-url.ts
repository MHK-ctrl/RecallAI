import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { env } from "@/lib/env";

function secret(): string {
  return env.sessionSecret.length >= 16 ? env.sessionSecret : "recallai-development-secret";
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/**
 * Short-lived signed query strings for private file access. The session cookie
 * is still required, so a leaked URL stops working after ten minutes and is
 * useless to another account.
 */
export function signFileParams(documentId: string, userId: string, ttlMs = 10 * 60_000) {
  const expires = Date.now() + ttlMs;
  const signature = createHmac("sha256", secret())
    .update(`${documentId}:${userId}:${expires}`)
    .digest("base64url");
  return `exp=${expires}&sig=${signature}`;
}

export function verifyFileParams(
  documentId: string,
  userId: string,
  expires: string | null,
  signature: string | null,
): boolean {
  if (!expires || !signature) return false;
  const expiresAt = Number.parseInt(expires, 10);
  if (!Number.isFinite(expiresAt) || expiresAt < Date.now()) return false;
  const expected = createHmac("sha256", secret())
    .update(`${documentId}:${userId}:${expiresAt}`)
    .digest("base64url");
  const left = Buffer.from(signature);
  const right = Buffer.from(expected);
  return left.length === right.length && timingSafeEqual(left, right);
}
