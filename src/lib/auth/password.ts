import { randomBytes, scrypt as scryptCb, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scrypt = promisify(scryptCb) as (
  password: string,
  salt: Buffer,
  keylen: number,
) => Promise<Buffer>;

const KEY_LENGTH = 64;
const SALT_BYTES = 16;

/**
 * Hashes with scrypt (memory-hard, in Node core). Format:
 * scrypt$<salt-hex>$<key-hex>
 */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(SALT_BYTES);
  const key = await scrypt(password.normalize("NFKC"), salt, KEY_LENGTH);
  return `scrypt$${salt.toString("hex")}$${key.toString("hex")}`;
}

export async function verifyPassword(
  password: string,
  stored: string,
): Promise<boolean> {
  const parts = stored.split("$");
  if (parts.length !== 3 || parts[0] !== "scrypt") return false;
  let expected: Buffer;
  try {
    expected = Buffer.from(parts[2], "hex");
  } catch {
    return false;
  }
  if (expected.length !== KEY_LENGTH) return false;
  const actual = await scrypt(
    password.normalize("NFKC"),
    Buffer.from(parts[1], "hex"),
    KEY_LENGTH,
  );
  return timingSafeEqual(expected, actual);
}

export function passwordProblems(password: string): string[] {
  const problems: string[] = [];
  if (password.length < 8) problems.push("Must be at least 8 characters.");
  if (password.length > 200) problems.push("Must be shorter than 200 characters.");
  if (!/[a-zA-Z]/.test(password)) problems.push("Must contain a letter.");
  if (!/[0-9]/.test(password)) problems.push("Must contain a number.");
  return problems;
}
