import "server-only";

type RateLimitOptions = {
  limit: number;
  windowMs: number;
};

type RateLimitEntry = {
  count: number;
  resetAt: number;
};

const buckets = new Map<string, RateLimitEntry>();

function cleanupExpiredBuckets(now: number) {
  for (const [key, entry] of buckets.entries()) {
    if (entry.resetAt <= now) {
      buckets.delete(key);
    }
  }
}

export function getClientIp(request: Request) {
  const forwardedFor = request.headers.get("x-forwarded-for");

  if (forwardedFor) {
    return forwardedFor.split(",")[0]?.trim() || "unknown";
  }

  return (
    request.headers.get("x-real-ip") ||
    request.headers.get("cf-connecting-ip") ||
    "unknown"
  );
}

export function checkRateLimit(key: string, options: RateLimitOptions) {
  const now = Date.now();
  cleanupExpiredBuckets(now);

  const current = buckets.get(key);

  if (!current || current.resetAt <= now) {
    buckets.set(key, {
      count: 1,
      resetAt: now + options.windowMs,
    });

    return {
      allowed: true,
      retryAfterSeconds: 0,
    };
  }

  if (current.count >= options.limit) {
    return {
      allowed: false,
      retryAfterSeconds: Math.ceil((current.resetAt - now) / 1000),
    };
  }

  current.count += 1;

  return {
    allowed: true,
    retryAfterSeconds: 0,
  };
}
