import { Router, Request, Response } from "express";
import { optionalAuth, requireAuth, AuthenticatedRequest } from "../../auth/auth.middleware";
import { CreateLessonSchema } from "./lessons.types";
import {
  listCourseLessons,
  getLessonDetails,
  markLessonComplete,
  upsertLesson,
} from "./lessons.service";

export const lessonsRouter = Router();

/**
 * GET /api/lessons/course/:courseCodeOrId
 * Lists all lessons in a course syllabus with progress markers.
 */
lessonsRouter.get("/course/:courseCodeOrId", optionalAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const courseIdentifier = String(req.params.courseCodeOrId);
    const userId = req.user?.id || null;

    const lessons = await listCourseLessons(courseIdentifier, userId);
    res.json({ success: true, data: lessons });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * GET /api/lessons/:lessonId
 * Retrieves full lesson content with embedded diagnostic check questions.
 */
lessonsRouter.get("/:lessonId", optionalAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const lessonId = String(req.params.lessonId);
    const userId = req.user?.id || null;

    const lesson = await getLessonDetails(lessonId, userId);
    res.json({ success: true, data: lesson });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * POST /api/lessons/:lessonId/complete
 * Marks a lesson complete, logs interaction, and awards +20 XP.
 */
lessonsRouter.post("/:lessonId/complete", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const lessonId = String(req.params.lessonId);
    const userId = req.user!.id;
    const readDurationSeconds = req.body.readDurationSeconds || 60;

    const result = await markLessonComplete(lessonId, userId, readDurationSeconds);
    res.json({ success: true, data: result });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * POST /api/lessons
 * Creates or updates a syllabus lesson guide.
 */
lessonsRouter.post("/", optionalAuth, async (req: Request, res: Response) => {
  try {
    const parseResult = CreateLessonSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        success: false,
        message: "Invalid lesson payload",
        errors: parseResult.error.issues,
      });
    }

    const lesson = await upsertLesson(parseResult.data);
    res.json({ success: true, data: lesson });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

