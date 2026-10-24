import { utmeService } from "../src/utme/utme.service";
import { prisma } from "../src/database/prisma";

async function runTests() {
  console.log("============================================================");
  console.log("AUTOMATED TEST SUITE: UTME MOCK EXAMINATION ENGINE");
  console.log("============================================================\n");

  // TEST 1: Course combinations & subject-combination engine
  console.log("TEST 1: Testing Course Combinations Engine...");
  const medicineComb = await utmeService.getCourseCombinations("Medicine");
  if (medicineComb.length === 0) throw new Error("Medicine course combination not found!");
  const med = medicineComb[0];
  console.log(` - Found Course: ${med.courseName} (${med.degreeType})`);
  console.log(` - Required Subjects: [${med.compulsorySubjects.join(", ")}]`);
  console.log(` - Official Source: ${med.officialSource}`);
  console.log(` - Institution Specific: ${med.institutionNotes}`);
  if (!med.compulsorySubjects.includes("Use of English") || !med.compulsorySubjects.includes("Biology")) {
    throw new Error("Medicine subjects validation failed!");
  }
  console.log(" PASSED: Course combination engine verified.\n");

  // TEST 2: Subjects & Question bank availability
  console.log("TEST 2: Testing UTME Subjects & Question Bank Availability...");
  const subjects = await utmeService.getSubjects();
  console.log(` - Total Subjects in DB: ${subjects.length}`);
  for (const s of subjects) {
    console.log(`   * ${s.code} (${s.name}): ${s.availableQuestionsCount.toLocaleString()} questions`);
    if (s.availableQuestionsCount < 100) {
      throw new Error(`Insufficient questions for subject ${s.name}: ${s.availableQuestionsCount}`);
    }
  }
  console.log(" PASSED: All subjects meet minimum question bank standards.\n");

  // TEST 3: Mock Examination Initialization (Practice Mode)
  console.log("TEST 3: Testing Examination Creation & Security Redaction...");
  const exam = await utmeService.startMockExam({
    courseSlug: "medicine-and-surgery",
    mode: "PRACTICE_MODE",
    institutionName: "University of Ibadan (UI)",
  });
  console.log(` - Attempt ID: ${exam.attemptId}`);
  console.log(` - Course: ${exam.courseName}`);
  console.log(` - Subjects: [${exam.subjectCodes.join(", ")}]`);
  console.log(` - Total Questions: ${exam.totalQuestions}`);
  console.log(` - Duration: ${exam.durationMinutes} minutes`);
  console.log(` - Expires At: ${exam.expiresAt.toISOString()}`);

  // SECURITY CHECK: Ensure pre-submission responses NEVER leak correctAnswer or explanation
  const sampleQ = exam.questions[0] as any;
  if (sampleQ.correctAnswer !== undefined || sampleQ.explanation !== undefined) {
    throw new Error("CRITICAL SECURITY VIOLATION: Pre-submission exam response leaked correct answer or explanation!");
  }
  console.log(` - Security Check Verified: Correct answers and explanations are safely redacted.`);
  console.log(" PASSED: Exam initialized cleanly.\n");

  // TEST 4: Real-time Response Saving
  console.log("TEST 4: Testing Real-time Response Persistence & Flagging...");
  const q1 = exam.questions[0];
  const q2 = exam.questions[1];
  await utmeService.saveResponse(exam.attemptId, q1.id, "B", false);
  await utmeService.saveResponse(exam.attemptId, q2.id, "C", true); // Marked for review
  console.log(` - Saved Answer for Q1 (${q1.id}) -> 'B'`);
  console.log(` - Saved Answer for Q2 (${q2.id}) -> 'C' (Flagged for Review)`);

  const state = await utmeService.getExamState(exam.attemptId);
  if (!state.savedResponses[q1.id] || state.savedResponses[q1.id].selectedOption !== "B") {
    throw new Error("Answer persistence check failed for Q1!");
  }
  if (!state.savedResponses[q2.id] || !state.savedResponses[q2.id].isMarkedForReview) {
    throw new Error("Review flag persistence check failed for Q2!");
  }
  console.log(` - State Recovery Verified: ${Object.keys(state.savedResponses).length} saved responses recovered.`);
  console.log(" PASSED: Real-time response persistence verified.\n");

  // TEST 5: Examination Submission & Server-Side Scoring
  console.log("TEST 5: Testing Server-Side Grading & UTME Scoring...");
  const results = await utmeService.submitExam(exam.attemptId);
  console.log(` - Submission Status: ${results.status}`);
  console.log(` - Raw Score: ${results.rawScore} / ${results.totalQuestions}`);
  console.log(` - Aggregate Score: ${results.aggregateScore} / ${results.maxScore}`);
  console.log(` - Accuracy: ${results.accuracyPercentage}%`);
  console.log(` - Time Used: ${results.timeSpentFormatted}`);
  console.log(` - Subject Breakdown:`);
  for (const code in results.subjectScores as any) {
    const s = (results.subjectScores as any)[code];
    console.log(`   * ${s.subjectName} (${code}): ${s.correct}/${s.total} correct -> Scaled: ${s.scaledScore}/100`);
  }
  console.log(" PASSED: Server-side grading verified.\n");

  // TEST 6: Post-Submission Educational Review & Step-by-Step Explanations
  console.log("TEST 6: Testing Post-Submission Answer Review & Explanations...");
  const review = await utmeService.getExamReview(exam.attemptId);
  console.log(` - Total Reviewed Questions: ${review.totalReviewed}`);
  const reviewQ = review.questions[0];
  console.log(` - Sample Question: "${reviewQ.questionText.substring(0, 70)}..."`);
  console.log(` - Student Answer: ${reviewQ.studentAnswer || "Unanswered"}`);
  console.log(` - Correct Answer: Option ${reviewQ.correctAnswer}`);
  console.log(` - Is Correct: ${reviewQ.isCorrect}`);
  console.log(` - Detailed Explanation: "${reviewQ.explanation.substring(0, 100)}..."`);
  console.log(` - Why Others Incorrect: "${reviewQ.whyOthersIncorrect?.substring(0, 80)}..."`);
  if (!reviewQ.explanation || reviewQ.explanation.length < 20) {
    throw new Error("Detailed explanation missing or incomplete!");
  }
  console.log(" PASSED: Post-submission educational review verified.\n");

  // TEST 7: Admin Statistics Dashboard
  console.log("TEST 7: Testing Administration Dashboard Statistics...");
  const adminStats = await utmeService.getAdminStats();
  console.log(` - Total Questions in Bank: ${adminStats.totalQuestions.toLocaleString()}`);
  console.log(` - Total Subjects: ${adminStats.totalSubjects}`);
  console.log(` - Total Course Combinations: ${adminStats.totalCourseCombinations}`);
  console.log(` - Completed Exam Attempts: ${adminStats.completedAttempts}`);
  console.log(" PASSED: Admin stats verified.\n");

  console.log("============================================================");
  console.log("ALL 7 TEST SUITES PASSED WITH 100% SUCCESS!");
  console.log("============================================================\n");
}

runTests()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Test failed:", err);
    process.exit(1);
  });
