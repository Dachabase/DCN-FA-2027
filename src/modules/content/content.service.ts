import { prisma } from "../../database/prisma";
import { ContentImportPayload, QuestionImportItem } from "./content.types";

/**
 * Lists all active faculties and their departments.
 */
export async function listFaculties() {
  return prisma.faculty.findMany({
    orderBy: { name: "asc" },
    include: {
      departments: {
        orderBy: { name: "asc" },
        select: {
          id: true,
          name: true,
          code: true,
        },
      },
      _count: {
        select: {
          courses: true,
          questions: true,
        },
      },
    },
  });
}

/**
 * Lists courses with optional filters (faculty, department, level, semester, university-wide).
 */
export async function listCourses(filters?: {
  facultyId?: string;
  departmentId?: string;
  level?: number;
  semester?: string;
  isUniversityWide?: boolean;
}) {
  const where: any = {};

  if (filters?.isUniversityWide !== undefined) {
    where.isUniversityWide = filters.isUniversityWide;
  }
  if (filters?.facultyId) {
    where.facultyId = filters.facultyId;
  }
  if (filters?.departmentId) {
    where.departments = {
      some: {
        departmentId: filters.departmentId,
      },
    };
  }
  if (filters?.level) {
    where.level = filters.level;
  }
  if (filters?.semester) {
    where.semester = filters.semester;
  }

  return prisma.course.findMany({
    where,
    orderBy: [{ isUniversityWide: "desc" }, { code: "asc" }],
    include: {
      faculty: {
        select: { id: true, name: true, code: true },
      },
      _count: {
        select: {
          topics: true,
          questions: true,
          examPapers: true,
          lessons: true,
        },
      },
    },
  });
}

/**
 * Retrieves course details, its syllabus topics, and past papers.
 */
export async function getCourseDetails(courseId: string) {
  return prisma.course.findUnique({
    where: { id: courseId },
    include: {
      faculty: true,
      topics: {
        orderBy: [{ isHighYield: "desc" }, { orderIndex: "asc" }, { name: "asc" }],
        include: {
          _count: {
            select: { questions: true, lessons: true },
          },
        },
      },
      examPapers: {
        orderBy: { sessionYear: "desc" },
        include: {
          _count: {
            select: { questions: true },
          },
        },
      },
    },
  });
}

/**
 * Ingestion pipeline for importing question banks and past exam papers.
 */
export async function importContentPayload(payload: ContentImportPayload) {
  const {
    courseCode,
    courseTitle,
    facultyCode,
    departmentName,
    level = 100,
    semester = "1st",
    isUniversityWide = false,
    examPaper: examPaperData,
    questions,
  } = payload;

  // 1. Resolve or create faculty if provided
  let facultyId: string | null = null;
  if (facultyCode) {
    const faculty = await prisma.faculty.findUnique({ where: { code: facultyCode } });
    if (faculty) facultyId = faculty.id;
  }

  // 2. Find or create Course
  let course = await prisma.course.findUnique({
    where: { code: courseCode },
  });

  if (!course) {
    course = await prisma.course.create({
      data: {
        code: courseCode,
        title: courseTitle,
        level,
        semester,
        units: 2,
        isUniversityWide,
        ...(facultyId ? { faculty: { connect: { id: facultyId } } } : {}),
      },
    });
  }

  // 3. Resolve or create ExamPaper if provided
  let examPaperId: string | null = null;
  if (examPaperData) {
    const existingPaper = await prisma.examPaper.findFirst({
      where: {
        courseId: course.id,
        sessionYear: examPaperData.sessionYear,
        title: examPaperData.title,
      },
    });

    if (existingPaper) {
      examPaperId = existingPaper.id;
    } else {
      const newPaper = await prisma.examPaper.create({
        data: {
          course: { connect: { id: course.id } },
          title: examPaperData.title,
          sessionYear: examPaperData.sessionYear,
          durationMin: examPaperData.durationMin || 60,
          totalMarks: examPaperData.totalMarks || 50,
          sourceType: examPaperData.sourceType || "GES_CBT_TEST",
        },
      });
      examPaperId = newPaper.id;
    }
  }

  // 4. Ingest Questions and update Topics
  let importedCount = 0;
  for (const q of questions) {
    // Find or create CourseTopic
    let topic = await prisma.courseTopic.findFirst({
      where: {
        courseId: course.id,
        name: { equals: q.topicName, mode: "insensitive" },
      },
    });

    if (!topic) {
      topic = await prisma.courseTopic.create({
        data: {
          course: { connect: { id: course.id } },
          name: q.topicName,
          historicalFrequency: 1,
          isHighYield: false,
        },
      });
    } else {
      // Increment historical frequency
      await prisma.courseTopic.update({
        where: { id: topic.id },
        data: {
          historicalFrequency: { increment: 1 },
          isHighYield: topic.historicalFrequency + 1 >= 5, // High-yield threshold
        },
      });
    }

    // Check for duplicate question text in same course
    const existingQ = await prisma.question.findFirst({
      where: {
        courseId: course.id,
        questionText: q.stem,
      },
    });

    if (existingQ) {
      // Update metadata / explanations
      await prisma.question.update({
        where: { id: existingQ.id },
        data: {
          courseTopic: { connect: { id: topic.id } },
          ...(examPaperId ? { examPaper: { connect: { id: examPaperId } } } : {}),
          explanation: q.explanation || existingQ.explanation,
          distractorNotes: (q.distractorNotes as any) || existingQ.distractorNotes,
          limbRationales: (q.limbRationales as any) || existingQ.limbRationales,
          sourceDocument: q.referenceSource || existingQ.sourceDocument,
        },
      });
    } else {
      // Create new Question
      await prisma.question.create({
        data: {
          courseCode: course.code,
          courseTitle: course.title,
          course: { connect: { id: course.id } },
          courseTopic: { connect: { id: topic.id } },
          ...(examPaperId ? { examPaper: { connect: { id: examPaperId } } } : {}),
          ...(facultyId ? { faculty: { connect: { id: facultyId } } } : {}),
          topic: topic.name,
          type: q.format === "MCQ_TF" ? "TRUE_FALSE" : "MCQ",
          questionText: q.stem,
          options: q.options,
          correctAnswer: q.correctAnswer,
          explanation: q.explanation,
          distractorNotes: (q.distractorNotes as any) || undefined,
          limbRationales: (q.limbRationales as any) || undefined,
          sourceDocument: q.referenceSource,
          examYear: q.examYear || (examPaperData ? parseInt(examPaperData.sessionYear.slice(0, 4)) : undefined),
          academicSession: q.academicSession || examPaperData?.sessionYear,
          difficulty: q.difficulty || "MEDIUM",
        },
      });
    }
    importedCount++;
  }

  return {
    success: true,
    courseId: course.id,
    courseCode: course.code,
    examPaperId,
    importedQuestionsCount: importedCount,
  };
}

/**
 * Parses CSV text format for simple past question imports:
 * Columns: courseCode,courseTitle,topicName,stem,options,correctAnswer,explanation,referenceSource
 * Options separated by "|" (e.g. "A) 10|B) 20|C) 30|D) 40")
 */
export function parseQuestionsCsv(csvContent: string): QuestionImportItem[] {
  const lines = csvContent.split(/\r?\n/).filter(line => line.trim().length > 0);
  if (lines.length < 2) return [];

  const headers = lines[0].split(",").map(h => h.trim().toLowerCase());
  const items: QuestionImportItem[] = [];

  for (let i = 1; i < lines.length; i++) {
    // Simple CSV parser handling quotes
    const row: string[] = [];
    let insideQuotes = false;
    let entry = "";
    for (const char of lines[i]) {
      if (char === '"') {
        insideQuotes = !insideQuotes;
      } else if (char === "," && !insideQuotes) {
        row.push(entry.trim());
        entry = "";
      } else {
        entry += char;
      }
    }
    row.push(entry.trim());

    if (row.length < 5) continue;

    const courseCode = row[0] || "GES107";
    const courseTitle = row[1] || "";
    const topicName = row[2] || "General";
    const stem = row[3];
    const optionsRaw = row[4];
    const correctAnswer = row[5] || "A";
    const explanation = row[6] || "Worked answer.";
    const referenceSource = row[7] || "";

    const options = optionsRaw.includes("|")
      ? optionsRaw.split("|").map(o => o.trim())
      : optionsRaw.split(";").map(o => o.trim());

    items.push({
      courseCode,
      courseTitle,
      topicName,
      format: "SBA",
      stem,
      options: options.length >= 2 ? options : ["A) True", "B) False"],
      correctAnswer,
      explanation,
      referenceSource,
      difficulty: "MEDIUM",
    });
  }

  return items;
}
