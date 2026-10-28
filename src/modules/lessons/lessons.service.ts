import { prisma } from "../../database/prisma";
import { CreateLessonInput, LessonSummaryItem, LessonDetailResponse } from "./lessons.types";
import { awardAnswerXp } from "../gamification/gamification.service";

/**
 * Calculates estimated read time based on word count (avg 180 wpm).
 */
export function estimateReadTime(text: string): number {
  const wordCount = text.trim().split(/\s+/).length;
  return Math.max(1, Math.ceil(wordCount / 180));
}

/**
 * Lists all lessons for a specific course, ordered by topic and orderIndex.
 */
export async function listCourseLessons(
  courseIdentifier: string,
  userId?: string | null
): Promise<LessonSummaryItem[]> {
  const course = await prisma.course.findFirst({
    where: {
      OR: [{ id: courseIdentifier }, { code: courseIdentifier }],
    },
  });

  if (!course) {
    throw new Error(`Course '${courseIdentifier}' not found.`);
  }

  // Fetch completed lesson IDs for this user
  const completedLessonIds = new Set<string>();
  if (userId) {
    const interactions = await prisma.interaction.findMany({
      where: {
        userId,
        eventType: "LESSON_COMPLETED",
      },
      select: { resourceId: true },
    });
    for (const i of interactions) {
      if (i.resourceId) completedLessonIds.add(i.resourceId);
    }
  }

  const lessons = await prisma.lesson.findMany({
    where: { courseId: course.id },
    include: {
      topic: true,
      course: true,
    },
    orderBy: [{ topic: { name: "asc" } }, { orderIndex: "asc" }],
  });

  return lessons.map((l) => {
    const checkQIds = Array.isArray(l.checkQIds) ? l.checkQIds : [];
    return {
      id: l.id,
      courseId: l.courseId,
      courseCode: l.course.code,
      courseTitle: l.course.title,
      topicId: l.topicId,
      topicName: l.topic.name,
      title: l.title,
      summary: l.summary,
      readTimeMin: l.readTimeMin,
      orderIndex: l.orderIndex,
      checkQuestionsCount: checkQIds.length,
      isCompleted: completedLessonIds.has(l.id),
    };
  });
}

/**
 * Retrieves full lesson content with hydrated diagnostic check questions.
 */
export async function getLessonDetails(
  lessonId: string,
  userId?: string | null
): Promise<LessonDetailResponse> {
  const lesson = await prisma.lesson.findUnique({
    where: { id: lessonId },
    include: {
      course: true,
      topic: true,
    },
  });

  if (!lesson) {
    throw new Error(`Lesson with id '${lessonId}' not found.`);
  }

  // Check if completed
  let isCompleted = false;
  if (userId) {
    const interaction = await prisma.interaction.findFirst({
      where: {
        userId,
        eventType: "LESSON_COMPLETED",
        resourceId: lessonId,
      },
    });
    isCompleted = Boolean(interaction);
  }

  // Hydrate check questions
  const checkQIds = Array.isArray(lesson.checkQIds) ? (lesson.checkQIds as string[]) : [];
  let checkQuestions: any[] = [];

  if (checkQIds.length > 0) {
    const questions = await prisma.question.findMany({
      where: { id: { in: checkQIds } },
      select: {
        id: true,
        questionText: true,
        options: true,
        correctAnswer: true,
        explanation: true,
        type: true,
        difficulty: true,
      },
    });
    checkQuestions = questions.map((q) => ({
      id: q.id,
      stem: q.questionText,
      options: q.options,
      correctAnswer: q.correctAnswer,
      explanation: q.explanation,
      type: q.type,
      difficulty: q.difficulty,
    }));
  }

  return {
    id: lesson.id,
    course: {
      id: lesson.course.id,
      code: lesson.course.code,
      title: lesson.course.title,
    },
    topic: {
      id: lesson.topic.id,
      name: lesson.topic.name,
      isHighYield: lesson.topic.isHighYield,
      historicalFrequency: lesson.topic.historicalFrequency,
    },
    title: lesson.title,
    summary: lesson.summary,
    content: lesson.content,
    readTimeMin: lesson.readTimeMin,
    orderIndex: lesson.orderIndex,
    isCompleted,
    checkQuestions,
    practiceDrillUrl: `/api/practice/start?courseId=${lesson.courseId}&topicIds=${lesson.topicId}`,
  };
}

/**
 * Marks a lesson completed by a student, records interaction, and awards +20 XP.
 */
export async function markLessonComplete(
  lessonId: string,
  userId: string,
  readDurationSeconds: number = 60
) {
  const lesson = await prisma.lesson.findUnique({
    where: { id: lessonId },
    include: { course: true },
  });

  if (!lesson) {
    throw new Error("Lesson not found.");
  }

  // Check if already completed
  const existing = await prisma.interaction.findFirst({
    where: {
      userId,
      eventType: "LESSON_COMPLETED",
      resourceId: lessonId,
    },
  });

  if (existing) {
    return {
      alreadyCompleted: true,
      message: "Lesson was already marked as completed.",
    };
  }

  // Create interaction record
  await prisma.interaction.create({
    data: {
      userId,
      eventType: "LESSON_COMPLETED",
      resourceId: lessonId,
      metadata: {
        courseCode: lesson.course.code,
        lessonTitle: lesson.title,
        readDurationSeconds,
      },
    },
  });

  // Award 20 XP for completing a curriculum lesson
  const gamification = await awardAnswerXp(userId, 20);

  return {
    alreadyCompleted: false,
    message: "Lesson marked complete! +20 XP awarded.",
    gamification: {
      totalXp: gamification.profile.totalXp,
      level: gamification.profile.currentLevel,
      currentStreak: gamification.profile.currentStreak,
      xpAwarded: gamification.xpAwarded,
      justCompletedQuest: gamification.justCompletedQuest,
    },
  };
}

/**
 * Creates or updates a single lesson.
 */
export async function upsertLesson(input: CreateLessonInput) {
  const course = await prisma.course.findUnique({
    where: { code: input.courseCode },
  });
  if (!course) {
    throw new Error(`Course '${input.courseCode}' not found.`);
  }

  let topic = await prisma.courseTopic.findFirst({
    where: {
      courseId: course.id,
      name: { equals: input.topicName, mode: "insensitive" },
    },
  });

  if (!topic) {
    topic = await prisma.courseTopic.create({
      data: {
        courseId: course.id,
        name: input.topicName,
        historicalFrequency: 1,
        isHighYield: false,
      },
    });
  }

  const readTimeMin = input.readTimeMin || estimateReadTime(input.content);

  const existing = await prisma.lesson.findFirst({
    where: {
      courseId: course.id,
      topicId: topic.id,
      title: input.title,
    },
  });

  if (existing) {
    return prisma.lesson.update({
      where: { id: existing.id },
      data: {
        content: input.content,
        summary: input.summary || existing.summary,
        readTimeMin,
        orderIndex: input.orderIndex,
        checkQIds: (input.checkQIds as any) || (existing.checkQIds as any) || [],
      },
    });
  } else {
    return prisma.lesson.create({
      data: {
        courseId: course.id,
        topicId: topic.id,
        title: input.title,
        summary: input.summary,
        content: input.content,
        readTimeMin,
        orderIndex: input.orderIndex,
        checkQIds: (input.checkQIds as any) || [],
      },
    });
  }
}
