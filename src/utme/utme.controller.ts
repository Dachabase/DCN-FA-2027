import { Router, Request, Response } from "express";
import { utmeService } from "./utme.service";
import { optionalAuth, requireAuth } from "../auth/auth.middleware";
import { prisma } from "../database/prisma";

export const utmeRouter = Router();

// =========================================================
// 1. COURSE COMBINATIONS (Public / Open Discovery)
// =========================================================
utmeRouter.get("/courses", async (req: Request, res: Response) => {
  try {
    const search = (req.query.search || req.query.q || req.query.query) ? String(req.query.search || req.query.q || req.query.query).trim() : undefined;
    const faculty = req.query.faculty ? String(req.query.faculty).trim() : undefined;
    const courses = await utmeService.getCourseCombinations(search, faculty);
    res.json({ success: true, count: courses.length, data: courses });
  } catch (error: any) {
    console.error("Error fetching UTME course combinations:", error);
    res.status(500).json({ success: false, error: "Failed to fetch course combinations" });
  }
});

utmeRouter.get("/courses/:slug", async (req: Request, res: Response) => {
  try {
    const slug = String(req.params.slug);
    const course = await prisma.utmeCourseCombination.findUnique({
      where: { slug },
    });
    if (!course) {
      return res.status(404).json({ success: false, error: "Course combination not found" });
    }
    res.json({ success: true, data: course });
  } catch (error: any) {
    console.error("Error fetching course combination:", error);
    res.status(500).json({ success: false, error: "Failed to fetch course details" });
  }
});

// =========================================================
// 2. UTME SUBJECTS
// =========================================================
utmeRouter.get("/subjects", async (req: Request, res: Response) => {
  try {
    const subjects = await utmeService.getSubjects();
    res.json({ success: true, data: subjects });
  } catch (error: any) {
    console.error("Error fetching UTME subjects:", error);
    res.status(500).json({ success: false, error: "Failed to fetch subjects" });
  }
});

// =========================================================
// 3. START MOCK EXAMINATION (Full Simulation or Practice)
// =========================================================
utmeRouter.post("/exam/start", optionalAuth, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const { courseSlug, customSubjectCodes, mode, institutionName, topic, guestSessionId } = req.body;

    const examData = await utmeService.startMockExam({
      userId: user?.id || null,
      guestSessionId: guestSessionId || null,
      courseSlug,
      customSubjectCodes,
      mode,
      institutionName,
      topic,
    });

    res.json({
      success: true,
      message: "UTME Mock Examination started successfully.",
      data: examData,
    });
  } catch (error: any) {
    console.error("Error starting UTME exam:", error);
    res.status(500).json({ success: false, error: error.message || "Failed to start examination" });
  }
});

// =========================================================
// 4. GET ACTIVE EXAM STATE (Reload recovery)
// =========================================================
utmeRouter.get("/exam/:id/state", optionalAuth, async (req: Request, res: Response) => {
  try {
    const attemptId = String(req.params.id);
    const state = await utmeService.getExamState(attemptId);
    res.json({ success: true, data: state });
  } catch (error: any) {
    console.error("Error getting exam state:", error);
    res.status(404).json({ success: false, error: error.message || "Exam attempt not found" });
  }
});

// =========================================================
// 5. SAVE REAL-TIME RESPONSE
// =========================================================
utmeRouter.post("/exam/:id/save-answer", optionalAuth, async (req: Request, res: Response) => {
  try {
    const attemptId = String(req.params.id);
    const { questionId, selectedOption, isMarkedForReview } = req.body;

    if (!questionId) {
      return res.status(400).json({ success: false, error: "Missing questionId parameter" });
    }

    const response = await utmeService.saveResponse(attemptId, questionId, selectedOption, isMarkedForReview);
    res.json({ success: true, data: response });
  } catch (error: any) {
    console.error("Error saving exam answer:", error);
    res.status(400).json({ success: false, error: error.message || "Failed to save response" });
  }
});

// =========================================================
// 6. SUBMIT EXAMINATION & SERVER-SIDE SCORING
// =========================================================
utmeRouter.post("/exam/:id/submit", optionalAuth, async (req: Request, res: Response) => {
  try {
    const attemptId = String(req.params.id);
    const results = await utmeService.submitExam(attemptId);
    res.json({
      success: true,
      message: "Examination successfully submitted and graded.",
      data: results,
    });
  } catch (error: any) {
    console.error("Error submitting exam:", error);
    res.status(500).json({ success: false, error: error.message || "Failed to submit examination" });
  }
});

// =========================================================
// 7. GET RESULTS SUMMARY
// =========================================================
utmeRouter.get("/exam/:id/results", optionalAuth, async (req: Request, res: Response) => {
  try {
    const attemptId = String(req.params.id);
    const results = await utmeService.getExamResults(attemptId);
    res.json({ success: true, data: results });
  } catch (error: any) {
    console.error("Error fetching exam results:", error);
    res.status(404).json({ success: false, error: error.message || "Results not found" });
  }
});

// =========================================================
// 8. DETAILED POST-EXAMINATION ANSWER REVIEW
// =========================================================
utmeRouter.get("/exam/:id/review", optionalAuth, async (req: Request, res: Response) => {
  try {
    const attemptId = String(req.params.id);
    const filter = (req.query.filter as any) || "ALL";
    const subjectCode = (req.query.subjectCode as string) || "ALL";

    const review = await utmeService.getExamReview(attemptId, filter, subjectCode);
    res.json({ success: true, data: review });
  } catch (error: any) {
    console.error("Error fetching review:", error);
    res.status(400).json({ success: false, error: error.message || "Failed to load review" });
  }
});

// =========================================================
// 9. CONTENT ADMINISTRATION (Phase 9 & 10)
// =========================================================
utmeRouter.get("/admin/stats", async (req: Request, res: Response) => {
  try {
    const stats = await utmeService.getAdminStats();
    res.json({ success: true, data: stats });
  } catch (error: any) {
    console.error("Error fetching admin stats:", error);
    res.status(500).json({ success: false, error: "Failed to fetch admin stats" });
  }
});

utmeRouter.get("/admin/questions", async (req: Request, res: Response) => {
  try {
    const { subjectCode, examYear, topic, search, page = "1", limit = "20" } = req.query;
    const pageNum = parseInt(String(page), 10) || 1;
    const pageSize = parseInt(String(limit), 10) || 20;

    const where: any = {};
    if (subjectCode && subjectCode !== "ALL") where.subjectCode = String(subjectCode);
    if (examYear && examYear !== "ALL") where.examYear = parseInt(String(examYear), 10);
    if (topic && topic !== "ALL") where.topic = { contains: String(topic), mode: "insensitive" };
    if (search) {
      where.OR = [
        { questionText: { contains: String(search), mode: "insensitive" } },
        { explanation: { contains: String(search), mode: "insensitive" } },
      ];
    }

    const [total, questions] = await Promise.all([
      prisma.utmeQuestion.count({ where }),
      prisma.utmeQuestion.findMany({
        where,
        skip: (pageNum - 1) * pageSize,
        take: pageSize,
        orderBy: [{ subjectCode: "asc" }, { examYear: "desc" }, { originalQuestionNumber: "asc" }],
      }),
    ]);

    res.json({
      success: true,
      total,
      page: pageNum,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
      data: questions,
    });
  } catch (error: any) {
    console.error("Error querying questions:", error);
    res.status(500).json({ success: false, error: "Failed to query questions" });
  }
});

utmeRouter.put("/admin/questions/:id", async (req: Request, res: Response) => {
  try {
    const questionId = String(req.params.id);
    const { questionText, options, correctAnswer, explanation, whyOthersIncorrect, topic, verificationStatus, publicationStatus } = req.body;

    const updated = await prisma.utmeQuestion.update({
      where: { id: questionId },
      data: {
        ...(questionText ? { questionText: String(questionText) } : {}),
        ...(Array.isArray(options) ? { options } : {}),
        ...(correctAnswer ? { correctAnswer: String(correctAnswer).toUpperCase() } : {}),
        ...(explanation ? { explanation: String(explanation) } : {}),
        ...(whyOthersIncorrect !== undefined ? { whyOthersIncorrect: String(whyOthersIncorrect) } : {}),
        ...(topic ? { topic: String(topic) } : {}),
        ...(verificationStatus ? { verificationStatus: verificationStatus as any } : {}),
        ...(publicationStatus ? { publicationStatus: publicationStatus as any } : {}),
        updatedAt: new Date(),
      },
    });

    res.json({ success: true, message: "Question successfully updated.", data: updated });
  } catch (error: any) {
    console.error("Error updating question:", error);
    res.status(500).json({ success: false, error: "Failed to update question" });
  }
});
