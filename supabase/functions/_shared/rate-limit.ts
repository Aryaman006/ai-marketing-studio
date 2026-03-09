// Simple in-memory rate limiter for edge functions
// Resets when the function cold-starts (acceptable for lightweight rate limiting)

const windowMs = 60_000; // 1 minute window
const store = new Map<string, { count: number; resetAt: number }>();

export function checkRateLimit(userId: string, maxRequests: number = 10): { allowed: boolean; remaining: number; retryAfterMs: number } {
  const now = Date.now();
  const entry = store.get(userId);

  if (!entry || now > entry.resetAt) {
    store.set(userId, { count: 1, resetAt: now + windowMs });
    return { allowed: true, remaining: maxRequests - 1, retryAfterMs: 0 };
  }

  if (entry.count >= maxRequests) {
    return { allowed: false, remaining: 0, retryAfterMs: entry.resetAt - now };
  }

  entry.count++;
  return { allowed: true, remaining: maxRequests - entry.count, retryAfterMs: 0 };
}

// Cleanup old entries periodically (every 5 minutes)
setInterval(() => {
  const now = Date.now();
  for (const [key, value] of store.entries()) {
    if (now > value.resetAt) store.delete(key);
  }
}, 300_000);
