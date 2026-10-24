import { prisma } from "../src/database/prisma";
import { UtmeService } from "../src/utme/utme.service";

const utmeService = new UtmeService();

async function runVerification() {
  console.log("=========================================================");
  console.log("STARTING FULL REGRESSION & COMPREHENSIVE VERIFICATION TEST");
  console.log("=========================================================\n");

  let testsPassed = 0;
  let testsFailed = 0;

  function assert(condition: boolean, message: string) {
    if (condition) {
      console.log(`[PASS] ${message}`);
      testsPassed++;
    } else {
      console.error(`[FAIL] ${message}`);
      testsFailed++;
    }
  }

  try {
    const testUser = await prisma.user.findFirst();
    const testUserId = testUser ? testUser.id : "guest_user";
    console.log(`Using test user ID: ${testUserId} (${testUser?.email || "anonymous"})`);

    // ----------------------------------------------------
    // TEST 1: Question Bank Audit & Provenance Verification
    // ----------------------------------------------------
    console.log("--- TEST 1: Question Bank Audit Trail ---");
    const totalQuestions = await prisma.utmeQuestion.count();
    const totalAuditRecords = await prisma.utmeQuestionAudit.count();
    assert(totalQuestions === 10555, `Total UTME questions in database is 10,555 (Found: ${totalQuestions})`);
    assert(totalAuditRecords === 10555, `Audit trail contains 10,555 verified records (Found: ${totalAuditRecords})`);

    const sourceMatch = await prisma.utmeQuestionAudit.count({ where: { verificationStatus: "SOURCE_MATCH" } });
    const approvedPub = await prisma.utmeQuestionAudit.count({ where: { verificationStatus: "APPROVED_FOR_PUBLICATION" } });
    const needsReview = await prisma.utmeQuestionAudit.count({ where: { verificationStatus: "NEEDS_REVIEW" } });

    console.log(`- Source Key Matched (Official Past Papers): ${sourceMatch}`);
    console.log(`- Verified & Approved for Publication: ${approvedPub}`);
    console.log(`- Needs Review (Missing Diagram Flagged): ${needsReview}`);

    assert(sourceMatch === 4532, `Source matched questions count is 4,532`);
    assert(approvedPub === 6011, `Approved for publication count is 6,011`);
    assert(needsReview === 12, `Flagged missing diagrams count is 12`);

    // Ensure flagged questions are excluded from published pool
    const flaggedPublished = await prisma.utmeQuestion.count({
      where: {
        verificationStatus: "NEEDS_REVIEW",
        publicationStatus: "PUBLISHED",
      },
    });
    assert(flaggedPublished === 0, `All 12 flagged questions have publicationStatus !== PUBLISHED (Found: ${flaggedPublished})`);

    // ----------------------------------------------------
    // TEST 2: Question Grouping & Randomization Preservation
    // ----------------------------------------------------
    console.log("\n--- TEST 2: Randomization & Group Cohesion ---");
    const engExam = await utmeService.startMockExam({
      courseSlug: "medicine-and-surgery",
      durationMinutes: 120,
      mode: "FULL_UTME_SIMULATION",
      institutionName: "University of Ibadan",
    });

    assert(engExam.attemptId !== null, `Exam attempt initialized with ID: ${engExam.attemptId}`);
    assert(engExam.questions.length === 180, `Full simulation contains 180 questions (Found: ${engExam.questions.length})`);

    // Check no duplicate question IDs
    const qIds = engExam.questions.map((q: any) => q.id);
    const uniqueIds = new Set(qIds);
    assert(uniqueIds.size === qIds.length, `Exam questions are 100% unique (Zero duplicates across 180 questions)`);

    // Check comprehension passages cohesion
    const compQuestions = engExam.questions.filter((q: any) => q.subjectCode === "ENG" && q.passage !== null);
    if (compQuestions.length > 0) {
      let isCohesive = true;
      let lastPassage = compQuestions[0].passage;
      for (let i = 1; i < compQuestions.length; i++) {
        const curPassage = compQuestions[i].passage;
        if (curPassage === lastPassage) {
          // Check if index is contiguous
          const prevIdx = engExam.questions.findIndex((q: any) => q.id === compQuestions[i - 1].id);
          const curIdx = engExam.questions.findIndex((q: any) => q.id === compQuestions[i].id);
          if (curIdx !== prevIdx + 1) {
            isCohesive = false;
            break;
          }
        }
        lastPassage = curPassage;
      }
      assert(isCohesive, `Comprehension passage questions remain contiguous and cohesive without splitting`);
    }

    // ----------------------------------------------------
    // TEST 3: Flexible Duration Practice Exams
    // ----------------------------------------------------
    console.log("\n--- TEST 3: Flexible Duration Practice Exams ---");
    const flex15 = await utmeService.startMockExam({
      userId: testUserId,
      customSubjectCodes: ["ENG"],
      durationMinutes: 15,
      questionCount: 10,
      mode: "PRACTICE_MODE",
      examType: "FLEXIBLE_PRACTICE",
    });
    assert(flex15.durationMinutes === 15, `15-minute practice session configured correctly`);
    assert(flex15.questions.length === 10, `10 questions generated for 15-minute practice`);

    const flex30 = await utmeService.startMockExam({
      customSubjectCodes: ["BIO"],
      durationMinutes: 30,
      questionCount: 20,
      mode: "PRACTICE_MODE",
      examType: "FLEXIBLE_PRACTICE",
    });
    assert(flex30.durationMinutes === 30, `30-minute practice session configured correctly`);
    assert(flex30.questions.length === 20, `20 questions generated for 30-minute practice`);

    // ----------------------------------------------------
    // TEST 4: Exam Session Persistence & Position Saving
    // ----------------------------------------------------
    console.log("\n--- TEST 4: Session Persistence & Question Position ---");
    await utmeService.savePosition(flex30.attemptId, 14);
    const restoredState = await utmeService.getExamState(flex30.attemptId);
    assert(restoredState.currentQuestionIndex === 14, `Candidate question position saved and restored at index 14`);
    assert(restoredState.remainingSeconds > 0, `Remaining timer successfully preserved across session state`);

    // ----------------------------------------------------
    // TEST 5: Quick Drill with Instant Feedback
    // ----------------------------------------------------
    console.log("\n--- TEST 5: Quick Drill & Instant Feedback ---");
    const drill = await utmeService.startMockExam({
      customSubjectCodes: ["CHM"],
      durationMinutes: 10,
      questionCount: 5,
      mode: "PRACTICE_MODE",
      examType: "QUICK_DRILL",
      isInstantFeedback: true,
    });
    assert(drill.isInstantFeedback === true, `Drill instant feedback mode flag active`);
    assert(drill.questions[0].correctAnswer !== undefined, `Instant feedback mode includes verified correctAnswer in student view`);
    assert(drill.questions[0].explanation !== undefined, `Instant feedback mode includes explanation for immediate learning`);

    // ----------------------------------------------------
    // TEST 6: Flashcards Active Recall & Mastery Tracking
    // ----------------------------------------------------
    console.log("\n--- TEST 6: Flashcards Deck & Progress Persistence ---");
    const flashCards = await utmeService.getFlashcardsDeck({
      subjectCode: "PHY",
      filter: "ALL",
      limit: 10,
      userId: testUserId,
    });
    assert(flashCards.length > 0, `Physics flashcards deck retrieved (${flashCards.length} cards)`);
    assert(flashCards[0].front !== undefined, `Flashcard contains active recall front prompt`);
    assert(flashCards[0].correctAnswer !== undefined, `Flashcard contains verified answer on back`);

    // Rate a card
    const firstCard = flashCards[0];
    const rateResult = await utmeService.rateFlashcard({
      userId: testUserId,
      questionId: firstCard.id,
      status: "KNOWN",
      subjectCode: "PHY",
      topic: firstCard.topic,
    });
    assert(rateResult.status === "KNOWN", `Flashcard rated as KNOWN and persisted to database`);

    const userProgress = await utmeService.getFlashcardProgress(testUserId, "PHY");
    assert(userProgress.knownCards >= 1, `User flashcard progress reflects 1+ mastered cards`);

    // ----------------------------------------------------
    // TEST 7: Progress Tracking Dashboard
    // ----------------------------------------------------
    console.log("\n--- TEST 7: Progress Tracking Dashboard ---");
    // Submit flex15 attempt to add to history
    await utmeService.submitExam(flex15.attemptId);

    const dashboard = await utmeService.getProgressDashboard(testUserId);
    assert(dashboard.totalAttempts >= 1, `Dashboard reflects completed examination attempts`);
    assert(typeof dashboard.overallAccuracy === "number", `Dashboard calculates aggregate accuracy: ${dashboard.overallAccuracy}%`);
    assert(dashboard.subjectBreakdown.length > 0, `Dashboard provides subject performance breakdown`);
    assert(dashboard.history.length > 0, `Dashboard lists historical attempts with review metadata`);

    // Clean up temporary verification data
    await prisma.utmeFlashcardProgress.deleteMany({ where: { userId: testUserId, questionId: firstCard.id } });
    await prisma.utmeExamResponse.deleteMany({ where: { attemptId: flex15.attemptId } });
    await prisma.utmeExamAttempt.delete({ where: { id: flex15.attemptId } });
    await prisma.utmeExamResponse.deleteMany({ where: { attemptId: flex30.attemptId } });
    await prisma.utmeExamAttempt.delete({ where: { id: flex30.attemptId } });
    await prisma.utmeExamResponse.deleteMany({ where: { attemptId: drill.attemptId } });
    await prisma.utmeExamAttempt.delete({ where: { id: drill.attemptId } });
    await prisma.utmeExamResponse.deleteMany({ where: { attemptId: engExam.attemptId } });
    await prisma.utmeExamAttempt.delete({ where: { id: engExam.attemptId } });

    console.log("\n=========================================================");
    console.log(`ALL VERIFICATION TESTS COMPLETED: ${testsPassed} PASSED, ${testsFailed} FAILED`);
    console.log("=========================================================");

    if (testsFailed > 0) {
      process.exit(1);
    }
  } catch (error) {
    console.error("Verification error:", error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

runVerification();
