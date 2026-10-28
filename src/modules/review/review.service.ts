import { prisma } from "../../database/prisma";

export interface ReviewCardResolution {
  isCorrect: boolean;
  confidence?: number; // 1 (low), 2 (medium), 3 (high)
}

/**
 * Enqueues a question that a user answered incorrectly or flagged for revision.
 */
export async function enqueueQuestionForReview(userId: string, questionId: string) {
  const existing = await prisma.spacedReviewItem.findUnique({
    where: {
      userId_questionId: { userId, questionId },
    },
  });

  const now = new Date();
  const tomorrow = new Date(now.getTime() + 86400000);

  if (!existing) {
    return prisma.spacedReviewItem.create({
      data: {
        userId,
        questionId,
        intervalDays: 1,
        repetitions: 0,
        easeFactor: 2.5,
        dueDate: tomorrow,
        status: "LEARNING",
      },
    });
  } else {
    // Already in queue: reset interval to 1 day and lower ease factor slightly
    const newEase = Math.max(1.3, Number((existing.easeFactor - 0.15).toFixed(2)));
    return prisma.spacedReviewItem.update({
      where: { id: existing.id },
      data: {
        intervalDays: 1,
        repetitions: 0,
        easeFactor: newEase,
        dueDate: now, // due immediately for recall
        status: "LEARNING",
        lastReviewedAt: now,
      },
    });
  }
}

/**
 * Resolves a spaced repetition review attempt using the clean-room SuperMemo-2 algorithm.
 */
export async function resolveReviewItem(
  userId: string,
  questionId: string,
  resolution: ReviewCardResolution
) {
  const item = await prisma.spacedReviewItem.findUnique({
    where: {
      userId_questionId: { userId, questionId },
    },
  });

  if (!item) {
    // If not previously enqueued, create it now
    if (!resolution.isCorrect) {
      return enqueueQuestionForReview(userId, questionId);
    }
    return null;
  }

  const now = new Date();
  let repetitions = item.repetitions;
  let intervalDays = item.intervalDays;
  let easeFactor = item.easeFactor;
  let status = item.status;

  // Map boolean + confidence to SM-2 quality grade (0 to 5)
  // Low confidence correct = 3, Medium = 4, High = 5. Incorrect = 1 or 2.
  const quality = resolution.isCorrect
    ? resolution.confidence === 3
      ? 5
      : resolution.confidence === 2
      ? 4
      : 3
    : resolution.confidence === 3
    ? 2
    : 1;

  if (quality < 3) {
    // Incorrect: lapse, restart repetitions
    repetitions = 0;
    intervalDays = 1;
    status = "LEARNING";
    easeFactor = Math.max(1.3, Number((easeFactor - 0.2).toFixed(2)));
  } else {
    // Correct recall: expand interval
    repetitions += 1;
    if (repetitions === 1) {
      intervalDays = 1;
    } else if (repetitions === 2) {
      intervalDays = 3;
    } else if (repetitions === 3) {
      intervalDays = 7;
    } else if (repetitions === 4) {
      intervalDays = 16;
    } else {
      intervalDays = Math.round(intervalDays * easeFactor);
    }

    // Adjust SM-2 ease factor formula: EF' = EF + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02))
    const efDelta = 0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02);
    easeFactor = Math.max(1.3, Math.min(3.0, Number((easeFactor + efDelta).toFixed(2))));

    if (intervalDays >= 35) {
      status = "MASTERED";
    } else {
      status = "REVIEWING";
    }
  }

  const nextDueDate = new Date(now.getTime() + intervalDays * 86400000);

  const updated = await prisma.spacedReviewItem.update({
    where: { id: item.id },
    data: {
      intervalDays,
      repetitions,
      easeFactor,
      dueDate: nextDueDate,
      lastReviewedAt: now,
      status,
    },
  });

  return {
    item: updated,
    nextIntervalDays: intervalDays,
    status,
    dueDate: nextDueDate,
  };
}

/**
 * Gets counts and active due cards for the student's review dashboard.
 */
export async function getReviewQueueSummary(userId: string) {
  const now = new Date();
  const sevenDaysAhead = new Date(now.getTime() + 7 * 86400000);

  const [dueToday, dueThisWeek, mastered] = await Promise.all([
    prisma.spacedReviewItem.count({
      where: {
        userId,
        dueDate: { lte: now },
        status: { not: "MASTERED" },
      },
    }),
    prisma.spacedReviewItem.count({
      where: {
        userId,
        dueDate: { lte: sevenDaysAhead },
        status: { not: "MASTERED" },
      },
    }),
    prisma.spacedReviewItem.count({
      where: {
        userId,
        status: "MASTERED",
      },
    }),
  ]);

  // Fetch up to 25 due questions for the active session
  const dueItems = await prisma.spacedReviewItem.findMany({
    where: {
      userId,
      dueDate: { lte: now },
      status: { not: "MASTERED" },
    },
    orderBy: [{ dueDate: "asc" }, { repetitions: "asc" }],
    take: 25,
    include: {
      question: {
        select: {
          id: true,
          courseCode: true,
          courseTitle: true,
          topic: true,
          questionText: true,
          options: true,
          correctAnswer: true,
          explanation: true,
          distractorNotes: true,
          limbRationales: true,
          sourceDocument: true,
          hasImage: true,
          imageUrl: true,
        },
      },
    },
  });

  return {
    dueTodayCount: dueToday,
    dueThisWeekCount: dueThisWeek,
    masteredCount: mastered,
    dueCards: dueItems.map(item => ({
      reviewId: item.id,
      intervalDays: item.intervalDays,
      repetitions: item.repetitions,
      status: item.status,
      question: item.question,
    })),
  };
}

