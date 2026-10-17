import "dotenv/config";
import { prisma } from "../src/database/prisma";
import fs from "fs";
import path from "path";

const FACULTY_DIR_TO_CODE: Record<string, string> = {
  "Faculty of Art": "ARTS",
  "Faculty of Law": "LAW",
  "Faculty of computing": "COMPUTING",
  "Faculty of economics": "ECON_MGMT",
  "Faculty of renewable natural resources": "NAT_RES",
  "Faculty of science and technology": "SCIENCE",
  "Faculty of social sciences": "SOCIAL_SCI",
  "Faculty of vet medicine": "VET_MED",
};

function cleanTitle(filename: string): string {
  // Remove extension
  let base = filename.replace(/\.[^/.]+$/, "");
  // Remove trailing UUIDs or MD5 hashes (e.g. _823c626ea4c12ef995469740c89db8a6)
  base = base.replace(/_[a-f0-9]{32}$/i, "");
  // Replace underscores and extra spaces
  base = base.replace(/[_-]+/g, " ").trim();
  // Clean repeated phrases
  base = base.replace(/\s+/g, " ");
  return base;
}

function categoryToReadable(cat: string): string {
  switch (cat) {
    case "PAST_QUESTIONS": return "Past Questions";
    case "LECTURE_NOTES": return "Lecture Notes";
    case "TEXTBOOK": return "Textbook";
    case "PRACTICAL_MANUAL": return "Laboratory Manual";
    case "TUTORIAL_SHEET": return "Tutorial Problem Sets";
    case "SYLLABUS": return "Course Outline & Syllabus";
    default: return "Academic Study Material";
  }
}

async function ingestMaterials() {
  console.log("Loading refined materials inventory...");
  const rawData = fs.readFileSync("data/refined_materials_inventory.json", "utf-8");
  const inventory = JSON.parse(rawData);
  console.log(`Total inventory records: ${inventory.length}`);

  // Fetch faculties & courses for foreign key lookup
  const faculties = await prisma.faculty.findMany();
  const facMap = new Map(faculties.map(f => [f.code, f.id]));

  const courses = await prisma.course.findMany();
  const courseMap = new Map<string, string>();
  for (const c of courses) {
    courseMap.set(c.code.toUpperCase().trim(), c.id);
    const clean = c.code.replace(/^C-/, "").trim().toUpperCase();
    courseMap.set(clean, c.id);
    courseMap.set(clean.replace(" ", ""), c.id);
  }

  // Deduplication tracking by file hash
  const seenHashes = new Set<string>();
  const duplicateRecords: any[] = [];
  const validRecords: any[] = [];

  for (let i = 0; i < inventory.length; i++) {
    const item = inventory[i];
    const hash = item.hash;

    if (hash && seenHashes.has(hash)) {
      duplicateRecords.push({ id: item.id, rel_path: item.rel_path, hash });
      continue;
    }
    if (hash) {
      seenHashes.add(hash);
    }

    const facCode = FACULTY_DIR_TO_CODE[item.faculty_dir];
    const facultyId = facCode ? facMap.get(facCode) || null : null;

    let courseId: string | null = null;
    if (item.course_code) {
      const normalizedCode = item.course_code.toUpperCase().trim();
      courseId = courseMap.get(normalizedCode) || courseMap.get(normalizedCode.replace(" ", "")) || null;
    }

    const title = cleanTitle(item.filename);
    const readableCat = categoryToReadable(item.category);
    const courseLabel = item.course_code ? `[${item.course_code}] ` : "";
    const displayTitle = `${courseLabel}${title}`;

    const description = `${readableCat} for ${item.course_title || item.course_code || "100-Level Undergraduate"}. ` +
      `File format: ${item.ext.toUpperCase()}, ${item.page_count} page(s), ${Math.round(item.size / 1024)} KB. ` +
      `${item.is_scanned ? "Scanned archival document." : "Digital text searchable."}`;

    const resourceId = `res_100l_${(i + 1).toString().padStart(5, "0")}`;
    const downloadUrl = `/api/vault/file/${resourceId}`;

    const tags = ["100L", "UI_ACADEMIC_VAULT", item.category];
    if (item.course_code) tags.push(item.course_code);
    if (item.semester) tags.push(`${item.semester} Semester`);
    if (item.exam_year) tags.push(`${item.exam_year}`);

    validRecords.push({
      id: resourceId,
      type: item.ext.replace(".", "").toLowerCase() || "pdf",
      title: displayTitle.slice(0, 250),
      description: description.slice(0, 1000),
      url: downloadUrl,
      category: readableCat,
      tags: tags,
      audience: ["UI_100_LEVEL_STUDENT"],
      status: "PUBLISHED",
      facultyId: facultyId,
      courseId: courseId,
      courseCode: item.course_code || null,
      fileSize: item.size || 0,
      filePath: item.rel_path,
      fileHash: item.hash || null,
      fileFormat: item.ext.toLowerCase(),
      pageCount: item.page_count || 1,
      semester: item.semester || "1st",
      academicSession: item.exam_year ? `${item.exam_year}/${item.exam_year + 1}` : null,
      isScanned: item.is_scanned || false,
      hasQuestions: item.category === "PAST_QUESTIONS" || item.has_questions || false,
      source: `University of Ibadan Academic Directorate / ${item.faculty_dir}`,
      verifiedDate: new Date(),
      owner: "UI Academic Directorate",
    });
  }

  console.log(`Unique materials to ingest: ${validRecords.length}`);
  console.log(`Duplicate files detected & safely de-duplicated: ${duplicateRecords.length}`);

  // Ingest in manageable batches of 200 using createMany (or upsert)
  const BATCH_SIZE = 200;
  let totalInserted = 0;

  for (let i = 0; i < validRecords.length; i += BATCH_SIZE) {
    const batch = validRecords.slice(i, i + BATCH_SIZE);
    
    // Use upsert/transaction or createMany
    const result = await prisma.resource.createMany({
      data: batch,
      skipDuplicates: true,
    });
    totalInserted += result.count;
    console.log(`Ingested batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(validRecords.length / BATCH_SIZE)}: +${result.count} resources`);
  }

  const finalResourceCount = await prisma.resource.count({
    where: { audience: { has: "UI_100_LEVEL_STUDENT" } },
  });

  console.log(`\nMaterials Vault Ingestion Finished!`);
  console.log(`Total 100-Level Resources in DB: ${finalResourceCount}`);

  // Save audit log of duplicates
  fs.writeFileSync("scratch/materials_vault_duplicates.json", JSON.stringify(duplicateRecords, null, 2));
}

ingestMaterials()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
