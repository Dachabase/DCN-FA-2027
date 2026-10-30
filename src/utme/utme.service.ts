import { prisma } from "../database/prisma";
import crypto from "crypto";

export interface StartExamOptions {
  userId?: string | null;
  guestSessionId?: string | null;
  courseSlug?: string;
  customSubjectCodes?: string[];
  mode?: "FULL_UTME_SIMULATION" | "PRACTICE_MODE" | "TOPIC_REVISION" | "QUICK_DRILL" | "CUSTOM";
  durationMinutes?: number;
  questionCount?: number;
  institutionName?: string;
  topic?: string;
  difficulty?: string;
  isInstantFeedback?: boolean;
  examType?: string;
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

  // 3. Start a Mock Exam (Full Simulation, Flexible Practice, or Quick Drill)
  async startMockExam(options: StartExamOptions) {
    const mode = options.mode || "FULL_UTME_SIMULATION";
    let subjectCodes: string[] = [];
    let courseName = "General UTME Preparation";

    if (options.courseSlug) {
      const courseComb = await prisma.utmeCourseCombination.findUnique({
        where: { slug: options.courseSlug },
      });
      if (courseComb) {
        subjectCodes = [...courseComb.subjectCodes];
        courseName = courseComb.courseName;
      }
    }

    if (options.customSubjectCodes && options.customSubjectCodes.length > 0) {
      subjectCodes = [...options.customSubjectCodes];
    }

    // Default UTME standard: ENG is compulsory for full simulations
    if (mode === "FULL_UTME_SIMULATION" && !subjectCodes.includes("ENG")) {
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

    // Default fallback if no subject selected
    if (subjectCodes.length === 0) {
      subjectCodes = ["ENG", "BIO", "CHM", "PHY"];
    }

    // Determine duration: 15m, 30m, 45m, 60m, 120m, or custom
    const isFull = mode === "FULL_UTME_SIMULATION";
    let durationMinutes = options.durationMinutes || (isFull ? 120 : (mode === "QUICK_DRILL" ? 15 : 35));
    if (durationMinutes < 1) durationMinutes = 15;
    const expiresAt = new Date(Date.now() + durationMinutes * 60 * 1000);

    // Determine target question count matching selected duration or explicit configuration
    let totalTargetQuestions = options.questionCount;
    if (!totalTargetQuestions) {
      if (isFull) {
        totalTargetQuestions = 180;
      } else if (durationMinutes <= 15) {
        totalTargetQuestions = subjectCodes.length === 1 ? 15 : 20;
      } else if (durationMinutes <= 30) {
        totalTargetQuestions = subjectCodes.length === 1 ? 30 : 40;
      } else if (durationMinutes <= 45) {
        totalTargetQuestions = 60;
      } else if (durationMinutes <= 60) {
        totalTargetQuestions = 90;
      } else {
        totalTargetQuestions = 180;
      }
    }

    // Allocate question targets per subject
    const subjectTargets: Record<string, number> = {};
    if (subjectCodes.length === 1) {
      subjectTargets[subjectCodes[0]] = totalTargetQuestions;
    } else if (isFull && subjectCodes.includes("ENG") && totalTargetQuestions === 180) {
      subjectTargets["ENG"] = 60;
      const otherCount = Math.floor(120 / (subjectCodes.length - 1));
      for (const c of subjectCodes) {
        if (c !== "ENG") subjectTargets[c] = otherCount;
      }
    } else {
      const basePerSub = Math.floor(totalTargetQuestions / subjectCodes.length);
      let remainder = totalTargetQuestions % subjectCodes.length;
      for (const c of subjectCodes) {
        subjectTargets[c] = basePerSub + (remainder > 0 ? 1 : 0);
        if (remainder > 0) remainder--;
      }
    }

    const questionsList: any[] = [];
    const questionsSnapshot: any[] = [];

    // Robust deduplication tracker across the entire mock examination
    const selectedQuestionIds = new Set<string>();
    const selectedNormalizedTexts = new Set<string>();
    const selectedGroupIds = new Set<string>();

    const normalizeText = (txt: string): string => {
      return (txt || "")
        .toLowerCase()
        .replace(/[\u2018\u2019]/g, "'")
        .replace(/[\u201C\u201D]/g, '"')
        .replace(/\s+/g, " ")
        .trim();
    };

    // Recency tracking: query questions candidate saw in their last 3 attempts
    const recentSeenIds = new Set<string>();
    try {
      if (options.userId || options.guestSessionId) {
        const pastAttempts = await prisma.utmeExamAttempt.findMany({
          where: {
            OR: [
              options.userId ? { userId: options.userId } : {},
              options.guestSessionId ? { guestSessionId: options.guestSessionId } : {},
            ],
          },
          select: { questionsSnapshot: true },
          take: 3,
          orderBy: { createdAt: "desc" },
        });

        for (const pa of pastAttempts) {
          const snaps = (pa.questionsSnapshot as any[]) || [];
          for (const sq of snaps) {
            if (sq.id) recentSeenIds.add(sq.id);
          }
        }
      }
    } catch (e) {
      // Non-blocking fallback
    }

    for (const code of subjectCodes) {
      const targetCount = subjectTargets[code] || 10;
      const subjectSelected: any[] = [];

      if (code === "ENG") {
        // =========================================================
        // ENGLISH LANGUAGE: GROUP-AWARE STRUCTURED SELECTION
        // Preserves shared passages, question groups & logical ordering
        // =========================================================
        const compTarget = Math.max(1, Math.min(Math.floor(targetCount * 0.35), 15));
        let compCount = 0;

        // Fetch published comprehension groups with reading passages (excluding unverified/flagged)
        const compGroups = await prisma.utmeQuestionGroup.findMany({
          where: {
            subjectCode: "ENG",
            sectionType: "COMPREHENSION",
            passage: { not: null },
            id: { notIn: Array.from(selectedGroupIds) },
          },
          include: {
            questions: {
              where: {
                publicationStatus: "PUBLISHED",
                verificationStatus: { not: "NEEDS_REVIEW" },
              },
              orderBy: [{ groupOrder: "asc" }, { originalQuestionNumber: "asc" }],
            },
          },
        });

        // Shuffle groups as cohesive units
        const shuffledGroups = compGroups.sort(() => Math.random() - 0.5);

        for (const group of shuffledGroups) {
          if (compCount >= compTarget) break;
          const groupQs = group.questions.filter((q) => {
            const norm = normalizeText(q.questionText);
            return !selectedQuestionIds.has(q.id) && !selectedNormalizedTexts.has(norm);
          });

          if (groupQs.length >= 2) {
            selectedGroupIds.add(group.id);
            // Keep the group questions together in original sequential order
            for (const q of groupQs) {
              if (compCount >= compTarget) break;
              const norm = normalizeText(q.questionText);
              selectedQuestionIds.add(q.id);
              selectedNormalizedTexts.add(norm);
              subjectSelected.push(q);
              compCount++;
            }
          }
        }

        // Fill remaining English target count with structured Lexis, Synonyms, Antonyms & Oral English
        const remainingNeeded = targetCount - subjectSelected.length;
        if (remainingNeeded > 0) {
          const pool = await prisma.utmeQuestion.findMany({
            where: {
              subjectCode: "ENG",
              publicationStatus: "PUBLISHED",
              verificationStatus: { not: "NEEDS_REVIEW" },
              groupId: null,
              passage: null,
              id: { notIn: Array.from(selectedQuestionIds) },
            },
          });

          // Filter duplicates and prioritize unseen
          const available = pool.filter((q) => !selectedNormalizedTexts.has(normalizeText(q.questionText)));
          const unseen = available.filter((q) => !recentSeenIds.has(q.id));
          const candidatePool = unseen.length >= remainingNeeded ? unseen : available;
          const shuffledOther = candidatePool.sort(() => Math.random() - 0.5);

          for (const q of shuffledOther) {
            if (subjectSelected.length >= targetCount) break;
            const norm = normalizeText(q.questionText);
            if (!selectedQuestionIds.has(q.id) && !selectedNormalizedTexts.has(norm)) {
              selectedQuestionIds.add(q.id);
              selectedNormalizedTexts.add(norm);
              subjectSelected.push(q);
            }
          }
        }
      } else {
        // =========================================================
        // OTHER SUBJECTS (Math, Physics, Chemistry, Biology, etc.)
        // Distinct randomized selection with deduplication & recency
        // =========================================================
        const pool = await prisma.utmeQuestion.findMany({
          where: {
            subjectCode: code,
            publicationStatus: "PUBLISHED",
            verificationStatus: { not: "NEEDS_REVIEW" },
            id: { notIn: Array.from(selectedQuestionIds) },
            ...(options.topic && options.topic !== "ALL" ? { topic: { contains: options.topic, mode: "insensitive" } } : {}),
          },
        });

        // Deduplicate against already selected texts
        const distinctPool = pool.filter((q) => !selectedNormalizedTexts.has(normalizeText(q.questionText)));

        // Prioritize unseen questions if pool is sufficient
        const unseen = distinctPool.filter((q) => !recentSeenIds.has(q.id));
        const candidatePool = unseen.length >= targetCount ? unseen : distinctPool;
        const shuffled = candidatePool.sort(() => Math.random() - 0.5);

        for (const q of shuffled) {
          if (subjectSelected.length >= targetCount) break;
          const norm = normalizeText(q.questionText);
          if (!selectedQuestionIds.has(q.id) && !selectedNormalizedTexts.has(norm)) {
            selectedQuestionIds.add(q.id);
            selectedNormalizedTexts.add(norm);
            subjectSelected.push(q);
          }
        }
      }

      // Add to overall exam list and snapshot with full visual and grouping metadata
      for (const q of subjectSelected) {
        const studentView: any = {
          id: q.id,
          subjectCode: q.subjectCode,
          subjectName: q.subjectName,
          topic: q.topic,
          examYear: q.examYear,
          questionText: q.questionText,
          passage: q.passage || null,
          sectionName: q.sectionName || null,
          sectionType: q.sectionType || null,
          skillTag: q.skillTag || null,
          options: q.options,
          hasImage: q.hasImage || false,
          imageUrl: q.imageUrl || null,
          orderIndex: questionsList.length + 1,
        };
        if (options.isInstantFeedback) {
          studentView.correctAnswer = q.correctAnswer;
          studentView.explanation = q.explanation;
        }
        questionsList.push(studentView);

        // Immutable server snapshot with answers securely stored
        questionsSnapshot.push({
          id: q.id,
          subjectCode: q.subjectCode,
          subjectName: q.subjectName,
          topic: q.topic,
          examYear: q.examYear,
          questionText: q.questionText,
          passage: q.passage || null,
          sectionName: q.sectionName || null,
          sectionType: q.sectionType || null,
          skillTag: q.skillTag || null,
          options: q.options,
          correctAnswer: q.correctAnswer,
          explanation: q.explanation,
          whyOthersIncorrect: q.whyOthersIncorrect,
          hasImage: q.hasImage || false,
          imageUrl: q.imageUrl || null,
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
        mode: (mode === "FULL_UTME_SIMULATION" ? "FULL_UTME_SIMULATION" : (mode === "TOPIC_REVISION" ? "TOPIC_REVISION" : "PRACTICE_MODE")) as any,
        subjectCodes,
        totalQuestions,
        durationMinutes,
        expiresAt,
        status: "IN_PROGRESS",
        currentQuestionIndex: 0,
        isInstantFeedback: options.isInstantFeedback || false,
        examType: options.examType || (isFull ? "MOCK_SIMULATION" : mode === "QUICK_DRILL" ? "QUICK_DRILL" : "PRACTICE"),
        questionsSnapshot,
      },
    });

    return {
      attemptId: attempt.id,
      guestSessionId: attempt.guestSessionId,
      courseName: attempt.courseName,
      institutionName: attempt.institutionName,
      mode: attempt.mode,
      examType: attempt.examType,
      isInstantFeedback: attempt.isInstantFeedback,
      currentQuestionIndex: 0,
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

    // Return student view questions (strip answers from snapshot unless instant feedback mode)
    const snapshot = (attempt.questionsSnapshot as any[]) || [];
    const sanitizedQuestions = snapshot.map((q) => {
      const item: any = {
        id: q.id,
        subjectCode: q.subjectCode,
        subjectName: q.subjectName,
        topic: q.topic,
        examYear: q.examYear,
        questionText: q.questionText,
        passage: q.passage || null,
        sectionName: q.sectionName || null,
        sectionType: q.sectionType || null,
        skillTag: q.skillTag || null,
        options: q.options,
        hasImage: q.hasImage || false,
        imageUrl: q.imageUrl || null,
        orderIndex: q.orderIndex,
      };
      if (attempt.isInstantFeedback) {
        item.correctAnswer = q.correctAnswer;
        item.explanation = q.explanation;
      }
      return item;
    });

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
      currentQuestionIndex: attempt.currentQuestionIndex || 0,
      isInstantFeedback: attempt.isInstantFeedback || false,
      examType: attempt.examType || "MOCK_SIMULATION",
      startedAt: attempt.startedAt,
      expiresAt: attempt.expiresAt,
      remainingSeconds,
      questions: sanitizedQuestions,
      savedResponses: responsesMap,
    };
  }

  // 5b. Save Current Question Index / Position (App-switch & reload recovery)
  async savePosition(attemptId: string, currentQuestionIndex: number) {
    return await prisma.utmeExamAttempt.update({
      where: { id: attemptId },
      data: { currentQuestionIndex: Math.max(0, currentQuestionIndex) },
    });
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

    const subjectStats: Record<string, { subjectName: string; total: number; correct: number; incorrect: number; unanswered: number; scaledScore: number; englishAnalytics?: any }> = {};
    const topicStats: Record<string, { total: number; correct: number }> = {};
    const englishSectionStats: Record<string, { total: number; correct: number; percentage: number }> = {};
    const englishSkillStats: Record<string, { total: number; correct: number; percentage: number }> = {};

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

      // English section and skill metrics
      if (code === "ENG") {
        const sec = q.sectionName || "Section B: Lexis and Structure";
        const skill = q.skillTag || "General English Proficiency";
        if (!englishSectionStats[sec]) englishSectionStats[sec] = { total: 0, correct: 0, percentage: 0 };
        if (!englishSkillStats[skill]) englishSkillStats[skill] = { total: 0, correct: 0, percentage: 0 };
        englishSectionStats[sec].total += 1;
        englishSkillStats[skill].total += 1;
      }

      const isCorrect = selected !== null && selected.trim().toUpperCase() === q.correctAnswer.trim().toUpperCase();

      if (selected === null || selected === "") {
        unansweredCount += 1;
        subjectStats[code].unanswered += 1;
      } else if (isCorrect) {
        correctCount += 1;
        subjectStats[code].correct += 1;
        topicStats[topic].correct += 1;
        if (code === "ENG") {
          const sec = q.sectionName || "Section B: Lexis and Structure";
          const skill = q.skillTag || "General English Proficiency";
          englishSectionStats[sec].correct += 1;
          englishSkillStats[skill].correct += 1;
        }
      } else {
        incorrectCount += 1;
        subjectStats[code].incorrect += 1;
      }

      // Collect response evaluations
    }

    // Update response records in DB in parallel chunks for maximum speed
    const responseOps = snapshot.map((q) => {
      const code = q.subjectCode;
      const selected = responseMap.get(q.id) || null;
      const isCorrect = selected !== null && selected.trim().toUpperCase() === q.correctAnswer.trim().toUpperCase();
      return prisma.utmeExamResponse.upsert({
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
    });

    for (let i = 0; i < responseOps.length; i += 25) {
      await Promise.all(responseOps.slice(i, i + 25));
    }

    // Scale subject scores to official JAMB 100-mark scale per subject (Max 400 total)
    let aggregateScore = 0;
    for (const code in subjectStats) {
      const s = subjectStats[code];
      const scaled = s.total > 0 ? Math.round((s.correct / s.total) * 100) : 0;
      s.scaledScore = scaled;
      aggregateScore += scaled;
    }

    // Finalize English Analytics percentages and structure as arrays
    for (const k in englishSectionStats) {
      const st = englishSectionStats[k];
      st.percentage = st.total > 0 ? Math.round((st.correct / st.total) * 100) : 0;
    }
    for (const k in englishSkillStats) {
      const sk = englishSkillStats[k];
      sk.percentage = sk.total > 0 ? Math.round((sk.correct / sk.total) * 100) : 0;
    }

    if (subjectStats["ENG"]) {
      subjectStats["ENG"].englishAnalytics = {
        totalQuestions: subjectStats["ENG"].total,
        sections: Object.entries(englishSectionStats).map(([sectionName, st]) => ({
          sectionName,
          total: st.total,
          correct: st.correct,
          percentage: st.percentage,
        })),
        skills: Object.entries(englishSkillStats).map(([skillTag, sk]) => ({
          skillTag,
          total: sk.total,
          correct: sk.correct,
          percentage: sk.percentage,
        })),
      };
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

    const subScores = (attempt.subjectScores as any) || {};

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
      englishAnalytics: subScores["ENG"]?.englishAnalytics || null,
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
        passage: q.passage || null,
        sectionName: q.sectionName || null,
        sectionType: q.sectionType || null,
        skillTag: q.skillTag || null,
        hasImage: q.hasImage || false,
        imageUrl: q.imageUrl || null,
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

  // =========================================================
  // 10. FLASHCARDS SYSTEM (Active Recall by Subject & Topic)
  // =========================================================
  async getFlashcardsDeck(options: {
    subjectCode?: string;
    topic?: string;
    filter?: "ALL" | "KNOWN" | "NEEDS_REVISION";
    limit?: number;
    userId?: string | null;
  }) {
    const limit = options.limit || 30;
    const subjectCode = options.subjectCode || "BIO";

    // Query published verified questions with no long reading passage for concise active recall
    const questions = await prisma.utmeQuestion.findMany({
      where: {
        subjectCode,
        publicationStatus: "PUBLISHED",
        verificationStatus: { not: "NEEDS_REVIEW" },
        passage: null,
        ...(options.topic && options.topic !== "ALL" ? { topic: { contains: options.topic, mode: "insensitive" } } : {}),
      },
      take: 120, // generous pool for randomizing
      orderBy: { id: "asc" },
    });

    // Shuffle questions
    const shuffled = questions.sort(() => Math.random() - 0.5);

    // If candidate is logged in, attach their flashcard progress
    const progressMap = new Map<string, { status: string; timesReviewed: number }>();
    if (options.userId) {
      const progresses = await prisma.utmeFlashcardProgress.findMany({
        where: {
          userId: options.userId,
          questionId: { in: shuffled.map((q) => q.id) },
        },
      });
      for (const p of progresses) {
        progressMap.set(p.questionId, { status: p.status, timesReviewed: p.timesReviewed });
      }
    }

    const cards = shuffled.map((q) => {
      const prog = progressMap.get(q.id);
      const status = prog ? prog.status : "NEEDS_REVISION";
      const timesReviewed = prog ? prog.timesReviewed : 0;

      // Extract text of correct option
      let optText = "";
      for (const opt of q.options) {
        if (opt.startsWith(q.correctAnswer)) {
          optText = opt.substring(opt.indexOf(".") + 1).trim();
          break;
        }
      }

      return {
        id: q.id,
        subjectCode: q.subjectCode,
        subjectName: q.subjectName,
        topic: q.topic,
        examYear: q.examYear,
        front: q.questionText,
        options: q.options,
        correctAnswer: q.correctAnswer,
        correctAnswerText: optText,
        back: `Correct Answer: Option ${q.correctAnswer} (${optText})\n\n${q.explanation || ""}`,
        hasImage: q.hasImage,
        imageUrl: q.imageUrl,
        status,
        timesReviewed,
      };
    });

    let filteredCards = cards;
    if (options.filter === "KNOWN") {
      filteredCards = cards.filter((c) => c.status === "KNOWN");
    } else if (options.filter === "NEEDS_REVISION") {
      filteredCards = cards.filter((c) => c.status === "NEEDS_REVISION");
    }

    return filteredCards.slice(0, limit);
  }

  // 11. Rate Flashcard (Known vs Needs Revision)
  async rateFlashcard(options: {
    userId: string;
    questionId: string;
    status: "KNOWN" | "NEEDS_REVISION";
    subjectCode: string;
    topic?: string;
  }) {
    return await prisma.utmeFlashcardProgress.upsert({
      where: {
        userId_questionId: {
          userId: options.userId,
          questionId: options.questionId,
        },
      },
      update: {
        status: options.status,
        timesReviewed: { increment: 1 },
        lastReviewedAt: new Date(),
      },
      create: {
        userId: options.userId,
        questionId: options.questionId,
        subjectCode: options.subjectCode,
        topic: options.topic,
        status: options.status,
        timesReviewed: 1,
        lastReviewedAt: new Date(),
      },
    });
  }

  // 12. Flashcard Progress Metrics
  async getFlashcardProgress(userId: string, subjectCode?: string) {
    const where: any = { userId };
    if (subjectCode && subjectCode !== "ALL") {
      where.subjectCode = subjectCode;
    }

    const total = await prisma.utmeFlashcardProgress.count({ where });
    const known = await prisma.utmeFlashcardProgress.count({ where: { ...where, status: "KNOWN" } });
    const needsRevision = await prisma.utmeFlashcardProgress.count({ where: { ...where, status: "NEEDS_REVISION" } });

    return {
      totalCardsStudied: total,
      knownCards: known,
      needsRevisionCards: needsRevision,
      masteryRate: total > 0 ? Math.round((known / total) * 100) : 0,
    };
  }

  // =========================================================
  // 13. PROGRESS DASHBOARD & LONG-TERM PERFORMANCE TRACKING
  // =========================================================
  async getProgressDashboard(userId: string) {
    const attempts = await prisma.utmeExamAttempt.findMany({
      where: {
        userId,
        status: "SUBMITTED",
      },
      orderBy: { submittedAt: "desc" },
    });

    const totalAttempts = attempts.length;
    let totalQuestionsAnswered = 0;
    let totalCorrectAnswers = 0;
    let aggregateScoreSum = 0;
    let fullSimulationCount = 0;

    const subjectAggregates: Record<string, { totalQuestions: number; correct: number; subjectName?: string }> = {};
    const topicAggregates: Record<string, { total: number; correct: number }> = {};

    const historyItems = attempts.map((att) => {
      totalQuestionsAnswered += att.totalQuestions || 0;
      totalCorrectAnswers += att.correctCount || 0;
      if (att.mode === "FULL_UTME_SIMULATION") {
        aggregateScoreSum += att.scoreAggregate || 0;
        fullSimulationCount++;
      }

      // Aggregate subject scores
      const sScores = (att.subjectScores as any) || {};
      for (const code in sScores) {
        if (!subjectAggregates[code]) {
          subjectAggregates[code] = { totalQuestions: 0, correct: 0 };
        }
        subjectAggregates[code].totalQuestions += sScores[code].total || 0;
        subjectAggregates[code].correct += sScores[code].correct || 0;
      }

      // Aggregate topic scores
      const tPerf = (att.topicPerformance as any) || {};
      for (const topic in tPerf) {
        if (!topicAggregates[topic]) {
          topicAggregates[topic] = { total: 0, correct: 0 };
        }
        topicAggregates[topic].total += tPerf[topic].total || 0;
        topicAggregates[topic].correct += tPerf[topic].correct || 0;
      }

      return {
        id: att.id,
        courseName: att.courseName,
        mode: att.mode,
        examType: att.examType || "MOCK_SIMULATION",
        totalQuestions: att.totalQuestions,
        correctCount: att.correctCount,
        scoreTotal: att.scoreTotal,
        scoreAggregate: att.scoreAggregate,
        maxScore: att.subjectCodes.length * 100,
        accuracyPercentage: att.accuracyPercentage,
        durationMinutes: att.durationMinutes,
        timeSpentSeconds: att.timeSpentSeconds,
        submittedAt: att.submittedAt,
        subjectCodes: att.subjectCodes,
      };
    });

    const overallAccuracy = totalQuestionsAnswered > 0 ? Math.round((totalCorrectAnswers / totalQuestionsAnswered) * 100) : 0;
    const averageScore400 = fullSimulationCount > 0 ? Math.round(aggregateScoreSum / fullSimulationCount) : 0;

    const subjectBreakdown = Object.entries(subjectAggregates).map(([code, data]) => ({
      subjectCode: code,
      totalQuestions: data.totalQuestions,
      correct: data.correct,
      accuracyPercentage: data.totalQuestions > 0 ? Math.round((data.correct / data.totalQuestions) * 100) : 0,
    }));

    const topicItems = Object.entries(topicAggregates).map(([topic, data]) => ({
      topic,
      total: data.total,
      correct: data.correct,
      accuracyPercentage: data.total > 0 ? Math.round((data.correct / data.total) * 100) : 0,
    }));

    const strengths = topicItems
      .filter((t) => t.total >= 3 && t.accuracyPercentage >= 75)
      .sort((a, b) => b.accuracyPercentage - a.accuracyPercentage);
    const weaknesses = topicItems
      .filter((t) => t.total >= 3 && t.accuracyPercentage < 50)
      .sort((a, b) => a.accuracyPercentage - b.accuracyPercentage);

    // Get Flashcards summary
    const flashcardMetrics = await this.getFlashcardProgress(userId);

    return {
      totalAttempts,
      totalQuestionsAnswered,
      totalCorrectAnswers,
      overallAccuracy,
      averageScore400,
      fullSimulationCount,
      subjectBreakdown,
      strengths: strengths.slice(0, 8),
      weaknesses: weaknesses.slice(0, 8),
      history: historyItems,
      flashcardMetrics,
    };
  }
}

export const utmeService = new UtmeService();
