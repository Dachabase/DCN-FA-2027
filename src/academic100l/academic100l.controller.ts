import { Router, Request, Response } from "express";
import { requireAdmin } from "../auth/staff";
import { academic100lService } from "./academic100l.service";
import { optionalAuth, requireAuth } from "../auth/auth.middleware";
import { prisma } from "../database/prisma";

export const academic100lRouter = Router();
export const vaultRouter = Router();

// =========================================================
// VAULT ROUTES (/api/vault)
// =========================================================

// GET /api/vault/materials - Filtered and paginated materials
vaultRouter.get("/materials", optionalAuth, async (req: Request, res: Response) => {
  try {
    const { facultyId, departmentId, courseCode, category, semester, academicSession, fileFormat, search, page, limit } = req.query;
    const result = await academic100lService.getVaultMaterials({
      facultyId: facultyId ? String(facultyId) : undefined,
      departmentId: departmentId ? String(departmentId) : undefined,
      courseCode: courseCode ? String(courseCode) : undefined,
      category: category ? String(category) : undefined,
      semester: semester ? String(semester) : undefined,
      academicSession: academicSession ? String(academicSession) : undefined,
      fileFormat: fileFormat ? String(fileFormat) : undefined,
      search: search ? String(search) : undefined,
      page: page ? Number(page) : 1,
      limit: limit ? Number(limit) : 24,
    });
    res.json({ success: true, ...result });
  } catch (error: any) {
    console.error("Error fetching vault materials:", error);
    res.status(500).json({ success: false, error: "Failed to fetch vault materials" });
  }
});

// GET /api/vault/file/:id - Securely stream file or redirect
vaultRouter.get("/file/:id", async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id);
    const download = req.query.download === "1" || req.query.download === "true";
    await academic100lService.serveVaultFile(id, res, download);
  } catch (error: any) {
    console.error("Error serving vault file:", error);
    res.status(500).json({ success: false, error: "Failed to stream document" });
  }
});

// GET /api/vault/material/:id - Single material metadata
vaultRouter.get("/material/:id", async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id);
    const resource = await prisma.resource.findUnique({
      where: { id },
      include: {
        faculty: { select: { id: true, name: true, code: true } },
        department: { select: { id: true, name: true } },
        course: { select: { id: true, code: true, title: true, semester: true } },
      },
    });
    if (!resource) {
      return res.status(404).json({ success: false, error: "Material not found" });
    }
    res.json({
      success: true,
      data: {
        ...resource,
        fileViewUrl: resource.filePath ? `/api/vault/file/${resource.id}` : resource.url,
        fileDownloadUrl: resource.filePath ? `/api/vault/file/${resource.id}?download=1` : resource.url,
      },
    });
  } catch (error: any) {
    console.error("Error fetching material:", error);
    res.status(500).json({ success: false, error: "Failed to fetch material" });
  }
});

// =========================================================
// 100L ACADEMIC & COURSE ROUTES (/api/100l)
// =========================================================

// GET /api/100l/courses - Comprehensive course directory with live counts
academic100lRouter.get("/courses", optionalAuth, async (req: Request, res: Response) => {
  try {
    const { facultyId, semester, search } = req.query;
    const courses = await academic100lService.getCourses({
      facultyId: facultyId ? String(facultyId) : undefined,
      semester: semester ? String(semester) : undefined,
      search: search ? String(search) : undefined,
    });
    res.json({ success: true, count: courses.length, data: courses });
  } catch (error: any) {
    console.error("Error fetching 100L courses:", error);
    res.status(500).json({ success: false, error: "Failed to fetch courses" });
  }
});

// GET /api/100l/courses/:code - Full course detail page with materials, questions, flashcards
academic100lRouter.get("/courses/:code", optionalAuth, async (req: Request, res: Response) => {
  try {
    const code = String(req.params.code);
    const userId = (req as any).user?.id;
    const details = await academic100lService.getCourseDetails(code, userId);
    res.json({ success: true, data: details });
  } catch (error: any) {
    console.error(`Error fetching course details for ${req.params.code}:`, error);
    res.status(500).json({ success: false, error: "Failed to fetch course details" });
  }
});

// =========================================================
// 100L CBT ENGINE ROUTES (/api/100l/cbt)
// =========================================================

// GET /api/100l/cbt/config/:courseCode - Exam configuration options
academic100lRouter.get("/cbt/config/:courseCode", optionalAuth, async (req: Request, res: Response) => {
  try {
    const courseCode = String(req.params.courseCode);
    const config = await academic100lService.getCbtConfig(courseCode);
    res.json({ success: true, data: config });
  } catch (error: any) {
    console.error("Error fetching CBT config:", error);
    res.status(500).json({ success: false, error: "Failed to load examination config" });
  }
});

// POST /api/100l/cbt/start - Begin CBT assessment (Integrity: no answers leaked)
academic100lRouter.post("/cbt/start", optionalAuth, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const { courseCode, mode, examYear, topic, questionCount, durationMinutes, guestSessionId } = req.body;

    if (!courseCode) {
      return res.status(400).json({ success: false, error: "Course code is required." });
    }

    const session = await academic100lService.startCbtAttempt({
      courseCode: String(courseCode),
      mode: String(mode || "FULL_CBT"),
      examYear: examYear ? Number(examYear) : undefined,
      topic: topic ? String(topic) : undefined,
      questionCount: questionCount ? Number(questionCount) : undefined,
      durationMinutes: durationMinutes ? Number(durationMinutes) : undefined,
      userId: user?.id,
      guestSessionId: guestSessionId ? String(guestSessionId) : undefined,
    });

    res.json({ success: true, data: session });
  } catch (error: any) {
    console.error("Error starting CBT attempt:", error);
    res.status(400).json({ success: false, error: error.message || "Failed to start examination" });
  }
});

// POST /api/100l/cbt/submit - Submit for grading, explanation review, and result persistence
academic100lRouter.post("/cbt/submit", optionalAuth, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const { attemptId, courseCode, mode, selectedAnswers, timeSpentSeconds, guestSessionId } = req.body;

    if (!courseCode || !selectedAnswers) {
      return res.status(400).json({ success: false, error: "Missing courseCode or selectedAnswers" });
    }

    const result = await academic100lService.submitCbtAttempt({
      attemptId: attemptId ? String(attemptId) : undefined,
      courseCode: String(courseCode),
      mode: mode ? String(mode) : "EXAM",
      selectedAnswers: selectedAnswers || {},
      timeSpentSeconds: Number(timeSpentSeconds) || 0,
      userId: user?.id,
      guestSessionId: guestSessionId ? String(guestSessionId) : undefined,
    });

    res.json({ success: true, data: result });
  } catch (error: any) {
    console.error("Error submitting CBT attempt:", error);
    res.status(400).json({ success: false, error: error.message || "Failed to grade assessment" });
  }
});

// GET /api/100l/cbt/attempts - Assessment history and progress
academic100lRouter.get("/cbt/attempts", optionalAuth, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const guestSessionId = req.query.guestSessionId ? String(req.query.guestSessionId) : undefined;
    const courseCode = req.query.courseCode ? String(req.query.courseCode) : undefined;

    const attempts = await academic100lService.getStudentAttempts(user?.id, guestSessionId, courseCode);
    res.json({ success: true, count: attempts.length, data: attempts });
  } catch (error: any) {
    console.error("Error fetching CBT attempts:", error);
    res.status(500).json({ success: false, error: "Failed to load attempts" });
  }
});

// =========================================================
// 100L FLASHCARDS ROUTES (/api/100l/flashcards)
// =========================================================

// GET /api/100l/flashcards/:courseCode - Study deck for a course
academic100lRouter.get("/flashcards/:courseCode", optionalAuth, async (req: Request, res: Response) => {
  try {
    const courseCode = String(req.params.courseCode);
    const userId = (req as any).user?.id;
    const topic = req.query.topic ? String(req.query.topic) : undefined;

    const cards = await academic100lService.getCourseFlashcards(courseCode, userId, topic);
    res.json({ success: true, count: cards.length, data: cards });
  } catch (error: any) {
    console.error("Error fetching flashcards:", error);
    res.status(500).json({ success: false, error: "Failed to load flashcards" });
  }
});

// POST /api/100l/flashcards/:cardId/progress - Mark card known vs revision
academic100lRouter.post("/flashcards/:cardId/progress", requireAuth, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const cardId = String(req.params.cardId);
    const status = req.body.status === "KNOWN" ? "KNOWN" : "NEEDS_REVISION";

    const progress = await academic100lService.updateFlashcardProgress(user.id, cardId, status);
    res.json({ success: true, data: progress });
  } catch (error: any) {
    console.error("Error updating flashcard progress:", error);
    res.status(500).json({ success: false, error: "Failed to update study progress" });
  }
});

// =========================================================
// 100L ADMIN & INVENTORY ROUTES (/api/100l/admin)
// =========================================================

// GET /api/100l/admin/inventory - Master inventory summary
academic100lRouter.get("/admin/inventory", requireAdmin, async (req: Request, res: Response) => {
  try {
    const inventory = await academic100lService.getAdminInventory();
    res.json({ success: true, data: inventory });
  } catch (error: any) {
    console.error("Error fetching admin inventory:", error);
    res.status(500).json({ success: false, error: "Failed to load inventory summary" });
  }
});
