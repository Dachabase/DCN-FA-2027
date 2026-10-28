import { Router, Response } from "express";
import { AuthenticatedRequest, requireAuth } from "../../auth/auth.middleware";
import {
  getReviewQueueSummary,
  resolveReviewItem,
  enqueueQuestionForReview,
} from "./review.service";
import { awardAnswerXp } from "../gamification/gamification.service";

export const reviewRouter = Router();

// GET /api/review/queue - Returns student's review counts and active due cards
reviewRouter.get("/queue", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const summary = await getReviewQueueSummary(userId);
    res.json({ success: true, data: summary });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// POST /api/review/:questionId/resolve - Record spaced review attempt
reviewRouter.post("/:questionId/resolve", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const questionId = String(req.params.questionId);
    const { isCorrect, confidence } = req.body;

    if (typeof isCorrect !== "boolean") {
      return res.status(400).json({ success: false, message: "isCorrect boolean is required" });
    }

    const result = await resolveReviewItem(userId, questionId, {
      isCorrect,
      confidence: typeof confidence === "number" ? confidence : 2,
    });

    // Also award standard 10 XP for the recall drill
    const gamificationUpdate = await awardAnswerXp(userId, 10);

    res.json({
      success: true,
      data: {
        review: result,
        gamification: gamificationUpdate,
      },
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// POST /api/review/:questionId/enqueue - Manually flag a question for spaced review
reviewRouter.post("/:questionId/enqueue", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const questionId = String(req.params.questionId);

    const item = await enqueueQuestionForReview(userId, questionId);
    res.json({ success: true, data: item });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});
