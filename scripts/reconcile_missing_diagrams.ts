import { prisma } from "../src/database/prisma";

async function reconcileMissingDiagrams() {
  console.log("Reconciling questions with hasImage: true and imageUrl: null...");

  const questions = await prisma.utmeQuestion.findMany({
    where: {
      hasImage: true,
      imageUrl: null,
    },
  });

  console.log(`Found ${questions.length} questions to evaluate.`);

  let flaggedCount = 0;
  let clearedCount = 0;

  const visualPhrases = [
    /diagram\s+(below|above|shown|illustrat)/i,
    /study\s+the\s+diagram/i,
    /figure\s+(below|above|shown)/i,
    /in\s+the\s+diagram/i,
    /from\s+the\s+diagram/i,
    /shown\s+in\s+the\s+(diagram|figure|graph)/i,
    /refer\s+to\s+the\s+(diagram|figure)/i,
    /chart\s+(below|above)/i,
    /graph\s+(below|above)/i,
    /circuit\s+(below|above|shown)/i,
    /structure\s+(below|above|shown)/i,
  ];

  for (const q of questions) {
    const text = q.questionText || "";
    const trulyNeedsDiagram = visualPhrases.some(p => p.test(text));

    if (trulyNeedsDiagram) {
      // Must not be published without its required diagram
      await prisma.utmeQuestion.update({
        where: { id: q.id },
        data: {
          publicationStatus: "FLAGGED",
          verificationStatus: "NEEDS_REVIEW",
          verificationNotes: "Unrecoverable source figure: requires human review before publication",
        },
      });
      flaggedCount++;
    } else {
      // False positive (e.g., 'financial figures', 'sales figure')
      await prisma.utmeQuestion.update({
        where: { id: q.id },
        data: {
          hasImage: false,
        },
      });
      clearedCount++;
    }
  }

  console.log(`Reconciliation complete:`);
  console.log(`- Flagged unrecoverable diagram questions: ${flaggedCount}`);
  console.log(`- Cleared false-positive hasImage tags: ${clearedCount}`);
}

reconcileMissingDiagrams().then(() => process.exit(0)).catch(console.error);
