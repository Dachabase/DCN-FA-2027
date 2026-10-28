import { Router, Request, Response } from "express";
import { optionalAuth, AuthenticatedRequest } from "../../auth/auth.middleware";
import {
  StartPracticeSessionSchema,
  SubmitAnswerSchema,
  CompleteSessionSchema,
} from "./practice.types";
import {
  startSession,
  submitAnswer,
  completeSession,
  getSessionHistory,
  getSessionDetails,
} from "./practice.service";

export const practiceRouter = Router();

/**
 * POST /api/practice/start
 * Starts a new Practice or CBT Exam simulation session.
 */
practiceRouter.post("/start", optionalAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const parseResult = StartPracticeSessionSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        success: false,
        message: "Invalid practice session configuration",
        errors: parseResult.error.issues,
      });
    }

    const userId = req.user?.id || null;
    const guestSessionId = (req.headers["x-guest-session-id"] as string) || null;

    const session = await startSession(userId, guestSessionId, parseResult.data);
    res.json({ success: true, data: session });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * POST /api/practice/:sessionId/answer
 * Submits an answer for a question with confidence rating.
 */
practiceRouter.post("/:sessionId/answer", optionalAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const parseResult = SubmitAnswerSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        success: false,
        message: "Invalid answer submission format",
        errors: parseResult.error.issues,
      });
    }

    const sessionId = String(req.params.sessionId);
    const userId = req.user?.id || null;

    const result = await submitAnswer(sessionId, userId, parseResult.data);
    res.json({ success: true, data: result });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * POST /api/practice/:sessionId/complete
 * Finishes a session and produces the performance diagnostic result slip.
 */
practiceRouter.post("/:sessionId/complete", optionalAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const parseResult = CompleteSessionSchema.safeParse(req.body);
    const sessionId = String(req.params.sessionId);
    const userId = req.user?.id || null;

    const result = await completeSession(
      sessionId,
      userId,
      parseResult.success ? parseResult.data : undefined
    );
    res.json({ success: true, data: result });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * GET /api/practice/history
 * Returns past practice and CBT exam sessions.
 */
practiceRouter.get("/history", optionalAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.id || null;
    const courseCode = req.query.courseCode ? String(req.query.courseCode) : undefined;
    const limit = req.query.limit ? parseInt(String(req.query.limit)) : 20;

    const history = await getSessionHistory(userId, courseCode, limit);
    res.json({ success: true, data: history });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * GET /api/practice/:sessionId
 * Retrieves full details of a session for review.
 */
practiceRouter.get("/:sessionId", optionalAuth, async (req: Request, res: Response) => {
  try {
    const sessionId = String(req.params.sessionId);
    const details = await getSessionDetails(sessionId);
    res.json({ success: true, data: details });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

