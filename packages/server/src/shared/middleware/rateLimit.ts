import type { NextFunction, Request, Response } from "express";

export interface RateLimitOptions {
  readonly max: number;
  readonly windowMs: number;
}

interface Bucket {
  count: number;
  resetAt: number;
}

/**
 * Simple in-memory rate limiter keyed by IP address.
 * Resets the counter per-IP after `windowMs` milliseconds.
 */
export function createRateLimit(options: RateLimitOptions) {
  const buckets = new Map<string, Bucket>();

  return function rateLimitMiddleware(
    req: Request,
    res: Response,
    next: NextFunction
  ): void {
    const key = req.ip ?? "unknown";
    const now = Date.now();
    const bucket = buckets.get(key);

    if (!bucket || bucket.resetAt <= now) {
      buckets.set(key, { count: 1, resetAt: now + options.windowMs });
      next();
      return;
    }

    bucket.count += 1;

    if (bucket.count > options.max) {
      res.status(429).json({
        error: { code: "TOO_MANY_REQUESTS", message: "Rate limit exceeded" },
      });
      return;
    }

    next();
  };
}
