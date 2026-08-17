// Batch 5: Reusable per-IP rate-limit gate for public, unauthenticated routes.
// Returns a 429 Response when the limit is hit, otherwise null.
import { checkRateLimit, clientIp, rateLimitResponse, type RateLimitOpts } from "@/lib/rate-limit.server";

const DEFAULTS: Record<string, RateLimitOpts> = {
  // Tracking pixels fire once per email view, but mail clients prefetch images.
  // Allow generous burst — block runaway scanners.
  "track.open": { limit: 240, windowMs: 60_000 },
  "track.click": { limit: 120, windowMs: 60_000 },
  "unsubscribe.get": { limit: 60, windowMs: 60_000 },
  "unsubscribe.post": { limit: 20, windowMs: 60_000 },
  // SNS retries on its own schedule; tight per-IP cap blunts spoofers.
  "sns.webhook": { limit: 600, windowMs: 60_000 },
};

export function gatePublic(request: Request, scope: keyof typeof DEFAULTS): Response | null {
  const opts = DEFAULTS[scope];
  const r = checkRateLimit(`${scope}:${clientIp(request)}`, opts);
  if (!r.ok) return rateLimitResponse(r);
  return null;
}
