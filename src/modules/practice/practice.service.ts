import { prisma } from "../../database/prisma";
import {
  StartPracticeSessionInput,
  SubmitAnswerInput,
  CompleteSessionInput,
  QuestionSessionPayload,
} from "./practice.types";
import { awardAnswerXp } from "../gamification/gamification.service";
import { resolveReviewItem, enqueueQuestionForReview } from "../review/review.service";

/**
 * Normalizes limb answers for True/False questions (e.g. "T, F, T, T" or "TFTT")
 */
function normalizeTfString(str: string): string[] {
  return str
    .toUpperCase()
    .replace(/[^TF]/g, "")
    .split("");
}

/**
 * Compares user answer against correct answer.
 * Handles SBA (letter comparison e.g. "A" vs "A") and True/False ("T, F, T, F").
 */
export function evaluateAnswer(
  questionType: string,
  userAnswer: string,
  correctAnswer: string
): { isCorrect: boolean; scoreFraction: number } {
  const cleanUser = (userAnswer || "").trim().toUpperCase();
  const cleanCorrect = (correctAnswer || "").trim().toUpperCase();

  if (questionType === "TRUE_FALSE") {
    const userLimbs = normalizeTfString(cleanUser);
    const correctLimbs = normalizeTfString(cleanCorrect);

    if (correctLimbs.length === 0) {
      return { isCorrect: cleanUser === cleanCorrect, scoreFraction: cleanUser === cleanCorrect ? 1 : 0 };
    }

    let matchCount = 0;
    for (let i = 0; i < correctLimbs.length; i++) {
      if (userLimbs[i] === correctLimbs[i]) {
        matchCount++;
      }
    }

    const fraction = matchCount / correctLimbs.length;
    return {
      isCorrect: fraction === 1.0,
      scoreFraction: fraction,
    };
  }

  // Single Best Answer (SBA) / MCQ
  // Strip parentheses/prefixes if needed e.g. "A) " -> "A"
  const extractLetter = (val: string) => {
    const match = val.match(/^([A-E])(\)|\.|$)/i);
    return match ? match[1].toUpperCase() : val;
  };

  const isCorrect = extractLetter(cleanUser) === extractLetter(cleanCorrect);
  return {
    isCorrect,
    scoreFraction: isCorrect ? 1 : 0,
  };
}

/**
 * Starts a new Practice or CBT Exam session.
 */
export async function startSession(
  userId: string | null,
  guestSessionId: string | null,
  input: StartPracticeSessionInput
) {
  const {
    courseCode,
    courseId,
    mode = "PRACTICE",
    topicIds,
    format = "ALL",
    questionCount = 20,
    timeAllowedMinutes,
    examPaperId,
  } = input;

  // 1. Resolve Course
  let course = null;
  if (courseId) {
    course = await prisma.course.findUnique({ where: { id: courseId } });
  } else if (courseCode) {
    course = await prisma.course.findUnique({ where: { code: courseCode } });
  }

  if (!course && !examPaperId) {
    throw new Error("A valid courseCode, courseId, or examPaperId is required.");
  }

  // 2. Build Question Query
  const where: any = {};
  if (course) {
    where.courseId = course.id;
  }
  if (examPaperId) {
    where.examPaperId = examPaperId;
  }
  if (topicIds && topicIds.length > 0) {
    where.courseTopicId = { in: topicIds };
  }
  if (format === "SBA") {
    where.type = "MCQ";
  } else if (format === "MCQ_TF") {
    where.type = "TRUE_FALSE";
  }

  // Fetch candidate questions
  const candidateQuestions = await prisma.question.findMany({
    where,
    select: {
      id: true,
      courseCode: true,
      courseTitle: true,
      topic: true,
      type: true,
      questionText: true,
      options: true,
      correctAnswer: true,
      explanation: true,
      distractorNotes: true,
      limbRationales: true,
      hasImage: true,
      imageUrl: true,
      difficulty: true,
    },
  });

  if (candidateQuestions.length === 0) {
    throw new Error("No questions found matching the requested criteria.");
  }

  // Shuffle questions randomly
  const shuffled = [...candidateQuestions].sort(() => 0.5 - Math.random());
  const selectedQuestions = shuffled.slice(0, questionCount);

  // 3. Determine time allowed (default 45 min for CBT exam simulation, untimed for practice)
  let timeAllowedSeconds: number | null = null;
  if (mode === "EXAM") {
    timeAllowedSeconds = (timeAllowedMinutes || 45) * 60;
  } else if (timeAllowedMinutes) {
    timeAllowedSeconds = timeAllowedMinutes * 60;
  }

  // 4. Create QuizAttempt record in DB
  const attempt = await prisma.quizAttempt.create({
    data: {
      userId,
      guestSessionId,
      courseCode: course ? course.code : selectedQuestions[0].courseCode,
      courseTitle: course ? course.title : selectedQuestions[0].courseTitle,
      courseId: course ? course.id : undefined,
      mode,
      score: 0,
      totalQuestions: selectedQuestions.length,
      correctCount: 0,
      wrongCount: 0,
      unansweredCount: selectedQuestions.length,
      timeSpentSeconds: 0,
      timeAllowedSeconds,
      status: "IN_PROGRESS",
      questionsSnapshot: selectedQuestions.map((q) => q.id),
      selectedAnswers: {},
    },
  });

  // 5. Build questions payload (hide answers for EXAM mode, show if PRACTICE)
  const isInstant = mode === "PRACTICE" || mode === "REVISION";
  const clientQuestions: QuestionSessionPayload[] = selectedQuestions.map((q) => ({
    id: q.id,
    courseCode: q.courseCode,
    courseTitle: q.courseTitle,
    topic: q.topic,
    type: q.type,
    questionText: q.questionText,
    options: q.options,
    hasImage: q.hasImage,
    imageUrl: q.imageUrl,
    difficulty: q.difficulty,
    ...(isInstant
      ? {
          correctAnswer: q.correctAnswer,
          explanation: q.explanation,
          distractorNotes: q.distractorNotes,
          limbRationales: q.limbRationales,
        }
      : {}),
  }));

  return {
    sessionId: attempt.id,
    mode: attempt.mode,
    courseCode: attempt.courseCode,
    courseTitle: attempt.courseTitle,
    totalQuestions: attempt.totalQuestions,
    timeAllowedSeconds: attempt.timeAllowedSeconds,
    status: attempt.status,
    createdAt: attempt.createdAt,
    questions: clientQuestions,
  };
}

/**
 * Submits an answer for a specific question within a session.
 */
export async function submitAnswer(
  sessionId: string,
  userId: string | null,
  input: SubmitAnswerInput
) {
  const { questionId, userAnswer, confidenceRating = "MEDIUM", timeSpentSeconds = 0 } = input;

  const attempt = await prisma.quizAttempt.findUnique({
    where: { id: sessionId },
  });

  if (!attempt) {
    throw new Error("Practice session not found.");
  }
  if (attempt.status !== "IN_PROGRESS") {
    throw new Error(`Session is already ${attempt.status}.`);
  }

  // Fetch question
  const question = await prisma.question.findUnique({
    where: { id: questionId },
  });
  if (!question) {
    throw new Error("Question not found.");
  }

  // Evaluate correctness
  const { isCorrect, scoreFraction } = evaluateAnswer(
    question.type,
    userAnswer,
    question.correctAnswer
  );

  // Update session stored answers map
  const selectedAnswers = (attempt.selectedAnswers as Record<string, any>) || {};
  const isFirstAttempt = !selectedAnswers[questionId];

  selectedAnswers[questionId] = {
    userAnswer,
    isCorrect,
    scoreFraction,
    confidenceRating,
    timeSpentSeconds,
    answeredAt: new Date().toISOString(),
  };

  // Recalculate tally
  let correctCount = 0;
  let wrongCount = 0;
  for (const key of Object.keys(selectedAnswers)) {
    if (selectedAnswers[key].isCorrect) {
      correctCount++;
    } else {
      wrongCount++;
    }
  }
  const unansweredCount = Math.max(0, attempt.totalQuestions - Object.keys(selectedAnswers).length);

  await prisma.quizAttempt.update({
    where: { id: sessionId },
    data: {
      selectedAnswers,
      correctCount,
      wrongCount,
      unansweredCount,
      timeSpentSeconds: { increment: timeSpentSeconds },
    },
  });

  // Award XP and Spaced Repetition if logged in
  let xpResult = null;
  if (userId) {
    // 10 XP per answer + streak / quest advancement
    xpResult = await awardAnswerXp(userId, 10);

    // SM-2 Spaced Repetition queue integration
    const confidenceNum = confidenceRating === "HIGH" ? 3 : confidenceRating === "MEDIUM" ? 2 : 1;
    await resolveReviewItem(userId, question.id, {
      isCorrect,
      confidence: confidenceNum,
    });

    if (!isCorrect || confidenceRating === "LOW") {
      await enqueueQuestionForReview(userId, question.id);
    }
  }

  return {
    questionId,
    isCorrect,
    scoreFraction,
    correctAnswer: question.correctAnswer,
    explanation: question.explanation,
    distractorNotes: question.distractorNotes,
    limbRationales: question.limbRationales,
    gamification: xpResult
      ? {
          xpEarned: xpResult.xpAwarded,
          currentXp: xpResult.profile.totalXp,
          level: xpResult.profile.currentLevel,
          streakDays: xpResult.profile.currentStreak,
          dailyQuestProgress: {
            completedAnswers: xpResult.quest.completedAnswers,
            targetAnswers: xpResult.quest.targetAnswers,
            isCompleted: xpResult.quest.isCompleted,
            grade: xpResult.quest.grade,
          },
          justCompletedQuest: xpResult.justCompletedQuest,
        }
      : null,
  };
}

/**
 * Completes a session, generates performance analytics, and returns result slip.
 */
export async function completeSession(
  sessionId: string,
  userId: string | null,
  input?: CompleteSessionInput
) {
  const attempt = await prisma.quizAttempt.findUnique({
    where: { id: sessionId },
  });

  if (!attempt) {
    throw new Error("Practice session not found.");
  }

  const selectedAnswers = (attempt.selectedAnswers as Record<string, any>) || {};
  const questionIds = (attempt.questionsSnapshot as string[]) || [];

  // Fetch all questions in snapshot to build per-topic analytics
  const questions = await prisma.question.findMany({
    where: { id: { in: questionIds } },
    select: {
      id: true,
      topic: true,
      correctAnswer: true,
      explanation: true,
      distractorNotes: true,
      limbRationales: true,
      questionText: true,
      options: true,
      type: true,
    },
  });

  const questionMap = new Map(questions.map((q) => [q.id, q]));

  // Build per-topic performance breakdown
  const topicStats: Record<string, { total: number; correct: number; percentage: number }> = {};
  let totalScoreFraction = 0;

  for (const q of questions) {
    const topic = q.topic || "General";
    if (!topicStats[topic]) {
      topicStats[topic] = { total: 0, correct: 0, percentage: 0 };
    }
    topicStats[topic].total += 1;

    const answer = selectedAnswers[q.id];
    if (answer) {
      if (answer.isCorrect) {
        topicStats[topic].correct += 1;
      }
      totalScoreFraction += answer.scoreFraction || (answer.isCorrect ? 1 : 0);
    }
  }

  for (const topic of Object.keys(topicStats)) {
    const item = topicStats[topic];
    item.percentage = Math.round((item.correct / item.total) * 100);
  }

  const accuracyPercentage =
    attempt.totalQuestions > 0
      ? Math.round((totalScoreFraction / attempt.totalQuestions) * 100)
      : 0;

  const finalStatus = input?.forceTimedOut ? "TIMED_OUT" : "SUBMITTED";

  // Update Attempt record
  const updatedAttempt = await prisma.quizAttempt.update({
    where: { id: sessionId },
    data: {
      status: finalStatus,
      score: totalScoreFraction,
      accuracyPercentage,
      topicPerformance: topicStats,
      timeSpentSeconds: input?.timeSpentSeconds || attempt.timeSpentSeconds,
      submittedAt: new Date(),
    },
  });

  // Grade classification
  let grade = "F";
  if (accuracyPercentage >= 70) grade = "A (Distinction)";
  else if (accuracyPercentage >= 60) grade = "B (Credit)";
  else if (accuracyPercentage >= 50) grade = "C (Pass)";
  else if (accuracyPercentage >= 45) grade = "D (Weak Pass)";
  else if (accuracyPercentage >= 40) grade = "E (Marginal Pass)";

  // Identify weak topics (below 60%)
  const weakTopics = Object.entries(topicStats)
    .filter(([_, stat]) => stat.percentage < 60)
    .map(([topic, stat]) => ({ topic, accuracy: stat.percentage, total: stat.total }));

  return {
    sessionId: updatedAttempt.id,
    courseCode: updatedAttempt.courseCode,
    courseTitle: updatedAttempt.courseTitle,
    mode: updatedAttempt.mode,
    status: updatedAttempt.status,
    totalQuestions: updatedAttempt.totalQuestions,
    answeredCount: Object.keys(selectedAnswers).length,
    correctCount: updatedAttempt.correctCount,
    wrongCount: updatedAttempt.wrongCount,
    unansweredCount: updatedAttempt.unansweredCount,
    netScore: updatedAttempt.score,
    accuracyPercentage: updatedAttempt.accuracyPercentage,
    grade,
    timeSpentSeconds: updatedAttempt.timeSpentSeconds,
    submittedAt: updatedAttempt.submittedAt,
    topicPerformance: topicStats,
    weakTopics,
    recommendations: weakTopics.length > 0
      ? `Focus revision on ${weakTopics.map((w) => w.topic).join(", ")}. Incorrect questions have been scheduled into your Spaced Repetition queue.`
      : "Excellent performance! Maintain your daily streak to preserve recall mastery.",
  };
}

/**
 * Retrieves past practice / CBT exam sessions history for a user.
 */
export async function getSessionHistory(userId: string | null, courseCode?: string, limit = 20) {
  const where: any = {};
  if (userId) where.userId = userId;
  if (courseCode) where.courseCode = courseCode;

  return prisma.quizAttempt.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: limit,
    select: {
      id: true,
      courseCode: true,
      courseTitle: true,
      mode: true,
      score: true,
      totalQuestions: true,
      correctCount: true,
      wrongCount: true,
      accuracyPercentage: true,
      status: true,
      timeSpentSeconds: true,
      createdAt: true,
      submittedAt: true,
    },
  });
}

/**
 * Retrieves full details of a session, including questions, user answers, and solutions.
 */
export async function getSessionDetails(sessionId: string) {
  const attempt = await prisma.quizAttempt.findUnique({
    where: { id: sessionId },
  });

  if (!attempt) {
    throw new Error("Practice session not found.");
  }

  const questionIds = (attempt.questionsSnapshot as string[]) || [];
  const selectedAnswers = (attempt.selectedAnswers as Record<string, any>) || {};

  const questions = await prisma.question.findMany({
    where: { id: { in: questionIds } },
  });

  const questionDetails = questions.map((q) => {
    const answer = selectedAnswers[q.id];
    return {
      id: q.id,
      topic: q.topic,
      type: q.type,
      questionText: q.questionText,
      options: q.options,
      correctAnswer: q.correctAnswer,
      explanation: q.explanation,
      distractorNotes: q.distractorNotes,
      limbRationales: q.limbRationales,
      userAnswer: answer ? answer.userAnswer : null,
      isCorrect: answer ? answer.isCorrect : null,
      confidenceRating: answer ? answer.confidenceRating : null,
      timeSpentSeconds: answer ? answer.timeSpentSeconds : null,
    };
  });

  return {
    session: {
      id: attempt.id,
      courseCode: attempt.courseCode,
      courseTitle: attempt.courseTitle,
      mode: attempt.mode,
      score: attempt.score,
      totalQuestions: attempt.totalQuestions,
      correctCount: attempt.correctCount,
      wrongCount: attempt.wrongCount,
      accuracyPercentage: attempt.accuracyPercentage,
      status: attempt.status,
      timeSpentSeconds: attempt.timeSpentSeconds,
      timeAllowedSeconds: attempt.timeAllowedSeconds,
      topicPerformance: attempt.topicPerformance,
      createdAt: attempt.createdAt,
      submittedAt: attempt.submittedAt,
    },
    questions: questionDetails,
  };
}
