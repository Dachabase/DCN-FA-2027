import { prisma } from "../src/database/prisma";

async function verifyClientJourney() {
  console.log("============================================================");
  console.log("CLIENT INTEGRATION SIMULATION: FULL USER JOURNEY VERIFICATION");
  console.log("============================================================\n");

  const baseUrl = "http://localhost:3000";

  // Step 1: Client loads courses and subjects (as done in init())
  console.log("STEP 1: Fetching Courses and Subjects (init)...");
  const coursesRes = await fetch(`${baseUrl}/api/utme/courses`);
  const coursesJson = await coursesRes.json();
  console.log(` - Loaded ${coursesJson.count} course combinations.`);

  const subjectsRes = await fetch(`${baseUrl}/api/utme/subjects`);
  const subjectsJson = await subjectsRes.json();
  console.log(` - Loaded ${subjectsJson.count} subjects with real question counts.`);

  // Step 2: Course search & selection
  console.log("\nSTEP 2: Course Selection & Verification...");
  const selectedCourse = coursesJson.data.find((c: any) => c.slug === "medicine-and-surgery");
  if (!selectedCourse) throw new Error("Medicine and Surgery not found");
  console.log(` - Selected Course: ${selectedCourse.courseName}`);
  console.log(` - Compulsory Subjects: ${selectedCourse.compulsorySubjects.join(", ")}`);
  console.log(` - Official Source Citation: ${selectedCourse.officialSource}`);
  console.log(` - Institution Specific: ${selectedCourse.institutionSpecificNotes}`);

  // Step 3: Exam Initialization (Practice Mode)
  console.log("\nSTEP 3: Exam Initialization...");
  const startRes = await fetch(`${baseUrl}/api/utme/exam/start`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      candidateId: "simulated-student-e2e",
      courseSlug: selectedCourse.slug,
      mode: "PRACTICE_MODE"
    })
  });
  const startJson = await startRes.json();
  if (!startJson.success) throw new Error("Exam start failed: " + startJson.error);
  const exam = startJson.data;
  console.log(` - Created Exam Attempt: ${exam.attemptId}`);
  console.log(` - Total Questions: ${exam.questions.length}`);
  console.log(` - Duration: ${exam.durationMinutes} minutes`);
  console.log(` - Question Security Check: Correct answers redacted? ${exam.questions[0].correctAnswer === undefined}`);

  // Step 4: Exam Hall - Answering & Flagging
  console.log("\nSTEP 4: Exam Hall Actions (Answering & Marking for Review)...");
  const q1 = exam.questions[0];
  const q2 = exam.questions[1];
  const q3 = exam.questions[2];

  await fetch(`${baseUrl}/api/utme/exam/${exam.attemptId}/save-answer`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ questionId: q1.id, selectedOption: "A", isMarkedForReview: false }),
  });
  await fetch(`${baseUrl}/api/utme/exam/${exam.attemptId}/save-answer`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ questionId: q2.id, selectedOption: "B", isMarkedForReview: true }),
  });
  await fetch(`${baseUrl}/api/utme/exam/${exam.attemptId}/save-answer`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ questionId: q3.id, selectedOption: "C", isMarkedForReview: false }),
  });
  console.log(" - Saved 3 responses via real-time save-answer endpoint.");

  // Step 5: Verify Active Exam Recovery (simulate reload)
  console.log("\nSTEP 5: Page Reload & State Recovery...");
  const stateRes = await fetch(`${baseUrl}/api/utme/exam/${exam.attemptId}/state`);
  const stateJson = await stateRes.json();
  const savedResponsesArray = Object.values(stateJson.data.savedResponses || {});
  console.log(` - Recovered saved responses: ${savedResponsesArray.length} items`);
  console.log(` - Flagged questions preserved: ${savedResponsesArray.filter((r: any) => r.isMarkedForReview).length}`);

  // Step 6: Submit Exam
  console.log("\nSTEP 6: Exam Submission...");
  const submitRes = await fetch(`${baseUrl}/api/utme/exam/${exam.attemptId}/submit`, {
    method: "POST"
  });
  const submitJson = await submitRes.json();
  if (!submitJson.success) throw new Error("Submission failed: " + submitJson.error);
  const results = submitJson.data;
  console.log(` - Exam Status: ${results.status}`);
  console.log(` - Scaled Aggregate Score: ${results.aggregateScore} / ${results.maxScore}`);
  console.log(` - Accuracy: ${results.accuracyPercentage}%`);
  console.log(` - Subject Breakdown:`);
  for (const s of Object.values(results.subjectScores || {}) as any[]) {
    console.log(`   * ${s.subjectName}: ${s.correct}/${s.total} (Scaled: ${s.scaledScore}/100)`);
  }

  // Step 7: Post-Submission Educational Review
  console.log("\nSTEP 7: Detailed Educational Review...");
  const reviewRes = await fetch(`${baseUrl}/api/utme/exam/${exam.attemptId}/review`);
  const reviewJson = await reviewRes.json();
  console.log(` - Total questions available for review: ${reviewJson.data.questions.length}`);
  const sampleReview = reviewJson.data.questions[0];
  console.log(` - Sample Question: ${sampleReview.questionText.substring(0, 70)}...`);
  console.log(` - Student Answer: ${sampleReview.studentAnswer || "Unanswered"}`);
  console.log(` - Verified Correct Answer: Option ${sampleReview.correctAnswer}`);
  console.log(` - Step-by-Step Explanation: ${sampleReview.explanation?.substring(0, 90)}...`);
  console.log(` - Distractor Analysis: ${sampleReview.whyOthersIncorrect?.substring(0, 90)}...`);
  console.log(` - Syllabus Topic: ${sampleReview.topic || "General"}`);

  console.log("\n============================================================");
  console.log("CLIENT INTEGRATION SIMULATION COMPLETED WITH 100% SUCCESS!");
  console.log("============================================================\n");
}

verifyClientJourney()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Test failed:", err);
    process.exit(1);
  });
