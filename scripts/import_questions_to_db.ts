import fs from "fs";
import path from "path";
import { prisma } from "../src/database/prisma";

const PARSED_DIR = path.resolve(__dirname, "..", "data", "parsed_json");

async function importAll() {
  console.log("Starting question bank import into UtmeQuestion table...");

  // Load subject IDs
  const subjects = await prisma.utmeSubject.findMany();
  const subjectMap = new Map<string, string>();
  for (const s of subjects) {
    subjectMap.set(s.code, s.id);
  }

  const files = fs.readdirSync(PARSED_DIR).filter((f) => f.endsWith("_parsed.json"));
  let totalInserted = 0;

  for (const file of files) {
    const fpath = path.join(PARSED_DIR, file);
    const data = JSON.parse(fs.readFileSync(fpath, "utf-8"));
    const code = file.replace("_parsed.json", "").toUpperCase();
    const subjectId = subjectMap.get(code) || null;

    console.log(`\nImporting ${data.length} questions for subject [${code}]...`);

    // Batch insert 300 at a time
    const BATCH_SIZE = 300;
    for (let i = 0; i < data.length; i += BATCH_SIZE) {
      const batch = data.slice(i, i + BATCH_SIZE).map((q: any) => ({
        id: q.id,
        subjectCode: q.subjectCode,
        subjectName: q.subjectName,
        subjectId: subjectId,
        topic: q.topic,
        subtopic: q.subtopic || null,
        examYear: q.examYear,
        sourceDocument: q.sourceDocument,
        sourcePage: q.sourcePage,
        originalQuestionNumber: q.originalQuestionNumber,
        questionText: q.questionText,
        passage: q.passage || null,
        options: q.options,
        correctAnswer: q.correctAnswer,
        explanation: q.explanation,
        whyOthersIncorrect: q.whyOthersIncorrect || null,
        verificationStatus: q.verificationStatus as any,
        verificationNotes: q.verificationNotes || null,
        extractionConfidence: q.extractionConfidence || 1.0,
        hasImage: q.hasImage || false,
        imageUrl: q.imageUrl || null,
        syllabusTopic: q.syllabusTopic || q.topic,
        publicationStatus: "PUBLISHED" as any,
      }));

      const res = await prisma.utmeQuestion.createMany({
        data: batch,
        skipDuplicates: true,
      });

      totalInserted += res.count;
      process.stdout.write(`  Inserted ${res.count} records (Batch ${i / BATCH_SIZE + 1} of ${Math.ceil(data.length / BATCH_SIZE)})\r`);
    }
    console.log(`\nFinished ${code}: imported successfully.`);
  }

  const finalCount = await prisma.utmeQuestion.count();
  console.log(`\n============================================================`);
  console.log(`DATABASE IMPORT COMPLETE`);
  console.log(`Total questions in UtmeQuestion table: ${finalCount.toLocaleString()}`);
  console.log(`============================================================`);
}

importAll()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Import failed:", err);
    process.exit(1);
  });
