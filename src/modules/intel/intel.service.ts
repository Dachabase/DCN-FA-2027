import { prisma } from "../../database/prisma";
import {
  CourseExamIntelResponse,
  FacultyExamIntelResponse,
  TopicIntelItem,
  TopicYieldStatus,
} from "./intel.types";

/**
 * Computes deep exam intelligence for a single course, including topic appearance likelihood,
 * difficulty breakdown, and student-specific weak-area radar.
 */
export async function getCourseExamIntel(
  courseIdentifier: string,
  userId?: string | null
): Promise<CourseExamIntelResponse> {
  // Resolve course by code or ID
  const course = await prisma.course.findFirst({
    where: {
      OR: [{ id: courseIdentifier }, { code: courseIdentifier }],
    },
    include: {
      faculty: true,
      topics: {
        include: {
          questions: {
            select: { id: true, difficulty: true },
          },
        },
      },
      examPapers: true,
      _count: {
        select: { questions: true },
      },
    },
  });

  if (!course) {
    throw new Error(`Course '${courseIdentifier}' not found.`);
  }

  const totalQuestions = course._count.questions;
  const totalTopics = course.topics.length;
  const totalPastPapers = course.examPapers.length;

  // If student is logged in, fetch their attempt history for this course
  const studentTopicStats: Record<string, { attempted: number; correct: number }> = {};
  const studentDueTopics = new Set<string>();

  if (userId) {
    const userAttempts = await prisma.quizAttempt.findMany({
      where: {
        userId,
        courseId: course.id,
        status: { in: ["SUBMITTED", "TIMED_OUT"] },
      },
      select: {
        topicPerformance: true,
      },
    });

    for (const att of userAttempts) {
      if (att.topicPerformance && typeof att.topicPerformance === "object") {
        for (const [topicName, stat] of Object.entries(att.topicPerformance as Record<string, any>)) {
          if (!studentTopicStats[topicName]) {
            studentTopicStats[topicName] = { attempted: 0, correct: 0 };
          }
          studentTopicStats[topicName].attempted += stat.total || 0;
          studentTopicStats[topicName].correct += stat.correct || 0;
        }
      }
    }

    // Check if user has due cards in Spaced Repetition for questions in this course
    const dueReviews = await prisma.spacedReviewItem.findMany({
      where: {
        userId,
        dueDate: { lte: new Date() },
        question: { courseId: course.id },
      },
      include: {
        question: { select: { topic: true } },
      },
    });

    for (const rev of dueReviews) {
      if (rev.question?.topic) {
        studentDueTopics.add(rev.question.topic);
      }
    }
  }

  // Build Topic Intel list
  const topicIntelItems: TopicIntelItem[] = course.topics.map((t) => {
    const qCount = t.questions.length;
    let easyCount = 0;
    let mediumCount = 0;
    let hardCount = 0;

    for (const q of t.questions) {
      if (q.difficulty === "EASY") easyCount++;
      else if (q.difficulty === "HARD") hardCount++;
      else mediumCount++;
    }

    // Likelihood calculation:
    // If past exam papers exist, likelihood = (historicalFrequency / totalPastPapers) * 100 capped at 99%.
    // Otherwise, relative density compared to average topic question count.
    let likelihood = 50;
    if (totalPastPapers > 0) {
      likelihood = Math.min(99, Math.round((t.historicalFrequency / totalPastPapers) * 100));
    } else if (totalQuestions > 0 && totalTopics > 0) {
      const avg = totalQuestions / totalTopics;
      likelihood = Math.min(95, Math.max(15, Math.round((qCount / avg) * 50)));
    }

    // Student performance calculations
    let studentPerf = undefined;
    if (userId) {
      const stats = studentTopicStats[t.name] || { attempted: 0, correct: 0 };
      const accuracy =
        stats.attempted > 0 ? Math.round((stats.correct / stats.attempted) * 100) : 0;

      let status: TopicYieldStatus = "UNATTEMPTED";
      if (stats.attempted > 0) {
        if (accuracy >= 80) {
          status = "MASTERED";
        } else if (likelihood >= 60 && accuracy < 65) {
          status = "CRITICAL_WEAK_AREA";
        } else {
          status = "NEEDS_PRACTICE";
        }
      } else if (likelihood >= 60) {
        status = "CRITICAL_WEAK_AREA"; // High yield but untouched
      }

      studentPerf = {
        attemptedCount: stats.attempted,
        correctCount: stats.correct,
        accuracyPercentage: accuracy,
        status,
        dueForSpacedReview: studentDueTopics.has(t.name),
      };
    }

    return {
      topicId: t.id,
      topicName: t.name,
      isHighYield: t.isHighYield || likelihood >= 65,
      questionCount: qCount,
      historicalFrequency: t.historicalFrequency,
      examAppearanceLikelihood: likelihood,
      difficultyBreakdown: { easyCount, mediumCount, hardCount },
      studentPerformance: studentPerf,
    };
  });

  // Sort by highest likelihood
  topicIntelItems.sort((a, b) => b.examAppearanceLikelihood - a.examAppearanceLikelihood);

  // Top 5 High-Yield Hero Topics
  const heroTopics = topicIntelItems.slice(0, 5);

  // Critical Weak Areas for the student
  const criticalWeakAreas = topicIntelItems.filter(
    (t) => t.studentPerformance?.status === "CRITICAL_WEAK_AREA"
  );

  return {
    course: {
      id: course.id,
      code: course.code,
      title: course.title,
      level: course.level,
      semester: course.semester,
      isUniversityWide: course.isUniversityWide,
      facultyName: course.faculty?.name,
    },
    summary: {
      totalQuestions,
      totalTopics,
      totalPastPapers,
      highYieldTopicCount: topicIntelItems.filter((t) => t.isHighYield).length,
    },
    heroTopics,
    allTopics: topicIntelItems,
    criticalWeakAreas,
  };
}

/**
 * Computes faculty-wide exam intelligence across departments and courses.
 */
export async function getFacultyExamIntel(facultyIdentifier: string): Promise<FacultyExamIntelResponse> {
  const faculty = await prisma.faculty.findFirst({
    where: {
      OR: [{ id: facultyIdentifier }, { code: facultyIdentifier }],
    },
    include: {
      courses: {
        include: {
          topics: {
            orderBy: { historicalFrequency: "desc" },
          },
          examPapers: true,
          _count: {
            select: { questions: true },
          },
        },
      },
    },
  });

  if (!faculty) {
    throw new Error(`Faculty '${facultyIdentifier}' not found.`);
  }

  let totalQuestions = 0;
  let totalExamPapers = 0;

  const topTestedCourses = faculty.courses
    .map((c) => {
      totalQuestions += c._count.questions;
      totalExamPapers += c.examPapers.length;
      return {
        courseId: c.id,
        courseCode: c.code,
        courseTitle: c.title,
        questionCount: c._count.questions,
        highYieldTopicCount: c.topics.filter((t) => t.isHighYield).length,
      };
    })
    .sort((a, b) => b.questionCount - a.questionCount);

  // Gather top high yield topics across the entire faculty
  const facultyTopics: {
    courseCode: string;
    topicName: string;
    questionCount: number;
    appearanceLikelihood: number;
  }[] = [];

  for (const c of faculty.courses) {
    for (const t of c.topics) {
      if (t.isHighYield || t.historicalFrequency >= 2) {
        facultyTopics.push({
          courseCode: c.code,
          topicName: t.name,
          questionCount: t.historicalFrequency,
          appearanceLikelihood: Math.min(99, Math.round((t.historicalFrequency / Math.max(1, c.examPapers.length)) * 100)),
        });
      }
    }
  }

  facultyTopics.sort((a, b) => b.appearanceLikelihood - a.appearanceLikelihood);

  return {
    faculty: {
      id: faculty.id,
      name: faculty.name,
      code: faculty.code,
    },
    summary: {
      totalCourses: faculty.courses.length,
      totalQuestions,
      totalExamPapers,
    },
    topTestedCourses,
    highYieldTopicsAcrossFaculty: facultyTopics.slice(0, 10),
  };
}

/**
 * Returns Exam Intelligence specifically for UI University-Wide Courses (GES block).
 */
export async function getUniversityWideCbtIntel() {
  const gesCourses = await prisma.course.findMany({
    where: { isUniversityWide: true },
    include: {
      topics: {
        include: {
          _count: { select: { questions: true } },
        },
      },
      examPapers: true,
      _count: { select: { questions: true } },
    },
    orderBy: { code: "asc" },
  });

  return {
    title: "University of Ibadan General Studies (GES) CBT Hall Intelligence",
    courses: gesCourses.map((c) => ({
      id: c.id,
      code: c.code,
      title: c.title,
      questionBankSize: c._count.questions,
      pastExamSessions: c.examPapers.length,
      highYieldTopics: c.topics
        .filter((t) => t.isHighYield || t.historicalFrequency >= 1)
        .map((t) => ({
          name: t.name,
          frequency: t.historicalFrequency,
          questionsAvailable: t._count.questions,
        })),
    })),
  };
}
