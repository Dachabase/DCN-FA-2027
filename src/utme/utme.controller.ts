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
// 3. START MOCK EXAMINATION (Full Simulation, Flexible Practice, or Quick Drill)
// =========================================================
utmeRouter.post("/exam/start", optionalAuth, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const {
      courseSlug,
      customSubjectCodes,
      mode,
      institutionName,
      topic,
      difficulty,
      durationMinutes,
      questionCount,
      isInstantFeedback,
      examType,
      guestSessionId,
    } = req.body;

    const examData = await utmeService.startMockExam({
      userId: user?.id || null,
      guestSessionId: guestSessionId || null,
      courseSlug,
      customSubjectCodes,
      mode,
      institutionName,
      topic,
      difficulty,
      durationMinutes: durationMinutes ? Number(durationMinutes) : undefined,
      questionCount: questionCount ? Number(questionCount) : undefined,
      isInstantFeedback: Boolean(isInstantFeedback),
      examType,
    });

    res.json({
      success: true,
      message: "UTME Examination started successfully.",
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
// 5b. SAVE ACTIVE QUESTION POSITION (Reload & App-Switch Recovery)
// =========================================================
utmeRouter.post("/exam/:id/position", optionalAuth, async (req: Request, res: Response) => {
  try {
    const attemptId = String(req.params.id);
    const { currentQuestionIndex } = req.body;
    await utmeService.savePosition(attemptId, Number(currentQuestionIndex) || 0);
    res.json({ success: true });
  } catch (error: any) {
    console.error("Error saving exam position:", error);
    res.status(500).json({ success: false, error: "Failed to save position" });
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
// 8b. FLASHCARDS API
// =========================================================
utmeRouter.get("/flashcards/deck", optionalAuth, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const { subjectCode, topic, filter, limit } = req.query;
    const deck = await utmeService.getFlashcardsDeck({
      subjectCode: subjectCode ? String(subjectCode) : undefined,
      topic: topic ? String(topic) : undefined,
      filter: (filter as any) || "ALL",
      limit: limit ? Number(limit) : 30,
      userId: user?.id || null,
    });
    res.json({ success: true, count: deck.length, data: deck });
  } catch (error: any) {
    console.error("Error fetching flashcards:", error);
    res.status(500).json({ success: false, error: "Failed to load flashcard deck" });
  }
});

utmeRouter.post("/flashcards/rate", requireAuth, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const { questionId, status, subjectCode, topic } = req.body;
    if (!questionId || !status || !subjectCode) {
      return res.status(400).json({ success: false, error: "Missing required fields" });
    }
    const result = await utmeService.rateFlashcard({
      userId: user.id,
      questionId: String(questionId),
      status: status === "KNOWN" ? "KNOWN" : "NEEDS_REVISION",
      subjectCode: String(subjectCode),
      topic: topic ? String(topic) : undefined,
    });
    res.json({ success: true, data: result });
  } catch (error: any) {
    console.error("Error rating flashcard:", error);
    res.status(500).json({ success: false, error: "Failed to save flashcard rating" });
  }
});

utmeRouter.get("/flashcards/progress", optionalAuth, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (!user) {
      return res.json({ success: true, data: { totalCardsStudied: 0, knownCards: 0, needsRevisionCards: 0, masteryRate: 0 } });
    }
    const subjectCode = req.query.subjectCode ? String(req.query.subjectCode) : undefined;
    const progress = await utmeService.getFlashcardProgress(user.id, subjectCode);
    res.json({ success: true, data: progress });
  } catch (error: any) {
    console.error("Error fetching flashcard progress:", error);
    res.status(500).json({ success: false, error: "Failed to load flashcard progress" });
  }
});

// =========================================================
// 8c. PROGRESS DASHBOARD & LONG-TERM PERFORMANCE API
// =========================================================
utmeRouter.get("/progress/dashboard", optionalAuth, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (!user) {
      return res.json({
        success: true,
        data: {
          isGuest: true,
          totalAttempts: 0,
          totalQuestionsAnswered: 0,
          totalCorrectAnswers: 0,
          overallAccuracy: 0,
          averageScore400: 0,
          subjectBreakdown: [],
          strengths: [],
          weaknesses: [],
          history: [],
          flashcardMetrics: { totalCardsStudied: 0, knownCards: 0, needsRevisionCards: 0, masteryRate: 0 },
        },
      });
    }
    const dashboard = await utmeService.getProgressDashboard(user.id);
    res.json({ success: true, data: { ...dashboard, isGuest: false } });
  } catch (error: any) {
    console.error("Error fetching progress dashboard:", error);
    res.status(500).json({ success: false, error: "Failed to load progress dashboard" });
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
