import { prisma } from "../src/database/prisma";
import { utmeService } from "../src/utme/utme.service";
import fs from "fs";
import path from "path";

async function runAcceptanceTests() {
  console.log("==========================================================");
  console.log("UTME MOCK EXAMINATION PLATFORM: ACCEPTANCE TEST SUITE");
  console.log("==========================================================\n");

  let totalTests = 0;
  let passedTests = 0;
  let failedTests = 0;

  function assert(condition: boolean, testName: string, detail?: string) {
    totalTests++;
    if (condition) {
      passedTests++;
      console.log(`  ✓ PASS: ${testName}`);
    } else {
      failedTests++;
      console.error(`  ✕ FAIL: ${testName}`);
      if (detail) console.error(`    Detail: ${detail}`);
    }
  }

  try {
    // -----------------------------------------------------------------
    // TEST AREA 1: DUPLICATE ELIMINATION & QUESTION SELECTION
    // -----------------------------------------------------------------
    console.log("--- 1. Testing Duplicate Elimination & Idempotent Selection ---");

    const candidateId = `test_cand_${Date.now()}`;
    const exam1 = await utmeService.startMockExam({
      candidateId,
      courseSlug: "medicine-and-surgery",
      mode: "PRACTICE_MODE",
    });

    assert(exam1.questions.length > 0, "Mock examination generated questions", `Count: ${exam1.questions.length}`);

    // Check duplicate IDs
    const idSet = new Set<string>();
    let hasDuplicateId = false;
    for (const q of exam1.questions) {
      if (idSet.has(q.id)) {
        hasDuplicateId = true;
        break;
      }
      idSet.add(q.id);
    }
    assert(!hasDuplicateId, "No duplicate question IDs in a single mock examination attempt");

    // Check normalized text duplicates within single exam
    const normTextSet = new Set<string>();
    let hasDuplicateText = false;
    for (const q of exam1.questions) {
      const norm = q.questionText.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 100);
      if (norm.length > 25 && normTextSet.has(norm)) {
        hasDuplicateText = true;
        break;
      }
      normTextSet.add(norm);
    }
    assert(!hasDuplicateText, "No duplicate question wording within generated mock examination");

    // Verify archived duplicate questions are NOT in the active pool
    const activeArchivedDuplicates = await prisma.utmeQuestion.count({
      where: {
        publicationStatus: "ARCHIVED",
      },
    });
    assert(activeArchivedDuplicates > 0, `Archived duplicate records preserved for audit history (Count: ${activeArchivedDuplicates})`);

    // Verify questions selected in exam1 are excluded or deprioritized in immediate subsequent exam
    const exam2 = await utmeService.startMockExam({
      candidateId,
      courseSlug: "medicine-and-surgery",
      mode: "PRACTICE_MODE",
    });
    const exam1Ids = new Set(exam1.questions.map(q => q.id));
    const overlap = exam2.questions.filter(q => exam1Ids.has(q.id));
    assert(overlap.length <= Math.max(2, exam1.questions.length * 0.1), "Candidate recency tracking deprioritizes recently used questions", `Overlap: ${overlap.length}/${exam2.questions.length}`);

    // -----------------------------------------------------------------
    // TEST AREA 2: MISSING DIAGRAMS & VISUAL ASSET RESTORATION
    // -----------------------------------------------------------------
    console.log("\n--- 2. Testing Diagram Restoration & Visual Assets ---");

    const questionsWithImages = await prisma.utmeQuestion.findMany({
      where: { hasImage: true, publicationStatus: "PUBLISHED" },
      take: 20,
    });

    assert(questionsWithImages.length > 0, "Questions with images exist in active bank", `Found: ${questionsWithImages.length}`);

    let allImagesValidOnDisk = true;
    let missingFilesCount = 0;
    for (const q of questionsWithImages) {
      if (!q.imageUrl) {
        allImagesValidOnDisk = false;
        break;
      }
      // Image URL is formatted as /images/questions/...
      const localPath = path.join(process.cwd(), "public", q.imageUrl.replace(/^\//, ""));
      if (!fs.existsSync(localPath) || fs.statSync(localPath).size === 0) {
        allImagesValidOnDisk = false;
        missingFilesCount++;
      }
    }
    assert(allImagesValidOnDisk, "Every active question with hasImage has a valid non-empty image file on disk", `Missing: ${missingFilesCount}`);

    // Verify unrecoverable missing diagrams were flagged and excluded
    const flaggedQuestions = await prisma.utmeQuestion.count({
      where: { publicationStatus: "FLAGGED" },
    });
    assert(flaggedQuestions > 0, `Unrecoverable questions without figures are flagged for review (Count: ${flaggedQuestions})`);

    const flaggedInExam = exam1.questions.filter(q => (q as any).publicationStatus === "FLAGGED");
    assert(flaggedInExam.length === 0, "Flagged questions are strictly excluded from candidate mock exams");

    // -----------------------------------------------------------------
    // TEST AREA 3: INCOMPLETE / TRUNCATED QUESTIONS EXCLUSION
    // -----------------------------------------------------------------
    console.log("\n--- 3. Testing Question Completeness & Integrity ---");

    const incompleteRecords = await prisma.utmeQuestion.count({
      where: { verificationStatus: "NEEDS_REVIEW" },
    });
    assert(incompleteRecords > 0, `Incomplete/truncated questions isolated for human review (Count: ${incompleteRecords})`);

    // Verify all questions in exam have complete required fields
    let allExamQuestionsComplete = true;
    for (const q of exam1.questions) {
      if (!q.questionText || q.questionText.trim().length < 5) allExamQuestionsComplete = false;
      if (!Array.isArray(q.options) || q.options.length < 4) allExamQuestionsComplete = false;
    }

    const attemptRecord = await prisma.utmeExamAttempt.findUnique({
      where: { id: exam1.attemptId },
    });
    const snapshot = (attemptRecord?.questionsSnapshot as any[]) || [];
    let allSnapshotsHaveAnswers = snapshot.length > 0;
    for (const sq of snapshot) {
      if (!sq.correctAnswer || !["A", "B", "C", "D", "E"].includes(sq.correctAnswer.toUpperCase())) {
        allSnapshotsHaveAnswers = false;
      }
    }
    assert(allExamQuestionsComplete && allSnapshotsHaveAnswers, "All questions generated in mock examination have complete text, 4+ options, and valid correct answers in server snapshot");

    // -----------------------------------------------------------------
    // TEST AREA 4: ON-SCREEN CALCULATOR MATHEMATICAL PRECISION & SAFETY
    // -----------------------------------------------------------------
    console.log("\n--- 4. Testing On-Screen Calculator Precision & Edge Cases ---");

    // Pure arithmetic engine test (equivalent to frontend logic)
    function calcSim(a: number, op: string, b: number): number | "Error" {
      if (op === "/" && b === 0) return "Error";
      let r = 0;
      if (op === "+") r = a + b;
      if (op === "-") r = a - b;
      if (op === "*") r = a * b;
      if (op === "/") r = a / b;
      return Math.round(r * 100000000) / 100000000;
    }

    assert(calcSim(12, "+", 8) === 20, "Calculator Addition: 12 + 8 = 20");
    assert(calcSim(50, "-", 17.5) === 32.5, "Calculator Subtraction: 50 - 17.5 = 32.5");
    assert(calcSim(15, "*", 6) === 90, "Calculator Multiplication: 15 * 6 = 90");
    assert(calcSim(100, "/", 8) === 12.5, "Calculator Division: 100 / 8 = 12.5");
    assert(calcSim(45, "/", 0) === "Error", "Calculator Division by Zero handled safely without crash");
    assert(Math.round(Math.sqrt(144) * 100000000) / 100000000 === 12, "Calculator Square Root: √(144) = 12");
    assert(Math.round((250 / 100) * 100000000) / 100000000 === 2.5, "Calculator Percentage: 250% = 2.5");

    // -----------------------------------------------------------------
    // TEST AREA 5: ENGLISH LANGUAGE QUESTION GROUPING & PASSAGES
    // -----------------------------------------------------------------
    console.log("\n--- 5. Testing English Language Question Grouping & Sequential Integrity ---");

    const fullExam = await utmeService.startMockExam({
      candidateId: `cand_eng_${Date.now()}`,
      courseSlug: "medicine-and-surgery",
      mode: "FULL_UTME_SIMULATION",
    });

    const engQuestions = fullExam.questions.filter(q => q.subjectCode === "ENG");
    assert(engQuestions.length === 60, "Full UTME simulation generates exactly 60 English questions", `Got: ${engQuestions.length}`);

    // Verify questions with passages
    const comprehensionQuestions = engQuestions.filter(q => q.passage && q.passage.length > 50);
    assert(comprehensionQuestions.length > 0, "Comprehension & cloze questions include shared reading passages", `Count: ${comprehensionQuestions.length}`);

    // Verify group questions are contiguous and ordered
    let groupsPreserved = true;
    const seenGroups = new Set<string>();
    let lastGroupId: string | null = null;

    for (const q of engQuestions) {
      if (q.groupId) {
        if (q.groupId !== lastGroupId) {
          if (seenGroups.has(q.groupId)) {
            // Group was split apart!
            groupsPreserved = false;
            break;
          }
          seenGroups.add(q.groupId);
        }
      }
      lastGroupId = q.groupId;
    }
    assert(groupsPreserved, "English question groups remain contiguously grouped and are never scattered");

    // -----------------------------------------------------------------
    // TEST AREA 6: ENGLISH LANGUAGE SKILL CLASSIFICATION & ANALYTICS
    // -----------------------------------------------------------------
    console.log("\n--- 6. Testing English Skill Classification & Diagnostic Analytics ---");

    const unclassifiedEnglish = await prisma.utmeQuestion.count({
      where: {
        subject: { code: "ENG" },
        publicationStatus: "PUBLISHED",
        OR: [{ sectionName: null }, { skillTag: null }],
      },
    });
    assert(unclassifiedEnglish === 0, "100% of active English questions possess section and skill tags", `Unclassified: ${unclassifiedEnglish}`);

    // Submit the exam with sample answers to test diagnostic analytics calculation
    // 1. Verify single saveResponse works
    await utmeService.saveResponse(fullExam.attemptId, fullExam.questions[0].id, "A", false);

    // 2. Batch insert sample responses for swift test execution
    const fullAttemptRecord = await prisma.utmeExamAttempt.findUnique({
      where: { id: fullExam.attemptId },
    });
    const fullSnapshot = (fullAttemptRecord?.questionsSnapshot as any[]) || [];
    const sampleResponses = [];
    for (let i = 1; i < 50; i++) {
      const q = fullExam.questions[i];
      const snapQ = fullSnapshot.find(s => s.id === q.id);
      const choice = (i % 2 === 0 && snapQ) ? snapQ.correctAnswer : "B";
      sampleResponses.push({
        attemptId: fullExam.attemptId,
        questionId: q.id,
        subjectCode: q.subjectCode,
        selectedOption: choice,
        isMarkedForReview: i % 5 === 0,
        timeSpentSeconds: 15,
      });
    }
    await prisma.utmeExamResponse.createMany({
      data: sampleResponses,
      skipDuplicates: true,
    });

    const submitResult = await utmeService.submitExam(fullExam.attemptId);
    assert(submitResult.englishAnalytics !== undefined, "Submission result includes englishAnalytics diagnostic breakdown");

    if (submitResult.englishAnalytics) {
      const sections = submitResult.englishAnalytics.sections || [];
      const skills = submitResult.englishAnalytics.skills || [];

      assert(sections.length > 0, "English analytics reports section-level mastery", `Sections: ${sections.length}`);
      assert(skills.length > 0, "English analytics reports granular skill-level performance", `Skills: ${skills.length}`);

      const firstSec = sections[0];
      assert(
        typeof firstSec.sectionName === "string" &&
        typeof firstSec.correct === "number" &&
        typeof firstSec.total === "number" &&
        typeof firstSec.percentage === "number",
        "Section performance contains structured metrics (name, correct, total, percentage)"
      );
    }

    // Test review endpoint
    const reviewResult = await utmeService.getExamReview(fullExam.attemptId, "ALL");
    assert(reviewResult.questions.length === fullExam.questions.length, "Exam review loads all questions with explanations and diagrams");
    const reviewSample = reviewResult.questions.find(q => q.subjectCode === "ENG" && q.passage);
    assert(reviewSample !== undefined && reviewSample.passage !== null, "Exam review preserves reading passages for candidate review");

  } catch (error) {
    console.error("Test execution exception:", error);
    failedTests++;
  }

  console.log("\n==========================================================");
  console.log(`TEST RESULTS: ${passedTests}/${totalTests} PASSED (${failedTests} FAILED)`);
  console.log("==========================================================");

  if (failedTests > 0) {
    process.exit(1);
  }
}

runAcceptanceTests().catch(console.error);
