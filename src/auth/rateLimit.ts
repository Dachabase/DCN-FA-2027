import { Request, Response, NextFunction } from "express";

/**
 * Small in-memory rate limiter for sensitive endpoints (per IP, per instance).
 * Per-account protections (code attempt counters, login lockout) live in the
 * database, so they still hold across restarts and several instances.
 */
export function rateLimit(options: { windowMs: number; max: number; message?: string }) {
  const hits = new Map<string, { count: number; resetAt: number }>();

  // Drop expired entries now and then so the map cannot grow forever.
  const sweep = setInterval(() => {
    const now = Date.now();
    for (const [key, value] of hits) {
      if (value.resetAt <= now) hits.delete(key);
    }
  }, Math.max(options.windowMs, 60_000));
  sweep.unref?.();

  return (req: Request, res: Response, next: NextFunction) => {
    const key = req.ip || req.socket?.remoteAddress || "unknown";
    const now = Date.now();
    const entry = hits.get(key);
    if (!entry || entry.resetAt <= now) {
      hits.set(key, { count: 1, resetAt: now + options.windowMs });
      return next();
    }
    entry.count += 1;
    if (entry.count > options.max) {
      res.setHeader("Retry-After", String(Math.ceil((entry.resetAt - now) / 1000)));
      return res.status(429).json({
        success: false,
        error: "TOO_MANY_REQUESTS",
        message: options.message || "Too many requests. Please wait a moment and try again.",
      });
    }
    return next();
  };
}
