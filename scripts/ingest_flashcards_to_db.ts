import "dotenv/config";
import { prisma } from "../src/database/prisma";
import fs from "fs";

async function ingestFlashcards() {
  console.log("Loading generated 100-Level flashcards...");
  const rawData = fs.readFileSync("data/generated_100l_flashcards.json", "utf-8");
  const flashcards: any[] = JSON.parse(rawData);
  console.log(`Total flashcards loaded from file: ${flashcards.length}`);

  // Fetch courses to link courseId and official courseTitle
  const courses = await prisma.course.findMany({ select: { id: true, code: true, title: true } });
  const courseMap = new Map<string, { id: string; title: string }>();
  for (const c of courses) {
    const norm = c.code.toUpperCase().trim();
    courseMap.set(norm, { id: c.id, title: c.title });
    const clean = norm.replace(/^C-/, "");
    courseMap.set(clean, { id: c.id, title: c.title });
    courseMap.set(clean.replace(" ", ""), { id: c.id, title: c.title });
  }

  function sanitize(str: any): string {
    if (!str) return "";
    return String(str).replace(/\0/g, "").replace(/\u0000/g, "").trim();
  }

  const records: any[] = [];
  for (const card of flashcards) {
    const code = sanitize(card.courseCode).toUpperCase();
    const courseMatch = courseMap.get(code) || courseMap.get(code.replace(" ", ""));
    const courseId = courseMatch ? courseMatch.id : null;
    const courseTitle = courseMatch ? courseMatch.title : `${code} Lecture Notes`;

    records.push({
      courseCode: code,
      courseTitle: courseTitle,
      courseId: courseId,
      topic: sanitize(card.topic || "Core Concepts"),
      front: sanitize(card.front),
      back: sanitize(card.back),
      explanation: sanitize(card.explanation || ""),
      sourceDocument: sanitize(card.sourceDocument || "UI 100-Level Course Materials"),
      sourcePage: card.sourcePage || 1,
      verificationStatus: "VERIFIED",
      difficulty: sanitize(card.difficulty || "MEDIUM"),
    });
  }

  console.log(`Inserting ${records.length} course flashcards into database...`);
  const result = await prisma.courseFlashcard.createMany({
    data: records,
  });

  const total = await prisma.courseFlashcard.count();
  console.log(`Successfully ingested flashcards! Inserted: ${result.count}. Total in DB: ${total}`);
}

ingestFlashcards()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
