// Batch 5: Lightweight in-memory rate limiter for public endpoints.
//
// Per-Worker isolate fixed-window. NOT a substitute for an edge/Redis limiter
// at scale, but enough to blunt scrapers / abuse on tracking + webhook URLs.
// Each isolate gets its own window — limits are effectively per-isolate.
//
// Usage:
//   const lim = checkRateLimit(`open:${ip}`, { limit: 120, windowMs: 60_000 });
//   if (!lim.ok) return new Response("Too Many Requests", { status: 429, ... });

type Bucket = { count: number; resetAt: number };
const buckets = new Map<string, Bucket>();
const MAX_KEYS = 20_000; // bound memory; LRU-ish: drop oldest on overflow

function gc(now: number) {
  // Cheap sweep — only when oversized.
  if (buckets.size <= MAX_KEYS) return;
  for (const [k, b] of buckets) {
    if (b.resetAt <= now) buckets.delete(k);
    if (buckets.size <= MAX_KEYS * 0.9) break;
  }
  if (buckets.size > MAX_KEYS) {
    // Hard cap — drop oldest insertion-order keys.
    const drop = buckets.size - MAX_KEYS;
    let i = 0;
    for (const k of buckets.keys()) {
      if (i++ >= drop) break;
      buckets.delete(k);
    }
  }
}

export interface RateLimitOpts {
  limit: number;
  windowMs: number;
}

export interface RateLimitResult {
  ok: boolean;
  remaining: number;
  resetAt: number;
  retryAfterSec: number;
}

export function checkRateLimit(key: string, opts: RateLimitOpts): RateLimitResult {
  const now = Date.now();
  const existing = buckets.get(key);
  if (!existing || existing.resetAt <= now) {
    const resetAt = now + opts.windowMs;
    buckets.set(key, { count: 1, resetAt });
    gc(now);
    return { ok: true, remaining: opts.limit - 1, resetAt, retryAfterSec: 0 };
  }
  existing.count += 1;
  const ok = existing.count <= opts.limit;
  return {
    ok,
    remaining: Math.max(0, opts.limit - existing.count),
    resetAt: existing.resetAt,
    retryAfterSec: Math.ceil((existing.resetAt - now) / 1000),
  };
}

/** Best-effort client IP extraction. CF-style, then forwarded, then fallback. */
export function clientIp(req: Request): string {
  return (
    req.headers.get("cf-connecting-ip") ||
    req.headers.get("x-real-ip") ||
    (req.headers.get("x-forwarded-for") || "").split(",")[0].trim() ||
    "unknown"
  );
}

/** Standard 429 response with Retry-After + RateLimit-* hints. */
export function rateLimitResponse(r: RateLimitResult, body: BodyInit = "Too Many Requests"): Response {
  return new Response(body, {
    status: 429,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Retry-After": String(r.retryAfterSec || 1),
      "X-RateLimit-Remaining": String(r.remaining),
      "X-RateLimit-Reset": String(Math.ceil(r.resetAt / 1000)),
    },
  });
}
