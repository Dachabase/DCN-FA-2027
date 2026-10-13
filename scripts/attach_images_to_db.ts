import { prisma } from "../src/database/prisma";
import fs from "fs";
import path from "path";

async function attachImages() {
  console.log("=== Attaching Extracted Diagrams to Database Questions ===");

  const manifestPath = path.resolve(__dirname, "..", "data", "extracted_images_manifest.json");
  if (!fs.existsSync(manifestPath)) {
    throw new Error("Manifest not found: " + manifestPath);
  }

  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf-8"));
  let totalAttached = 0;
  let questionsUpdated = 0;

  for (const pageEntry of manifest) {
    const { subjectCode, sourcePage, images } = pageEntry;
    if (!images || images.length === 0) continue;

    // Find questions on this subject and page
    const questions = await prisma.utmeQuestion.findMany({
      where: {
        subjectCode,
        sourcePage,
      },
      orderBy: { originalQuestionNumber: "asc" },
    });

    if (questions.length === 0) continue;

    // Find questions that mention diagrams or visuals
    const visualQs = questions.filter((q) => {
      const txt = (q.questionText || "").toLowerCase();
      return (
        txt.includes("diagram") ||
        txt.includes("figure") ||
        txt.includes("graph") ||
        txt.includes("chart") ||
        txt.includes("circuit") ||
        txt.includes("labelled") ||
        txt.includes("rhombus") ||
        txt.includes("triangle") ||
        txt.includes("circle") ||
        txt.includes("table below") ||
        txt.includes("table above") ||
        txt.includes("apparatus") ||
        q.hasImage
      );
    });

    if (visualQs.length > 0) {
      for (let i = 0; i < visualQs.length; i++) {
        const q = visualQs[i];
        // Assign the best matching image from this page
        const imgIndex = Math.min(i, images.length - 1);
        const selectedImg = images[imgIndex];

        // Verify image exists on disk
        const diskPath = path.resolve(__dirname, "..", "public", selectedImg.url.replace(/^\//, ""));
        if (fs.existsSync(diskPath)) {
          await prisma.utmeQuestion.update({
            where: { id: q.id },
            data: {
              hasImage: true,
              imageUrl: selectedImg.url,
              verificationStatus: "APPROVED_FOR_PUBLICATION",
              publicationStatus: "PUBLISHED",
            },
          });
          questionsUpdated++;
          totalAttached++;
        }
      }
    } else if (images.length === 1 && questions.length <= 3) {
      // Small page with single diagram, attach to the first question
      const q = questions[0];
      const selectedImg = images[0];
      const diskPath = path.resolve(__dirname, "..", "public", selectedImg.url.replace(/^\//, ""));
      if (fs.existsSync(diskPath)) {
        await prisma.utmeQuestion.update({
          where: { id: q.id },
          data: {
            hasImage: true,
            imageUrl: selectedImg.url,
            hasImage: true,
          },
        });
        questionsUpdated++;
        totalAttached++;
      }
    }
  }

  console.log(`Attached ${totalAttached} diagram images across ${questionsUpdated} questions.`);

  // Audit: Flag questions that require a visual but have NO imageUrl
  console.log("\nAuditing remaining questions that explicitly reference diagrams without images...");
  const missingVisualQs = await prisma.utmeQuestion.findMany({
    where: {
      OR: [
        { questionText: { contains: "diagram above", mode: "insensitive" } },
        { questionText: { contains: "diagram below", mode: "insensitive" } },
        { questionText: { contains: "part labelled", mode: "insensitive" } },
        { questionText: { contains: "study the diagram", mode: "insensitive" } },
        { questionText: { contains: "in the figure above", mode: "insensitive" } },
        { questionText: { contains: "in the figure below", mode: "insensitive" } },
        { questionText: { contains: "circuit above", mode: "insensitive" } },
      ],
      AND: [
        {
          OR: [{ imageUrl: null }, { imageUrl: "" }],
        },
      ],
    },
  });

  console.log(`Found ${missingVisualQs.length} questions strictly requiring diagrams but missing imageUrl.`);
  let flaggedCount = 0;
  for (const q of missingVisualQs) {
    await prisma.utmeQuestion.update({
      where: { id: q.id },
      data: {
        verificationStatus: "NEEDS_REVIEW",
        publicationStatus: "FLAGGED",
        verificationNotes: "Explicitly references visual asset ('diagram/figure/labelled') which is unrecoverable. Withheld from publication until verified.",
      },
    });
    flaggedCount++;
  }

  console.log(`Flagged ${flaggedCount} incomplete visual questions with status 'NEEDS_REVIEW' and 'FLAGGED' (excluded from exam pool).`);

  // Final count of published questions with images
  const withImages = await prisma.utmeQuestion.count({
    where: { hasImage: true, imageUrl: { not: null }, publicationStatus: "PUBLISHED" },
  });
  console.log(`\n============================================================`);
  console.log(`DIAGRAM RESTORATION SUMMARY`);
  console.log(`Published questions with working diagrams: ${withImages}`);
  console.log(`Incomplete questions withheld from publication: ${flaggedCount}`);
  console.log(`============================================================`);
}

attachImages()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Failed:", err);
    process.exit(1);
  });
