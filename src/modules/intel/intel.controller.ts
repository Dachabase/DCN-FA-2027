import { Router, Request, Response } from "express";
import { optionalAuth, AuthenticatedRequest } from "../../auth/auth.middleware";
import {
  getCourseExamIntel,
  getFacultyExamIntel,
  getUniversityWideCbtIntel,
} from "./intel.service";

export const intelRouter = Router();

/**
 * GET /api/intel/courses/:courseIdOrCode
 * Returns topic frequency ranking, likelihood % ring, and personalized weak-area flags.
 */
intelRouter.get("/courses/:courseIdOrCode", optionalAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const courseIdentifier = String(req.params.courseIdOrCode);
    const userId = req.user?.id || null;

    const intel = await getCourseExamIntel(courseIdentifier, userId);
    res.json({ success: true, data: intel });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * GET /api/intel/faculties/:facultyIdOrCode
 * Returns faculty-wide intelligence, top tested courses, and cross-course high-yield topics.
 */
intelRouter.get("/faculties/:facultyIdOrCode", async (req: Request, res: Response) => {
  try {
    const facultyIdentifier = String(req.params.facultyIdOrCode);
    const intel = await getFacultyExamIntel(facultyIdentifier);
    res.json({ success: true, data: intel });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * GET /api/intel/ges-cbt
 * Returns university-wide CBT intelligence for all UI General Studies (GES) courses.
 */
intelRouter.get("/ges-cbt", async (_req: Request, res: Response) => {
  try {
    const intel = await getUniversityWideCbtIntel();
    res.json({ success: true, data: intel });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});
