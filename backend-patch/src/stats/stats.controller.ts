import { Router, Request, Response } from "express";
import { prisma } from "../database/prisma";

/**
 * Public, anonymous activity counters for the dashboard hero.
 * - POST /api/presence  { vid }  : heartbeat from a browser tab (random id kept in localStorage, no personal data)
 * - GET  /api/stats/live         : { online, students, examsToday }
 * "online" is the number of distinct heartbeats in the last 2 minutes (in memory, resets on restart).
 * The database counters are cached for 60 seconds. Any counter that fails is returned as null and the UI hides it.
 */
export const statsRouter = Router();

const ONLINE_WINDOW_MS = 2 * 60 * 1000;
const MAX_TRACKED = 20000;
const presence = new Map<string, number>();

function prune(now = Date.now()) {
  for (const [id, t] of presence) if (now - t > ONLINE_WINDOW_MS) presence.delete(id);
}

let cache: { at: number; students: number | null; examsToday: number | null } | null = null;

async function loadCounters() {
  const now = Date.now();
  if (cache && now - cache.at < 60_000) return cache;
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  let students: number | null = null;
  let examsToday: number | null = null;
  try { students = await prisma.user.count(); } catch { students = null; }
  try { examsToday = await prisma.utmeExamAttempt.count({ where: { startedAt: { gte: start } } }); } catch { examsToday = null; }
  cache = { at: now, students, examsToday };
  return cache;
}

statsRouter.post("/presence", (req: Request, res: Response) => {
  const vid = String(req.body?.vid ?? "");
  if (!/^[A-Za-z0-9_-]{8,64}$/.test(vid)) return res.status(400).json({ success: false });
  const now = Date.now();
  if (presence.size >= MAX_TRACKED) prune(now);
  if (presence.size < MAX_TRACKED || presence.has(vid)) presence.set(vid, now);
  return res.json({ success: true });
});

statsRouter.get("/stats/live", async (_req: Request, res: Response) => {
  prune();
  const c = await loadCounters();
  res.set("Cache-Control", "no-store");
  return res.json({ success: true, data: { online: presence.size, students: c.students, examsToday: c.examsToday } });
});
