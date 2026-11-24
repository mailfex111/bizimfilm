import { createServiceRoleClient } from "@/lib/supabase/admin";

if (typeof window !== "undefined") {
  throw new Error("rateLimit helper is strictly server-only.");
}

// Local process fallback used ONLY if Migration 010 has not yet been applied
const memoryFallback = new Map<string, number[]>();

export interface RateLimitDecision {
  allowed: boolean;
  distributed: boolean;
  retryAfterSeconds: number;
}

/**
 * Extracts client IP from standard Vercel / reverse-proxy headers.
 */
export function extractClientIp(headers: Headers): string {
  return (
    headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    headers.get("x-real-ip")?.trim() ||
    "unknown"
  );
}

/**
 * Checks and increments an atomic rate-limit bucket shared across all Vercel
 * serverless instances via PostgreSQL (`public.consume_auth_rate_limit`).
 */
export async function checkDistributedRateLimit(
  bucketKey: string,
  maxAttempts: number,
  windowSeconds: number
): Promise<RateLimitDecision> {
  const admin = createServiceRoleClient();

  if (admin) {
    try {
      const { data, error } = await admin.rpc("consume_auth_rate_limit", {
        p_bucket_key: bucketKey,
        p_max_attempts: maxAttempts,
        p_window_seconds: windowSeconds,
      });

      if (!error && Array.isArray(data) && data[0]) {
        const row = data[0] as {
          allowed: boolean;
          retry_after_seconds: number;
        };
        return {
          allowed: Boolean(row.allowed),
          distributed: true,
          retryAfterSeconds: Number(row.retry_after_seconds || 0),
        };
      }
    } catch {
      // Fall back to local memory limiter if DB RPC is unavailable
    }
  }

  const now = Date.now();
  const windowMs = windowSeconds * 1000;
  const prev = (memoryFallback.get(bucketKey) || []).filter(
    (ts) => now - ts < windowMs
  );
  if (prev.length >= maxAttempts) {
    memoryFallback.set(bucketKey, prev);
    const oldest = prev[0] || now;
    return {
      allowed: false,
      distributed: false,
      retryAfterSeconds: Math.max(1, Math.ceil((windowMs - (now - oldest)) / 1000)),
    };
  }
  prev.push(now);
  memoryFallback.set(bucketKey, prev);
  return { allowed: true, distributed: false, retryAfterSeconds: 0 };
}
