import type { Request, Response, NextFunction } from "express";

export type RateLimitOptions = {
  keyPrefix: string;
  windowMs: number;
  max: number;
  message?: string;
};

type Bucket = {
  count: number;
  resetAt: number;
};

const buckets = new Map<string, Bucket>();

function getKey(req: Request, prefix: string): string {
  const ip = req.ip || req.headers["x-forwarded-for"]?.toString() || "unknown";
  return `${prefix}:${ip}`;
}

export function rateLimit(options: RateLimitOptions) {
  const message = options.message ?? "Too many requests. Please try again later.";

  return (req: Request, res: Response, next: NextFunction) => {
    const key = getKey(req, options.keyPrefix);
    const now = Date.now();
    const bucket = buckets.get(key);

    if (!bucket || bucket.resetAt <= now) {
      buckets.set(key, { count: 1, resetAt: now + options.windowMs });
      return next();
    }

    bucket.count += 1;
    if (bucket.count > options.max) {
      const retryAfter = Math.ceil((bucket.resetAt - now) / 1000);
      res.setHeader("Retry-After", retryAfter.toString());
      return res.status(429).json({ error: message });
    }

    return next();
  };
}
