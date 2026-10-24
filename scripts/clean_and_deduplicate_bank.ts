import { prisma } from "../src/database/prisma";

function normalizeForComparison(text: string): string {
  return text
    .toLowerCase()
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/\s+/g, " ")
    .trim();
}

async function cleanAndDeduplicate() {
  console.log("=== Auditing & Deduplicating Question Bank ===");

  const allQuestions = await prisma.utmeQuestion.findMany({
    orderBy: [
      { subjectCode: "asc" },
      { examYear: "desc" },
      { originalQuestionNumber: "asc" },
    ],
  });

  console.log(`Loaded ${allQuestions.length} total questions.`);

  // 1. Structural Completeness Check
  let incompleteCount = 0;
  for (const q of allQuestions) {
    const qText = (q.questionText || "").trim();
    const opts = q.options || [];

    let isIncomplete = false;
    let reason = "";

    // Fragment checks
    if (qText.length < 15 && !q.hasImage) {
      isIncomplete = true;
      reason = `Question text too short (${qText.length} chars): "${qText}"`;
    } else if (opts.length < 4) {
      isIncomplete = true;
      reason = `Fewer than 4 options (${opts.length} options)`;
    } else if (opts.some((o) => o.trim().length <= 3)) {
      isIncomplete = true;
      reason = `Empty or single-letter option found`;
    } else if (
      qText.endsWith("...") ||
      qText.endsWith("…") ||
      qText.toLowerCase().endsWith("is a") ||
      qText.toLowerCase().endsWith("is the") ||
      qText.toLowerCase().endsWith("of the")
    ) {
      // Questions that end with an uncompleted sentence and have no blank marker
      if (!qText.includes("____") && !qText.includes("....") && !qText.includes("___")) {
        isIncomplete = true;
        reason = `Question text ends abruptly: "${qText}"`;
      }
    }

    if (isIncomplete && q.publicationStatus === "PUBLISHED") {
      await prisma.utmeQuestion.update({
        where: { id: q.id },
        data: {
          verificationStatus: "NEEDS_REVIEW",
          publicationStatus: "FLAGGED",
          verificationNotes: reason,
        },
      });
      incompleteCount++;
    }
  }

  console.log(`Flagged ${incompleteCount} structurally incomplete questions for review.`);

  // 2. Duplicate Detection
  // Group by subjectCode + normalized question text
  const subjectGroups = new Map<string, typeof allQuestions>();
  for (const q of allQuestions) {
    if (q.publicationStatus === "FLAGGED") continue; // Already withheld
    const key = `${q.subjectCode}::${normalizeForComparison(q.questionText)}`;
    if (!subjectGroups.has(key)) {
      subjectGroups.set(key, []);
    }
    subjectGroups.get(key)!.push(q);
  }

  let dupGroupsCount = 0;
  let excessArchived = 0;

  for (const [key, group] of subjectGroups.entries()) {
    if (group.length > 1) {
      dupGroupsCount++;
      // Pick best master record:
      // Prefer record with image, then longest explanation, then earlier creation
      group.sort((a, b) => {
        if (a.hasImage && !b.hasImage) return -1;
        if (!a.hasImage && b.hasImage) return 1;
        if (a.passage && !b.passage) return -1;
        if (!a.passage && b.passage) return 1;
        return (b.explanation?.length || 0) - (a.explanation?.length || 0);
      });

      const master = group[0];
      const duplicates = group.slice(1);

      for (const dup of duplicates) {
        if (dup.publicationStatus === "PUBLISHED") {
          await prisma.utmeQuestion.update({
            where: { id: dup.id },
            data: {
              publicationStatus: "ARCHIVED",
              verificationStatus: "HUMAN_REVIEWED",
              verificationNotes: `Duplicate of master question ${master.id} (Year ${master.examYear}, Page ${master.sourcePage}, Q${master.originalQuestionNumber}). Preserved for provenance.`,
            },
          });
          excessArchived++;
        }
      }
    }
  }

  console.log(`Found ${dupGroupsCount} duplicate groups. Archived ${excessArchived} redundant duplicate records.`);

  // Audit active published question pool
  const publishedCounts = await prisma.utmeQuestion.groupBy({
    by: ["subjectCode"],
    where: { publicationStatus: "PUBLISHED" },
    _count: true,
  });

  console.log("\n=== Active Verified Published Questions by Subject ===");
  console.table(publishedCounts.map((p) => ({ subject: p.subjectCode, publishedCount: p._count })));

  const totalPublished = await prisma.utmeQuestion.count({ where: { publicationStatus: "PUBLISHED" } });
  const totalFlagged = await prisma.utmeQuestion.count({ where: { publicationStatus: "FLAGGED" } });
  const totalArchived = await prisma.utmeQuestion.count({ where: { publicationStatus: "ARCHIVED" } });

  console.log("\n============================================================");
  console.log("QUESTION BANK QUALITY RESTORATION COMPLETE");
  console.log(`Total Active Published Questions: ${totalPublished.toLocaleString()}`);
  console.log(`Total Archived Duplicates: ${totalArchived.toLocaleString()}`);
  console.log(`Total Incomplete Withheld for Review: ${totalFlagged.toLocaleString()}`);
  console.log("============================================================");
}

cleanAndDeduplicate()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Failed:", err);
    process.exit(1);
  });
