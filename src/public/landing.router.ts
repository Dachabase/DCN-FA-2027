import { Router } from "express";
import { prisma } from "../database/prisma";

/** Anonymous numbers for the landing page. Cached for 5 minutes; any counter that fails is returned as null and the page keeps its default. */
export const publicRouter = Router();
let cache: { at: number; data: Record<string, number | null> } | null = null;

async function safe(fn: () => Promise<number>): Promise<number | null> {
  try { return await fn(); } catch { return null; }
}

publicRouter.get("/landing", async (_req, res) => {
  if (!cache || Date.now() - cache.at > 5 * 60 * 1000) {
    cache = {
      at: Date.now(),
      data: {
        questions: await safe(() => prisma.question.count()),
        utmeQuestions: await safe(() => prisma.utmeQuestion.count()),
        materials: await safe(() => prisma.resource.count()),
      },
    };
  }
  res.set("Cache-Control", "public, max-age=300");
  return res.json({ success: true, data: cache.data });
});
