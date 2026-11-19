import { ApiError } from "@/lib/api";

/**
 * Small in-memory fixed-window limiter. It protects each server instance only;
 * for multi-instance deployments put a shared store (Redis/Upstash) behind the
 * same interface. Documented in SECURITY.md.
 */
type Bucket = { count: number; resetAt: number };

type GlobalWithBuckets = typeof globalThis & { __recallaiRateLimits?: Map<string, Bucket> };
const globalWithBuckets = globalThis as GlobalWithBuckets;
const buckets = (globalWithBuckets.__recallaiRateLimits ??= new Map<string, Bucket>());

function sweep(now: number) {
  if (buckets.size < 2000) return;
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key);
  }
}

export function rateLimit(key: string, limit: number, windowMs: number): void {
  const now = Date.now();
  sweep(now);
  const bucket = buckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return;
  }
  if (bucket.count >= limit) {
    const seconds = Math.max(1, Math.ceil((bucket.resetAt - now) / 1000));
    throw new ApiError(
      429,
      `Too many requests. Try again in ${seconds}s.`,
      "rate_limited",
    );
  }
  bucket.count += 1;
}

export function clientKey(request: Request, scope: string): string {
  const forwarded = request.headers.get("x-forwarded-for");
  const ip = forwarded?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "local";
  return `${scope}:${ip}`;
}
