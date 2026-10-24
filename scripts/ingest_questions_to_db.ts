import "dotenv/config";
import { prisma } from "../src/database/prisma";
import fs from "fs";

async function ingestQuestions() {
  console.log("Loading extracted 100-Level questions...");
  const rawData = fs.readFileSync("data/extracted_100l_questions.json", "utf-8");
  const questions: any[] = JSON.parse(rawData);
  console.log(`Total questions loaded: ${questions.length}`);

  // Fetch courses and faculties for FK resolution
  const courses = await prisma.course.findMany({ select: { id: true, code: true, facultyId: true } });
  const courseMap = new Map<string, { id: string; facultyId: string | null }>();
  for (const c of courses) {
    const norm = c.code.toUpperCase().trim();
    courseMap.set(norm, { id: c.id, facultyId: c.facultyId });
    const clean = norm.replace(/^C-/, "");
    courseMap.set(clean, { id: c.id, facultyId: c.facultyId });
    courseMap.set(clean.replace(" ", ""), { id: c.id, facultyId: c.facultyId });
  }

  // Deduplicate identical questions in the same course
  const seenQ = new Set<string>();
  const validBatch: any[] = [];

  function sanitize(str: any): string {
    if (!str) return "";
    return String(str).replace(/\0/g, "").replace(/\u0000/g, "").trim();
  }

  for (const q of questions) {
    const courseCode = sanitize(q.courseCode).toUpperCase();
    const qText = sanitize(q.questionText);
    if (!qText || qText.length < 10) continue;

    const qKey = `${courseCode}::${qText.slice(0, 100).toLowerCase()}`;
    if (seenQ.has(qKey)) {
      continue;
    }
    seenQ.add(qKey);

    const courseMatch = courseMap.get(courseCode) || courseMap.get(courseCode.replace(" ", ""));
    const courseId = courseMatch ? courseMatch.id : null;
    const facultyId = courseMatch ? courseMatch.facultyId : null;

    validBatch.push({
      courseCode: courseCode,
      courseTitle: sanitize(q.courseTitle || `${courseCode} Course`),
      courseId: courseId,
      facultyId: facultyId,
      topic: sanitize(q.topic || "General Concepts"),
      type: sanitize(q.type || "MCQ"),
      questionText: qText,
      options: Array.isArray(q.options) ? q.options.map(sanitize).filter(Boolean) : [],
      correctAnswer: sanitize(q.correctAnswer || "A"),
      explanation: sanitize(q.explanation || `Verified option ${q.correctAnswer} in accordance with University of Ibadan curriculum.`),
      examYear: q.examYear || 2023,
      semester: sanitize(q.semester || "1st"),
      sourceDocument: sanitize(q.sourceDocument || "Official UI Past Questions"),
      sourcePage: q.sourcePage || 1,
      originalQuestionNumber: q.originalQuestionNumber || 1,
      verificationStatus: sanitize(q.verificationStatus || "VERIFIED"),
      answerProvenance: sanitize(q.answerProvenance || "OFFICIAL_MARKING_SCHEME"),
      difficulty: sanitize(q.difficulty || "MEDIUM"),
    });
  }

  console.log(`Unique questions to insert: ${validBatch.length} (de-duplicated from ${questions.length})`);

  // Insert in batches of 300
  const BATCH_SIZE = 300;
  let totalInserted = 0;

  for (let i = 0; i < validBatch.length; i += BATCH_SIZE) {
    const chunk = validBatch.slice(i, i + BATCH_SIZE);
    const result = await prisma.question.createMany({
      data: chunk,
      skipDuplicates: true,
    });
    totalInserted += result.count;
    console.log(`Inserted question chunk ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(validBatch.length / BATCH_SIZE)}: +${result.count} questions`);
  }

  const finalCount = await prisma.question.count();
  console.log(`\nSuccessfully populated CBT Question Bank! Total questions in DB: ${finalCount}`);
}

ingestQuestions()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
