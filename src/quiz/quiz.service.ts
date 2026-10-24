import { prisma } from "../database/prisma";

export interface QuizQuestion {
  id: string;
  courseCode: string;
  courseTitle: string;
  topic: string;
  type: string;
  questionText: string;
  options: string[];
  correctAnswer: string;
  explanation: string;
}

export class QuizService {
  // 1. Fetch questions for a course
  async getQuestionsByCourse(courseCode: string, limit = 10): Promise<QuizQuestion[]> {
    const norm = courseCode.toUpperCase().trim();
    const clean = norm.replace(/\s+/g, "");
    const aliases = [norm, clean];
    if (clean.includes("VMD") || clean.includes("FVM") || clean.includes("VET")) {
      aliases.push("VMD 101", "VMD101", "FVM 101", "FVM101");
    }

    const questions = await prisma.question.findMany({
      where: {
        OR: [
          { courseCode: { in: aliases, mode: "insensitive" } },
          { courseCode: { contains: clean, mode: "insensitive" } },
          { courseCode: "GST101" }, // fallback to general GST if empty
        ],
      },
      take: limit,
      orderBy: { createdAt: "asc" },
    });

    return questions.map((q) => ({
      id: q.id,
      courseCode: q.courseCode,
      courseTitle: q.courseTitle,
      topic: q.topic,
      type: q.type,
      questionText: q.questionText,
      options: q.options,
      correctAnswer: q.correctAnswer,
      explanation: q.explanation,
    }));
  }

  // 2. Evaluate student answer
  async evaluateAnswer(questionId: string, userAnswer: string) {
    const question = await prisma.question.findUnique({
      where: { id: questionId },
    });

    if (!question) {
      throw new Error("Question not found");
    }

    const isCorrect = question.correctAnswer.trim().toLowerCase() === userAnswer.trim().toLowerCase();

    return {
      isCorrect,
      correctAnswer: question.correctAnswer,
      explanation: question.explanation,
    };
  }

  // 3. Record student quiz attempt & update streak / points
  async recordAttempt(
    userId: string,
    courseCode: string,
    mode: "PRACTICE" | "EXAM" | "REVISION",
    correctCount: number,
    wrongCount: number,
    unansweredCount: number,
    timeSpentSeconds = 0
  ) {
    const totalQuestions = correctCount + wrongCount + unansweredCount;
    // Standard CBT: +1 per correct, 0 wrong. Exam mode: optional negative marking
    const score = mode === "EXAM" ? Math.max(0, correctCount - wrongCount * 0.5) : correctCount;
    const pointsEarned = Math.round(score * 10);

    const attempt = await prisma.quizAttempt.create({
      data: {
        userId,
        courseCode,
        mode,
        score,
        totalQuestions,
        correctCount,
        wrongCount,
        unansweredCount,
        timeSpentSeconds,
      },
    });

    // Update user streak & total points
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (user) {
      const now = new Date();
      let streak = user.streakCount || 0;
      const lastActive = user.lastActiveDate;

      if (!lastActive) {
        streak = 1;
      } else {
        const diffHours = (now.getTime() - lastActive.getTime()) / (1000 * 3600);
        if (diffHours >= 20 && diffHours <= 48) {
          streak += 1;
        } else if (diffHours > 48) {
          streak = 1;
        }
      }

      await prisma.user.update({
        where: { id: userId },
        data: {
          totalPoints: (user.totalPoints || 0) + pointsEarned,
          streakCount: streak,
          lastActiveDate: now,
        },
      });
    }

    return attempt;
  }

  // 4. Get Leaderboard
  async getLeaderboard(limit = 10) {
    const topUsers = await prisma.user.findMany({
      take: limit,
      orderBy: { totalPoints: "desc" },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        username: true,
        level: true,
        streakCount: true,
        totalPoints: true,
        department: { select: { name: true } },
      },
    });

    return topUsers;
  }
}

export const quizService = new QuizService();
