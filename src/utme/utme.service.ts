import { prisma } from "../database/prisma";
import crypto from "crypto";

export interface StartExamOptions {
  userId?: string | null;
  guestSessionId?: string | null;
  courseSlug?: string;
  customSubjectCodes?: string[];
  mode?: "FULL_UTME_SIMULATION" | "PRACTICE_MODE" | "TOPIC_REVISION";
  institutionName?: string;
  topic?: string;
}

export class UtmeService {
  // 1. Get Course Combinations (Searchable & Filterable)
  async getCourseCombinations(search?: string, faculty?: string) {
    const where: any = {};
    if (search) {
      where.OR = [
        { courseName: { contains: search, mode: "insensitive" } },
        { facultyName: { contains: search, mode: "insensitive" } },
        { compulsorySubjects: { hasSome: [search] } },
      ];
    }
    if (faculty && faculty !== "ALL") {
      where.facultyName = { contains: faculty, mode: "insensitive" };
    }

    return await prisma.utmeCourseCombination.findMany({
      where,
      orderBy: { courseName: "asc" },
    });
  }

  // 2. Get All Subjects with Question Counts
  async getSubjects() {
    const subjects = await prisma.utmeSubject.findMany({
      orderBy: [{ isCompulsory: "desc" }, { name: "asc" }],
      include: {
        _count: {
          select: { questions: true },
        },
      },
    });

    return subjects.map((s) => ({
      ...s,
      availableQuestionsCount: s._count.questions,
    }));
  }

  // 3. Start a Mock Exam (Full Simulation or Practice Mode)
  async startMockExam(options: StartExamOptions) {
    const mode = options.mode || "FULL_UTME_SIMULATION";
    let subjectCodes: string[] = [];
    let courseName = "General UTME Preparation";

    if (options.courseSlug) {
      const courseComb = await prisma.utmeCourseCombination.findUnique({
        where: { slug: options.courseSlug },
      });
      if (courseComb) {
        subjectCodes = courseComb.subjectCodes;
        courseName = courseComb.courseName;
      }
    }

    if (options.customSubjectCodes && options.customSubjectCodes.length > 0) {
      subjectCodes = options.customSubjectCodes;
    }

    // Default UTME standard: ENG is always compulsory
    if (!subjectCodes.includes("ENG")) {
      subjectCodes.unshift("ENG");
    }

    // Ensure 4 subjects for FULL UTME
    if (mode === "FULL_UTME_SIMULATION" && subjectCodes.length < 4) {
      const fallbacks = ["MTH", "PHY", "CHM", "BIO", "ECO", "GOV"];
      for (const f of fallbacks) {
        if (!subjectCodes.includes(f)) {
          subjectCodes.push(f);
          if (subjectCodes.length === 4) break;
        }
      }
    }

    // Determine question counts and time
    // Standard UTME: ENG has 60 questions, others 40 questions = 180 questions, 120 minutes.
    // Practice mode: ENG has 15 questions, others 10 questions = 45 questions, 35 minutes.
    const isFull = mode === "FULL_UTME_SIMULATION";
    const durationMinutes = isFull ? 120 : 35;
    const expiresAt = new Date(Date.now() + durationMinutes * 60 * 1000);

    const questionsList: any[] = [];
    const questionsSnapshot: any[] = [];

    for (const code of subjectCodes) {
      const targetCount = isFull ? (code === "ENG" ? 60 : 40) : (code === "ENG" ? 15 : 10);

      // Fetch randomized questions for this subject
      // To ensure high quality, only published questions
      const pool = await prisma.utmeQuestion.findMany({
        where: {
          subjectCode: code,
          publicationStatus: "PUBLISHED",
          ...(options.topic ? { topic: { contains: options.topic, mode: "insensitive" } } : {}),
        },
        select: {
          id: true,
          subjectCode: true,
          subjectName: true,
          topic: true,
          examYear: true,
          questionText: true,
          passage: true,
          options: true,
          correctAnswer: true,
          explanation: true,
          whyOthersIncorrect: true,
          hasImage: true,
          imageUrl: true,
          sourceDocument: true,
          sourcePage: true,
          originalQuestionNumber: true,
        },
      });

      // Controlled shuffle
      const shuffled = pool.sort(() => Math.random() - 0.5).slice(0, targetCount);

      for (let idx = 0; idx < shuffled.length; idx++) {
        const q = shuffled[idx];
        const studentView = {
          id: q.id,
          subjectCode: q.subjectCode,
          subjectName: q.subjectName,
          topic: q.topic,
          examYear: q.examYear,
          questionText: q.questionText,
          passage: q.passage,
          options: q.options,
          hasImage: q.hasImage,
          imageUrl: q.imageUrl,
          orderIndex: questionsList.length + 1,
        };
        questionsList.push(studentView);

        // Immutable server snapshot with answers securely stored
        questionsSnapshot.push({
          id: q.id,
          subjectCode: q.subjectCode,
          subjectName: q.subjectName,
          topic: q.topic,
          examYear: q.examYear,
          questionText: q.questionText,
          passage: q.passage,
          options: q.options,
          correctAnswer: q.correctAnswer,
          explanation: q.explanation,
          whyOthersIncorrect: q.whyOthersIncorrect,
          sourceDocument: q.sourceDocument,
          sourcePage: q.sourcePage,
          originalQuestionNumber: q.originalQuestionNumber,
          orderIndex: questionsList.length,
        });
      }
    }

    const totalQuestions = questionsList.length;

    // Create Attempt record in Database
    const attempt = await prisma.utmeExamAttempt.create({
      data: {
        userId: options.userId || null,
        guestSessionId: options.guestSessionId || `guest_${crypto.randomBytes(8).toString("hex")}`,
        courseName,
        institutionName: options.institutionName || "University of Ibadan (UI)",
        mode: mode as any,
        subjectCodes,
        totalQuestions,
        durationMinutes,
        expiresAt,
        status: "IN_PROGRESS",
        questionsSnapshot,
      },
    });

    return {
      attemptId: attempt.id,
      guestSessionId: attempt.guestSessionId,
      courseName: attempt.courseName,
      institutionName: attempt.institutionName,
      mode: attempt.mode,
      subjectCodes: attempt.subjectCodes,
      totalQuestions: attempt.totalQuestions,
      durationMinutes: attempt.durationMinutes,
      startedAt: attempt.startedAt,
      expiresAt: attempt.expiresAt,
      questions: questionsList, // Clean student view without answers
    };
  }

  // 4. Save or Update Student Response in Real-Time
  async saveResponse(attemptId: string, questionId: string, selectedOption: string | null, isMarkedForReview = false) {
    const attempt = await prisma.utmeExamAttempt.findUnique({
      where: { id: attemptId },
    });

    if (!attempt || attempt.status !== "IN_PROGRESS") {
      throw new Error("Exam attempt is not active or already submitted");
    }

    // Verify time has not expired (with 30-second network grace period)
    if (Date.now() > attempt.expiresAt.getTime() + 30000) {
      await this.submitExam(attemptId);
      throw new Error("Time has expired. Examination submitted automatically.");
    }

    // Upsert response
    const snapshot = (attempt.questionsSnapshot as any[]) || [];
    const questionMeta = snapshot.find((q) => q.id === questionId);
    const subjectCode = questionMeta?.subjectCode || "GEN";

    return await prisma.utmeExamResponse.upsert({
      where: {
        attemptId_questionId: {
          attemptId,
          questionId,
        },
      },
      update: {
        selectedOption,
        isMarkedForReview,
        updatedAt: new Date(),
      },
      create: {
        attemptId,
        questionId,
        subjectCode,
        selectedOption,
        isMarkedForReview,
      },
    });
  }

  // 5. Get Active Attempt State (For page reload recovery)
  async getExamState(attemptId: string) {
    const attempt = await prisma.utmeExamAttempt.findUnique({
      where: { id: attemptId },
      include: { responses: true },
    });

    if (!attempt) {
      throw new Error("Exam attempt not found");
    }

    const now = Date.now();
    const remainingSeconds = Math.max(0, Math.floor((attempt.expiresAt.getTime() - now) / 1000));

    // Return student view questions (strip answers from snapshot)
    const snapshot = (attempt.questionsSnapshot as any[]) || [];
    const sanitizedQuestions = snapshot.map((q) => ({
      id: q.id,
      subjectCode: q.subjectCode,
      subjectName: q.subjectName,
      topic: q.topic,
      examYear: q.examYear,
      questionText: q.questionText,
      passage: q.passage,
      options: q.options,
      hasImage: q.hasImage,
      imageUrl: q.imageUrl,
      orderIndex: q.orderIndex,
    }));

    const responsesMap: Record<string, { selectedOption: string | null; isMarkedForReview: boolean }> = {};
    for (const r of attempt.responses) {
      responsesMap[r.questionId] = {
        selectedOption: r.selectedOption,
        isMarkedForReview: r.isMarkedForReview,
      };
    }

    return {
      attemptId: attempt.id,
      courseName: attempt.courseName,
      institutionName: attempt.institutionName,
      mode: attempt.mode,
      status: attempt.status,
      subjectCodes: attempt.subjectCodes,
      totalQuestions: attempt.totalQuestions,
      durationMinutes: attempt.durationMinutes,
      startedAt: attempt.startedAt,
      expiresAt: attempt.expiresAt,
      remainingSeconds,
      questions: sanitizedQuestions,
      savedResponses: responsesMap,
    };
  }

  // 6. Submit Exam & Grade Server-Side (Phase 8 & Phase 10)
  async submitExam(attemptId: string) {
    const attempt = await prisma.utmeExamAttempt.findUnique({
      where: { id: attemptId },
      include: { responses: true },
    });

    if (!attempt) {
      throw new Error("Exam attempt not found");
    }

    if (attempt.status === "SUBMITTED") {
      return await this.getExamResults(attemptId);
    }

    const snapshot = (attempt.questionsSnapshot as any[]) || [];
    const responseMap = new Map<string, string | null>();
    for (const r of attempt.responses) {
      responseMap.set(r.questionId, r.selectedOption);
    }

    let correctCount = 0;
    let incorrectCount = 0;
    let unansweredCount = 0;

    const subjectStats: Record<string, { subjectName: string; total: number; correct: number; incorrect: number; unanswered: number; scaledScore: number }> = {};
    const topicStats: Record<string, { total: number; correct: number }> = {};

    // Initialize subject buckets
    for (const code of attempt.subjectCodes) {
      const sample = snapshot.find((q) => q.subjectCode === code);
      subjectStats[code] = {
        subjectName: sample?.subjectName || code,
        total: 0,
        correct: 0,
        incorrect: 0,
        unanswered: 0,
        scaledScore: 0,
      };
    }

    // Evaluate each question against snapshot
    for (const q of snapshot) {
      const code = q.subjectCode;
      const topic = q.topic || "General";
      const selected = responseMap.get(q.id) || null;

      if (!subjectStats[code]) {
        subjectStats[code] = { subjectName: q.subjectName, total: 0, correct: 0, incorrect: 0, unanswered: 0, scaledScore: 0 };
      }
      if (!topicStats[topic]) {
        topicStats[topic] = { total: 0, correct: 0 };
      }

      subjectStats[code].total += 1;
      topicStats[topic].total += 1;

      const isCorrect = selected !== null && selected.trim().toUpperCase() === q.correctAnswer.trim().toUpperCase();

      if (selected === null || selected === "") {
        unansweredCount += 1;
        subjectStats[code].unanswered += 1;
      } else if (isCorrect) {
        correctCount += 1;
        subjectStats[code].correct += 1;
        topicStats[topic].correct += 1;
      } else {
        incorrectCount += 1;
        subjectStats[code].incorrect += 1;
      }

      // Update response record in DB with correctness flag
      await prisma.utmeExamResponse.upsert({
        where: {
          attemptId_questionId: {
            attemptId,
            questionId: q.id,
          },
        },
        update: {
          isCorrect,
        },
        create: {
          attemptId,
          questionId: q.id,
          subjectCode: code,
          selectedOption: selected,
          isCorrect,
        },
      });
    }

    // Scale subject scores to official JAMB 100-mark scale per subject (Max 400 total)
    let aggregateScore = 0;
    for (const code in subjectStats) {
      const s = subjectStats[code];
      const scaled = s.total > 0 ? Math.round((s.correct / s.total) * 100) : 0;
      s.scaledScore = scaled;
      aggregateScore += scaled;
    }

    const accuracyPercentage = snapshot.length > 0 ? Math.round((correctCount / snapshot.length) * 100) : 0;
    const submittedAt = new Date();
    const timeSpentSeconds = Math.min(
      attempt.durationMinutes * 60,
      Math.max(0, Math.floor((submittedAt.getTime() - attempt.startedAt.getTime()) / 1000))
    );

    // Save final scores to attempt
    await prisma.utmeExamAttempt.update({
      where: { id: attemptId },
      data: {
        status: "SUBMITTED",
        submittedAt,
        scoreTotal: correctCount,
        scoreAggregate: aggregateScore,
        accuracyPercentage,
        correctCount,
        incorrectCount,
        unansweredCount,
        timeSpentSeconds,
        subjectScores: subjectStats,
        topicPerformance: topicStats,
      },
    });

    return await this.getExamResults(attemptId);
  }

  // 7. Get Comprehensive Exam Results
  async getExamResults(attemptId: string) {
    const attempt = await prisma.utmeExamAttempt.findUnique({
      where: { id: attemptId },
    });

    if (!attempt) {
      throw new Error("Exam attempt not found");
    }

    return {
      attemptId: attempt.id,
      courseName: attempt.courseName,
      institutionName: attempt.institutionName,
      mode: attempt.mode,
      status: attempt.status,
      startedAt: attempt.startedAt,
      submittedAt: attempt.submittedAt,
      timeSpentSeconds: attempt.timeSpentSeconds,
      timeSpentFormatted: `${Math.floor(attempt.timeSpentSeconds / 60)}m ${attempt.timeSpentSeconds % 60}s`,
      totalQuestions: attempt.totalQuestions,
      correctCount: attempt.correctCount || 0,
      incorrectCount: attempt.incorrectCount || 0,
      unansweredCount: attempt.unansweredCount || 0,
      rawScore: attempt.scoreTotal || 0,
      aggregateScore: attempt.scoreAggregate || 0,
      maxScore: attempt.subjectCodes.length * 100, // e.g. 400 for full 4 subjects
      accuracyPercentage: attempt.accuracyPercentage || 0,
      subjectScores: attempt.subjectScores,
      topicPerformance: attempt.topicPerformance,
    };
  }

  // 8. Detailed Review with Step-by-Step Educational Explanations (Phase 8 & 9)
  async getExamReview(attemptId: string, filter?: "ALL" | "CORRECT" | "INCORRECT" | "UNANSWERED", subjectCode?: string) {
    const attempt = await prisma.utmeExamAttempt.findUnique({
      where: { id: attemptId },
      include: { responses: true },
    });

    if (!attempt) {
      throw new Error("Exam attempt not found");
    }

    if (attempt.status !== "SUBMITTED") {
      throw new Error("Examination must be submitted before answers and explanations can be reviewed.");
    }

    const snapshot = (attempt.questionsSnapshot as any[]) || [];
    const responseMap = new Map<string, { selectedOption: string | null; isMarkedForReview: boolean }>();
    for (const r of attempt.responses) {
      responseMap.set(r.questionId, {
        selectedOption: r.selectedOption,
        isMarkedForReview: r.isMarkedForReview,
      });
    }

    let reviewItems = snapshot.map((q) => {
      const resp = responseMap.get(q.id);
      const studentAnswer = resp?.selectedOption || null;
      const isCorrect = studentAnswer !== null && studentAnswer.trim().toUpperCase() === q.correctAnswer.trim().toUpperCase();
      const isUnanswered = studentAnswer === null || studentAnswer === "";

      return {
        id: q.id,
        orderIndex: q.orderIndex,
        subjectCode: q.subjectCode,
        subjectName: q.subjectName,
        topic: q.topic,
        examYear: q.examYear,
        sourceDocument: q.sourceDocument,
        sourcePage: q.sourcePage,
        originalQuestionNumber: q.originalQuestionNumber,
        questionText: q.questionText,
        passage: q.passage,
        options: q.options,
        studentAnswer,
        correctAnswer: q.correctAnswer,
        isCorrect,
        isUnanswered,
        explanation: q.explanation,
        whyOthersIncorrect: q.whyOthersIncorrect,
      };
    });

    if (subjectCode && subjectCode !== "ALL") {
      reviewItems = reviewItems.filter((item) => item.subjectCode === subjectCode);
    }

    if (filter === "CORRECT") {
      reviewItems = reviewItems.filter((item) => item.isCorrect);
    } else if (filter === "INCORRECT") {
      reviewItems = reviewItems.filter((item) => !item.isCorrect && !item.isUnanswered);
    } else if (filter === "UNANSWERED") {
      reviewItems = reviewItems.filter((item) => item.isUnanswered);
    }

    return {
      attemptId: attempt.id,
      courseName: attempt.courseName,
      aggregateScore: attempt.scoreAggregate,
      accuracyPercentage: attempt.accuracyPercentage,
      totalReviewed: reviewItems.length,
      questions: reviewItems,
    };
  }

  // 9. Admin Stats Dashboard (Phase 9)
  async getAdminStats() {
    const totalQuestions = await prisma.utmeQuestion.count();
    const subjects = await prisma.utmeSubject.findMany({
      include: {
        _count: { select: { questions: true } },
      },
      orderBy: { name: "asc" },
    });

    const statusCounts = await prisma.utmeQuestion.groupBy({
      by: ["verificationStatus"],
      _count: true,
    });

    const pubCounts = await prisma.utmeQuestion.groupBy({
      by: ["publicationStatus"],
      _count: true,
    });

    const attemptsCount = await prisma.utmeExamAttempt.count();
    const completedAttemptsCount = await prisma.utmeExamAttempt.count({
      where: { status: "SUBMITTED" },
    });

    return {
      totalQuestions,
      totalSubjects: subjects.length,
      totalCourseCombinations: await prisma.utmeCourseCombination.count(),
      totalExamAttempts: attemptsCount,
      completedAttempts: completedAttemptsCount,
      subjectsBreakdown: subjects.map((s) => ({
        code: s.code,
        name: s.name,
        count: s._count.questions,
      })),
      verificationBreakdown: statusCounts.reduce((acc, curr) => {
        acc[curr.verificationStatus] = curr._count;
        return acc;
      }, {} as Record<string, number>),
      publicationBreakdown: pubCounts.reduce((acc, curr) => {
        acc[curr.publicationStatus] = curr._count;
        return acc;
      }, {} as Record<string, number>),
    };
  }
}

export const utmeService = new UtmeService();
