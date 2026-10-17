import fs from "fs";
import path from "path";
import { Response } from "express";
import { prisma } from "../database/prisma";

// Windows extended path helper for MAX_PATH (260 char limit)
function toWinLongPath(p: string): string {
  const abs = path.resolve(p);
  return process.platform === "win32" && !abs.startsWith("\\\\?\\") ? "\\\\?\\" + abs : abs;
}

export class Academic100lService {
  /**
   * 1. GET /api/vault/materials
   * Search, filter, and paginate the academic materials vault.
   */
  async getVaultMaterials(params: {
    facultyId?: string;
    departmentId?: string;
    courseCode?: string;
    category?: string;
    semester?: string;
    academicSession?: string;
    fileFormat?: string;
    search?: string;
    page?: number;
    limit?: number;
  }) {
    const page = Math.max(1, Number(params.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(params.limit) || 20));
    const skip = (page - 1) * limit;

    const where: any = {
      status: "PUBLISHED",
      audience: { has: "UI_100_LEVEL_STUDENT" },
    };

    if (params.facultyId && params.facultyId !== "ALL") {
      where.facultyId = params.facultyId;
    }
    if (params.departmentId && params.departmentId !== "ALL") {
      where.departmentId = params.departmentId;
    }
    if (params.courseCode && params.courseCode !== "ALL") {
      const codeClean = params.courseCode.toUpperCase().replace(/\s+/g, "");
      where.OR = [
        { courseCode: { equals: params.courseCode, mode: "insensitive" } },
        { courseCode: { contains: codeClean, mode: "insensitive" } },
      ];
    }
    if (params.category && params.category !== "ALL") {
      where.category = { equals: params.category, mode: "insensitive" };
    }
    if (params.fileFormat && params.fileFormat !== "ALL") {
      where.fileFormat = { equals: params.fileFormat.toLowerCase() };
    }
    if (params.semester && params.semester !== "ALL") {
      where.semester = { equals: params.semester, mode: "insensitive" };
    }
    if (params.search) {
      const q = params.search.trim();
      where.AND = [
        {
          OR: [
            { title: { contains: q, mode: "insensitive" } },
            { description: { contains: q, mode: "insensitive" } },
            { courseCode: { contains: q, mode: "insensitive" } },
            { tags: { has: q } },
          ],
        },
      ];
    }

    const [total, items] = await Promise.all([
      prisma.resource.count({ where }),
      prisma.resource.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ courseCode: "asc" }, { title: "asc" }],
        include: {
          faculty: { select: { id: true, name: true, code: true } },
          department: { select: { id: true, name: true } },
          course: { select: { id: true, code: true, title: true, semester: true } },
        },
      }),
    ]);

    // Format results with download & preview URLs
    const formatted = items.map((item) => ({
      ...item,
      fileViewUrl: item.filePath ? `/api/vault/file/${item.id}` : item.url,
      fileDownloadUrl: item.filePath ? `/api/vault/file/${item.id}?download=1` : item.url,
    }));

    return {
      items: formatted,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * 2. GET /api/vault/file/:id
   * Stream the original file securely from disk.
   */
  async serveVaultFile(id: string, res: Response, download: boolean = false) {
    const resource = await prisma.resource.findUnique({
      where: { id },
    });

    if (!resource) {
      return res.status(404).json({ success: false, error: "Material not found" });
    }

    if (!resource.filePath) {
      return res.redirect(resource.url || "/");
    }

    const longPath = toWinLongPath(resource.filePath);
    if (!fs.existsSync(longPath)) {
      console.warn(`File on disk missing: ${resource.filePath}, redirecting to fallback url.`);
      return res.redirect(resource.url || "/");
    }

    const ext = path.extname(resource.filePath).toLowerCase();
    const mimeMap: Record<string, string> = {
      ".pdf": "application/pdf",
      ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      ".doc": "application/msword",
      ".pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      ".ppt": "application/vnd.ms-powerpoint",
      ".jpg": "image/jpeg",
      ".jpeg": "image/jpeg",
      ".png": "image/png",
      ".txt": "text/plain",
      ".zip": "application/zip",
      ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    };

    const contentType = mimeMap[ext] || "application/octet-stream";
    const filename = path.basename(resource.filePath);
    const disposition = download ? "attachment" : "inline";

    res.setHeader("Content-Type", contentType);
    res.setHeader("Content-Disposition", `${disposition}; filename="${encodeURIComponent(filename)}"`);

    const stat = fs.statSync(longPath);
    res.setHeader("Content-Length", stat.size);

    const stream = fs.createReadStream(longPath);
    stream.pipe(res);
  }

  /**
   * 3. GET /api/100l/courses
   * Comprehensive course registry with live DB counts of materials, questions, and flashcards.
   */
  async getCourses(params: { facultyId?: string; semester?: string; search?: string }) {
    const where: any = { level: 100 };
    if (params.facultyId && params.facultyId !== "ALL") {
      where.facultyId = params.facultyId;
    }
    if (params.semester && params.semester !== "ALL") {
      where.semester = { equals: params.semester, mode: "insensitive" };
    }
    if (params.search) {
      const q = params.search.trim();
      where.OR = [
        { code: { contains: q, mode: "insensitive" } },
        { title: { contains: q, mode: "insensitive" } },
      ];
    }

    const courses = await prisma.course.findMany({
      where,
      orderBy: { code: "asc" },
      include: {
        faculty: { select: { id: true, name: true, code: true } },
        _count: {
          select: {
            resources: true,
            questions: true,
            flashcards: true,
          },
        },
      },
    });

    const questionCountsByCode = await prisma.question.groupBy({
      by: ["courseCode"],
      _count: { id: true },
    });
    const qCountMap = new Map<string, number>();
    for (const q of questionCountsByCode) {
      if (q.courseCode) {
        const cNorm = q.courseCode.toUpperCase().trim();
        const cClean = cNorm.replace(/\s+/g, "");
        qCountMap.set(cNorm, (qCountMap.get(cNorm) || 0) + q._count.id);
        qCountMap.set(cClean, (qCountMap.get(cClean) || 0) + q._count.id);
      }
    }

    // Also account for questions and resources linked via courseCode string match
    return courses.map((c) => {
      const cNorm = c.code.toUpperCase().trim();
      const cClean = cNorm.replace(/\s+/g, "");
      const cUnpre = cNorm.replace(/^C-/, "").trim();
      const cUnpreClean = cUnpre.replace(/\s+/g, "");

      const qByCode = qCountMap.get(cNorm) || qCountMap.get(cClean) || qCountMap.get(cUnpre) || qCountMap.get(cUnpreClean) || 0;
      const finalQuestionsCount = Math.max(c._count.questions, qByCode);

      return {
        id: c.id,
        code: c.code,
        title: c.title,
        level: c.level,
        semester: c.semester,
        units: c.units,
        status: c.status,
        isUniversityWide: c.isUniversityWide,
        faculty: c.faculty,
        materialsCount: c._count.resources,
        questionsCount: finalQuestionsCount,
        flashcardsCount: c._count.flashcards,
        hasCbt: finalQuestionsCount > 0,
        hasFlashcards: c._count.flashcards > 0,
      };
    });
  }

  /**
   * 4. GET /api/100l/courses/:code
   * Course detail page data with all linked materials, question stats, and flashcards.
   */
  async getCourseDetails(code: string, userId?: string) {
    const norm = code.toUpperCase().trim();
    const cleanCode = norm.replace(/\s+/g, "");

    const course = await prisma.course.findFirst({
      where: {
        OR: [
          { code: norm },
          { code: cleanCode },
          { code: { contains: cleanCode, mode: "insensitive" } },
        ],
      },
      include: {
        faculty: { select: { id: true, name: true, code: true } },
      },
    });

    const targetCode = course?.code || norm;

    // Fetch linked materials
    const materials = await prisma.resource.findMany({
      where: {
        OR: [
          { courseId: course?.id },
          { courseCode: { equals: targetCode, mode: "insensitive" } },
          { courseCode: { equals: cleanCode, mode: "insensitive" } },
        ],
        status: "PUBLISHED",
      },
      orderBy: [{ category: "asc" }, { title: "asc" }],
      select: {
        id: true,
        title: true,
        description: true,
        category: true,
        type: true,
        fileFormat: true,
        fileSize: true,
        pageCount: true,
        semester: true,
        academicSession: true,
        isScanned: true,
        hasQuestions: true,
        url: true,
        filePath: true,
      },
    });

    const formattedMaterials = materials.map((m) => ({
      ...m,
      fileViewUrl: m.filePath ? `/api/vault/file/${m.id}` : m.url,
      fileDownloadUrl: m.filePath ? `/api/vault/file/${m.id}?download=1` : m.url,
    }));

    // Fetch question statistics for this course
    const questions = await prisma.question.findMany({
      where: {
        OR: [
          { courseId: course?.id },
          { courseCode: { equals: targetCode, mode: "insensitive" } },
          { courseCode: { equals: cleanCode, mode: "insensitive" } },
        ],
      },
      select: {
        id: true,
        examYear: true,
        topic: true,
        type: true,
        difficulty: true,
      },
    });

    const yearsSet = new Set<number>();
    const topicsMap = new Map<string, number>();
    for (const q of questions) {
      if (q.examYear) yearsSet.add(q.examYear);
      const t = q.topic || "General Concepts";
      topicsMap.set(t, (topicsMap.get(t) || 0) + 1);
    }

    const availableYears = Array.from(yearsSet).sort((a, b) => b - a);
    const availableTopics = Array.from(topicsMap.entries()).map(([topic, count]) => ({
      topic,
      count,
    })).sort((a, b) => b.count - a.count);

    // Fetch flashcards count
    const flashcardsCount = await prisma.courseFlashcard.count({
      where: {
        OR: [
          { courseId: course?.id },
          { courseCode: { equals: targetCode, mode: "insensitive" } },
          { courseCode: { equals: cleanCode, mode: "insensitive" } },
        ],
      },
    });

    // If student is logged in, fetch their recent quiz attempts on this course
    let studentAttempts: any[] = [];
    if (userId) {
      studentAttempts = await prisma.quizAttempt.findMany({
        where: {
          userId,
          OR: [
            { courseId: course?.id },
            { courseCode: { equals: targetCode, mode: "insensitive" } },
          ],
        },
        orderBy: { createdAt: "desc" },
        take: 5,
        select: {
          id: true,
          mode: true,
          score: true,
          correctCount: true,
          wrongCount: true,
          totalQuestions: true,
          accuracyPercentage: true,
          timeSpentSeconds: true,
          createdAt: true,
        },
      });
    }

    return {
      course: course || {
        id: null,
        code: targetCode,
        title: `${targetCode} Academic Course`,
        level: 100,
        semester: "1st",
        units: 3,
        faculty: null,
      },
      materials: formattedMaterials,
      questionStats: {
        totalQuestions: questions.length,
        availableYears,
        availableTopics,
      },
      flashcardsCount,
      studentAttempts,
    };
  }

  /**
   * Helper to resolve course code variations (e.g. C-COS 101, COS 101, COS101)
   */
  async resolveCourseCandidates(courseCode: string) {
    const norm = courseCode.toUpperCase().trim();
    const cleanCode = norm.replace(/\s+/g, "");
    const unprefixed = norm.replace(/^C-/, "").trim();
    const unprefixedClean = unprefixed.replace(/\s+/g, "");

    const course = await prisma.course.findFirst({
      where: {
        OR: [
          { code: norm },
          { code: cleanCode },
          { code: unprefixed },
          { code: unprefixedClean },
          { code: { contains: unprefixedClean, mode: "insensitive" } },
        ],
      },
      select: { id: true, code: true, title: true },
    });

    const candidateCodes = Array.from(new Set([
      norm,
      cleanCode,
      unprefixed,
      unprefixedClean,
      course?.code,
      course?.code?.replace(/^C-/, ""),
      course?.code?.replace(/\s+/g, ""),
    ].filter(Boolean) as string[]));

    return { norm, cleanCode, unprefixed, course, candidateCodes };
  }

  /**
   * 5. GET /api/100l/cbt/config/:courseCode
   * Returns valid exam configuration parameters for course CBT.
   */
  async getCbtConfig(courseCode: string) {
    const { norm, course, candidateCodes } = await this.resolveCourseCandidates(courseCode);

    const questions = await prisma.question.findMany({
      where: {
        OR: [
          { courseCode: { in: candidateCodes, mode: "insensitive" } },
          ...(course?.id ? [{ courseId: course.id }] : []),
        ],
      },
      select: {
        id: true,
        examYear: true,
        topic: true,
      },
    });

    const yearsMap = new Map<number, number>();
    const topicsMap = new Map<string, number>();

    for (const q of questions) {
      if (q.examYear) {
        yearsMap.set(q.examYear, (yearsMap.get(q.examYear) || 0) + 1);
      }
      const t = q.topic || "General Concepts";
      topicsMap.set(t, (topicsMap.get(t) || 0) + 1);
    }

    const availableYears = Array.from(yearsMap.entries())
      .map(([year, count]) => ({ year, count }))
      .sort((a, b) => b.year - a.year);

    const availableTopics = Array.from(topicsMap.entries())
      .map(([topic, count]) => ({ topic, count }))
      .sort((a, b) => b.count - a.count);

    return {
      courseCode: norm,
      totalQuestions: questions.length,
      availableYears,
      availableTopics,
      supportedModes: [
        {
          mode: "FULL_CBT",
          name: "Full Timed Examination",
          description: "Comprehensive 40-question timed assessment mimicking authentic UI CBT halls.",
          defaultCount: Math.min(40, questions.length),
          defaultMinutes: 30,
        },
        {
          mode: "PAST_QUESTION_YEAR",
          name: "Past Question Paper Practice",
          description: "Practise authentic past examination questions from a specific academic year.",
          defaultCount: Math.min(30, questions.length),
          defaultMinutes: 25,
        },
        {
          mode: "TOPIC_PRACTICE",
          name: "Targeted Topic Revision",
          description: "Drill deep into a specific syllabus module or lecture unit.",
          defaultCount: Math.min(20, questions.length),
          defaultMinutes: 15,
        },
        {
          mode: "QUICK_DRILL",
          name: "Quick Practice Drill",
          description: "A fast 10-question sprint for on-the-go revision between lectures.",
          defaultCount: Math.min(10, questions.length),
          defaultMinutes: 10,
        },
        {
          mode: "MIXED_PRACTICE",
          name: "Multi-Year Mixed Drill",
          description: "Shuffled questions selected randomly across all available past exam years.",
          defaultCount: Math.min(25, questions.length),
          defaultMinutes: 20,
        },
      ],
    };
  }

  /**
   * 6. POST /api/100l/cbt/start
   * Start a CBT attempt and return sanitized questions (integrity preserved: NO answers sent!).
   */
  async startCbtAttempt(params: {
    courseCode: string;
    mode: string;
    examYear?: number;
    topic?: string;
    questionCount?: number;
    durationMinutes?: number;
    userId?: string;
    guestSessionId?: string;
  }) {
    const { norm, course, candidateCodes } = await this.resolveCourseCandidates(params.courseCode);

    const where: any = {
      OR: [
        { courseCode: { in: candidateCodes, mode: "insensitive" } },
        ...(course?.id ? [{ courseId: course.id }] : []),
      ],
    };

    if (params.mode === "PAST_QUESTION_YEAR" && params.examYear) {
      where.examYear = Number(params.examYear);
    }
    if (params.mode === "TOPIC_PRACTICE" && params.topic && params.topic !== "ALL") {
      where.topic = { contains: params.topic, mode: "insensitive" };
    }

    const allQuestions = await prisma.question.findMany({
      where,
      orderBy: { originalQuestionNumber: "asc" },
    });

    if (allQuestions.length === 0) {
      throw new Error(`No examination questions found for ${norm} matching your criteria.`);
    }

    // Determine count
    const requestedCount = Number(params.questionCount) || 30;
    const countToTake = Math.min(requestedCount, allQuestions.length);

    // If mode is PAST_QUESTION_YEAR without shuffle, preserve paper order
    let selectedQuestions = allQuestions;
    if (params.mode !== "PAST_QUESTION_YEAR") {
      // Fisher-Yates shuffle
      selectedQuestions = [...allQuestions].sort(() => 0.5 - Math.random());
    }
    selectedQuestions = selectedQuestions.slice(0, countToTake);

    const durationMinutes = Number(params.durationMinutes) || (countToTake <= 10 ? 10 : countToTake <= 20 ? 15 : 30);
    const timeAllowedSeconds = durationMinutes * 60;

    // Course record resolution for FK (resolved above)

    // Create QuizAttempt record in progress
    const attempt = await prisma.quizAttempt.create({
      data: {
        userId: params.userId || null,
        guestSessionId: params.guestSessionId || null,
        courseCode: norm,
        courseTitle: course?.title || `${norm} Examination`,
        courseId: course?.id || null,
        mode: params.mode || "EXAM",
        score: 0,
        totalQuestions: countToTake,
        correctCount: 0,
        wrongCount: 0,
        unansweredCount: countToTake,
        timeAllowedSeconds,
        timeSpentSeconds: 0,
        examYear: params.examYear || null,
        status: "IN_PROGRESS",
        questionsSnapshot: selectedQuestions.map((q) => q.id),
      },
    });

    // Sanitize questions: strip `correctAnswer` and `explanation`
    const sanitizedQuestions = selectedQuestions.map((q, idx) => ({
      id: q.id,
      index: idx + 1,
      courseCode: q.courseCode,
      topic: q.topic,
      type: q.type,
      questionText: q.questionText,
      options: q.options,
      examYear: q.examYear,
      semester: q.semester,
      passage: q.passage,
      hasImage: q.hasImage,
      imageUrl: q.imageUrl,
      sourceDocument: q.sourceDocument,
      sourcePage: q.sourcePage,
      originalQuestionNumber: q.originalQuestionNumber,
    }));

    return {
      attemptId: attempt.id,
      courseCode: norm,
      courseTitle: course?.title || `${norm} CBT Examination`,
      mode: params.mode,
      totalQuestions: countToTake,
      durationMinutes,
      timeAllowedSeconds,
      startedAt: attempt.createdAt,
      questions: sanitizedQuestions,
    };
  }

  /**
   * 7. POST /api/100l/cbt/submit
   * Grade attempt, calculate topic mastery, verify answers, and persist result.
   */
  async submitCbtAttempt(params: {
    attemptId?: string;
    courseCode: string;
    mode?: string;
    selectedAnswers: Record<string, string>;
    timeSpentSeconds: number;
    userId?: string;
    guestSessionId?: string;
  }) {
    const questionIds = Object.keys(params.selectedAnswers || {});
    if (questionIds.length === 0) {
      throw new Error("No questions submitted for grading.");
    }

    // Fetch the ground-truth questions from DB
    const questions = await prisma.question.findMany({
      where: { id: { in: questionIds } },
    });

    if (questions.length === 0) {
      throw new Error("Questions submitted could not be located in database.");
    }

    let correctCount = 0;
    let wrongCount = 0;
    let unansweredCount = 0;
    const topicPerformance: Record<string, { total: number; correct: number; percentage: number }> = {};

    const gradedQuestions = questions.map((q) => {
      const selected = (params.selectedAnswers[q.id] || "").trim().toUpperCase();
      const correct = (q.correctAnswer || "A").trim().toUpperCase();

      const isUnanswered = !selected;
      const isCorrect = !isUnanswered && (selected === correct || selected.startsWith(correct));

      if (isUnanswered) {
        unansweredCount++;
      } else if (isCorrect) {
        correctCount++;
      } else {
        wrongCount++;
      }

      // Topic performance tracking
      const topic = q.topic || "General Concepts";
      if (!topicPerformance[topic]) {
        topicPerformance[topic] = { total: 0, correct: 0, percentage: 0 };
      }
      topicPerformance[topic].total += 1;
      if (isCorrect) {
        topicPerformance[topic].correct += 1;
      }

      return {
        id: q.id,
        courseCode: q.courseCode,
        topic: q.topic,
        questionText: q.questionText,
        options: q.options,
        selectedAnswer: selected || null,
        correctAnswer: correct,
        isCorrect,
        isUnanswered,
        explanation: q.explanation,
        examYear: q.examYear,
        sourceDocument: q.sourceDocument,
        sourcePage: q.sourcePage,
        verificationStatus: q.verificationStatus,
      };
    });

    // Compute percentages
    for (const t in topicPerformance) {
      const topicData = topicPerformance[t];
      topicData.percentage = Math.round((topicData.correct / topicData.total) * 100);
    }

    const totalQuestions = questions.length;
    const score = Math.round((correctCount / totalQuestions) * 1000) / 10; // e.g. 82.5%
    const accuracyPercentage = score;

    // Update or create QuizAttempt
    let savedAttempt: any;
    if (params.attemptId) {
      savedAttempt = await prisma.quizAttempt.update({
        where: { id: params.attemptId },
        data: {
          score,
          accuracyPercentage,
          correctCount,
          wrongCount,
          unansweredCount,
          timeSpentSeconds: Number(params.timeSpentSeconds) || 0,
          status: "SUBMITTED",
          selectedAnswers: params.selectedAnswers,
          topicPerformance,
          submittedAt: new Date(),
        },
      });
    } else {
      const course = await prisma.course.findFirst({
        where: { code: { equals: params.courseCode, mode: "insensitive" } },
      });
      savedAttempt = await prisma.quizAttempt.create({
        data: {
          userId: params.userId || null,
          guestSessionId: params.guestSessionId || null,
          courseCode: params.courseCode.toUpperCase(),
          courseTitle: course?.title || `${params.courseCode} Examination`,
          courseId: course?.id || null,
          mode: params.mode || "EXAM",
          score,
          totalQuestions,
          correctCount,
          wrongCount,
          unansweredCount,
          accuracyPercentage,
          timeSpentSeconds: Number(params.timeSpentSeconds) || 0,
          status: "SUBMITTED",
          selectedAnswers: params.selectedAnswers,
          topicPerformance,
          submittedAt: new Date(),
        },
      });
    }

    return {
      attemptId: savedAttempt.id,
      courseCode: params.courseCode.toUpperCase(),
      score,
      accuracyPercentage,
      totalQuestions,
      correctCount,
      wrongCount,
      unansweredCount,
      timeSpentSeconds: Number(params.timeSpentSeconds) || 0,
      topicPerformance,
      review: gradedQuestions,
      submittedAt: savedAttempt.submittedAt,
    };
  }

  /**
   * 8. GET /api/100l/cbt/attempts
   * Retrieve previous assessment history for authenticated student or guest.
   */
  async getStudentAttempts(userId?: string, guestSessionId?: string, courseCode?: string) {
    if (!userId && !guestSessionId) {
      return [];
    }

    const where: any = {
      status: "SUBMITTED",
    };

    if (userId) {
      where.userId = userId;
    } else if (guestSessionId) {
      where.guestSessionId = guestSessionId;
    }

    if (courseCode && courseCode !== "ALL") {
      where.courseCode = { equals: courseCode, mode: "insensitive" };
    }

    return prisma.quizAttempt.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 50,
      select: {
        id: true,
        courseCode: true,
        courseTitle: true,
        mode: true,
        score: true,
        accuracyPercentage: true,
        totalQuestions: true,
        correctCount: true,
        wrongCount: true,
        unansweredCount: true,
        timeSpentSeconds: true,
        timeAllowedSeconds: true,
        topicPerformance: true,
        createdAt: true,
        submittedAt: true,
      },
    });
  }

  /**
   * 9. GET /api/100l/flashcards/:courseCode
   * Retrieve flashcards for a specific course with user's learning status.
   */
  async getCourseFlashcards(courseCode: string, userId?: string, topic?: string) {
    const norm = courseCode.toUpperCase().trim();
    const cleanCode = norm.replace(/\s+/g, "");

    const where: any = {
      OR: [
        { courseCode: { equals: norm, mode: "insensitive" } },
        { courseCode: { equals: cleanCode, mode: "insensitive" } },
      ],
    };

    if (topic && topic !== "ALL") {
      where.topic = { contains: topic, mode: "insensitive" };
    }

    const flashcards = await prisma.courseFlashcard.findMany({
      where,
      orderBy: [{ topic: "asc" }, { createdAt: "asc" }],
      include: userId
        ? {
            progress: {
              where: { userId },
              select: { status: true, timesReviewed: true, lastReviewedAt: true },
            },
          }
        : undefined,
    });

    return flashcards.map((f: any) => ({
      id: f.id,
      courseCode: f.courseCode,
      courseTitle: f.courseTitle,
      topic: f.topic,
      front: f.front,
      back: f.back,
      explanation: f.explanation,
      sourceDocument: f.sourceDocument,
      sourcePage: f.sourcePage,
      difficulty: f.difficulty,
      status: f.progress && f.progress.length > 0 ? f.progress[0].status : "NEEDS_REVISION",
      timesReviewed: f.progress && f.progress.length > 0 ? f.progress[0].timesReviewed : 0,
    }));
  }

  /**
   * 10. POST /api/100l/flashcards/:cardId/progress
   * Update flashcard review status (KNOWN vs NEEDS_REVISION).
   */
  async updateFlashcardProgress(userId: string, cardId: string, status: "KNOWN" | "NEEDS_REVISION") {
    return prisma.courseFlashcardProgress.upsert({
      where: {
        userId_cardId: { userId, cardId },
      },
      update: {
        status,
        timesReviewed: { increment: 1 },
        lastReviewedAt: new Date(),
      },
      create: {
        userId,
        cardId,
        status,
        timesReviewed: 1,
        lastReviewedAt: new Date(),
      },
    });
  }

  /**
   * 11. GET /api/100l/admin/inventory
   * Master inventory and audit summary for administrators.
   */
  async getAdminInventory() {
    const [totalResources, totalQuestions, totalFlashcards, totalCourses, totalFaculties] =
      await Promise.all([
        prisma.resource.count({ where: { audience: { has: "UI_100_LEVEL_STUDENT" } } }),
        prisma.question.count(),
        prisma.courseFlashcard.count(),
        prisma.course.count({ where: { level: 100 } }),
        prisma.faculty.count(),
      ]);

    // Categories breakdown
    const categories = await prisma.resource.groupBy({
      by: ["category"],
      where: { audience: { has: "UI_100_LEVEL_STUDENT" } },
      _count: { id: true },
      orderBy: { _count: { id: "desc" } },
    });

    // Formats breakdown
    const formats = await prisma.resource.groupBy({
      by: ["fileFormat"],
      where: { audience: { has: "UI_100_LEVEL_STUDENT" } },
      _count: { id: true },
      orderBy: { _count: { id: "desc" } },
    });

    // Questions per course
    const questionsPerCourse = await prisma.question.groupBy({
      by: ["courseCode"],
      _count: { id: true },
      orderBy: { _count: { id: "desc" } },
      take: 20,
    });

    return {
      summary: {
        totalMaterials: totalResources,
        totalQuestions,
        totalFlashcards,
        total100LCourses: totalCourses,
        totalFaculties,
      },
      categories: categories.map((c) => ({ category: c.category, count: c._count.id })),
      formats: formats.map((f) => ({ format: f.fileFormat || "other", count: f._count.id })),
      topQuestionCourses: questionsPerCourse.map((q) => ({ courseCode: q.courseCode, questions: q._count.id })),
    };
  }
}

export const academic100lService = new Academic100lService();
