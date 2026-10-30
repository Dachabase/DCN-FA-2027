import { Request, Response, NextFunction } from "express";
import { requireAuth } from "./auth.middleware";

/**
 * Everything under /api needs a signed-in person, except the health check and the public landing numbers.
 * (/api/auth/* is mounted before this gate, so signing in still works.)
 */
const OPEN = [/^\/health$/, /^\/public\//];

export function apiGate(req: Request, res: Response, next: NextFunction) {
  if (req.method === "OPTIONS") return next();
  if (OPEN.some((rule) => rule.test(req.path))) return next();
  return requireAuth(req as any, res, next);
}
