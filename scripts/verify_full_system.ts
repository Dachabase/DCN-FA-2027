import "dotenv/config";
import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import { academic100lRouter, vaultRouter } from "../src/academic100l/academic100l.controller";
import { utmeRouter } from "../src/utme/utme.controller";
import { prisma } from "../src/database/prisma";
import http from "http";

async function runEndToEndVerification() {
  console.log("=================================================================");
  console.log("   UNIVERSITY OF IBADAN 100-LEVEL PLATFORM E2E VERIFICATION     ");
  console.log("=================================================================");

  // Set up ephemeral test server
  const app = express();
  app.use(cors({ origin: true, credentials: true }));
  app.use(cookieParser());
  app.use(express.json());
  app.use("/api/vault", vaultRouter);
  app.use("/api/100l", academic100lRouter);
  app.use("/api/utme", utmeRouter);

  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(3099, resolve));
  const BASE = "http://localhost:3099";

  let testsPassed = 0;
  let testsFailed = 0;

  function assert(condition: boolean, testName: string, detail?: any) {
    if (condition) {
      console.log(`  [PASS] ${testName}`);
      testsPassed++;
    } else {
      console.error(`  [FAIL] ${testName}`, detail || "");
      testsFailed++;
    }
  }

  try {
    // 1. Vault Materials API
    console.log("\n1. Testing Materials Vault API...");
    const res1 = await fetch(`${BASE}/api/vault/materials?limit=10`).then((r) => r.json());
    assert(res1.success === true, "GET /api/vault/materials returns success: true");
    assert(res1.pagination.total >= 1800, `Materials Vault total count is preserved (${res1.pagination.total} items)`);
    assert(res1.items.length === 10, "Pagination limit respected (10 items returned)");

    const sampleMaterial = res1.items[0];
    assert(!!sampleMaterial.fileViewUrl, "Material includes browser view link");
    assert(!!sampleMaterial.fileDownloadUrl, "Material includes direct download link");

    // 2. Vault Filter by Course Code & Category
    console.log("\n2. Testing Materials Vault Filtering & Search...");
    const res2 = await fetch(`${BASE}/api/vault/materials?courseCode=COS%20101`).then((r) => r.json());
    assert(res2.success === true && res2.items.length > 0, `Filter by course code COS 101 returns items (${res2.items.length} items)`);

    const res3 = await fetch(`${BASE}/api/vault/materials?category=Lecture%20Notes&limit=5`).then((r) => r.json());
    assert(res3.success === true && res3.items.length > 0, `Filter by category 'Lecture Notes' returns items (${res3.pagination.total} total notes)`);

    // 3. Vault Single Material Metadata
    console.log("\n3. Testing Single Material Metadata...");
    const res4 = await fetch(`${BASE}/api/vault/material/${sampleMaterial.id}`).then((r) => r.json());
    assert(res4.success === true && res4.data.id === sampleMaterial.id, `GET /api/vault/material/:id returns correct item (${res4.data.title})`);

    // 4. File Streaming API Head/Stream check
    console.log("\n4. Testing Vault File Streaming...");
    const fileRes = await fetch(`${BASE}/api/vault/file/${sampleMaterial.id}`);
    assert(fileRes.status === 200 || fileRes.status === 302, `GET /api/vault/file/:id streams file or redirects cleanly (status: ${fileRes.status})`);

    // 5. Course Directory API
    console.log("\n5. Testing 100-Level Course Directory...");
    const coursesRes = await fetch(`${BASE}/api/100l/courses`).then((r) => r.json());
    assert(coursesRes.success === true, "GET /api/100l/courses returns success: true");
    assert(coursesRes.data.length >= 140, `Course directory contains verified 100L courses (${coursesRes.data.length} courses)`);

    const activeCbtCourses = coursesRes.data.filter((c: any) => c.questionsCount > 0);
    assert(activeCbtCourses.length >= 40, `Courses with populated CBT question banks: ${activeCbtCourses.length} courses`);

    // 6. Detailed Course Hub Endpoint
    const testCourseCode = "COS 101";
    console.log(`\n6. Testing Detailed Course Hub for ${testCourseCode}...`);
    const courseDetailRes = await fetch(`${BASE}/api/100l/courses/${encodeURIComponent(testCourseCode)}`).then((r) => r.json());
    assert(courseDetailRes.success === true, `GET /api/100l/courses/${testCourseCode} returns success`);
    assert(courseDetailRes.data.materials.length > 0, `Linked materials found for ${testCourseCode} (${courseDetailRes.data.materials.length} items)`);
    assert(courseDetailRes.data.questionStats.totalQuestions >= 500, `Question bank loaded for ${testCourseCode} (${courseDetailRes.data.questionStats.totalQuestions} questions)`);
    assert(courseDetailRes.data.questionStats.availableYears.length > 0, `Available exam years listed: [${courseDetailRes.data.questionStats.availableYears.join(", ")}]`);

    // 7. CBT Exam Config
    console.log("\n7. Testing CBT Examination Configuration...");
    const configRes = await fetch(`${BASE}/api/100l/cbt/config/${encodeURIComponent(testCourseCode)}`).then((r) => r.json());
    assert(configRes.success === true, "GET /api/100l/cbt/config/:courseCode returns success");
    assert(configRes.data.supportedModes.length >= 5, `Supported modes returned: ${configRes.data.supportedModes.map((m: any) => m.mode).join(", ")}`);

    // 8. CBT Start Attempt (INTEGRITY CHECK)
    console.log("\n8. Testing CBT Start Attempt & Examination Integrity...");
    const startRes = await fetch(`${BASE}/api/100l/cbt/start`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        courseCode: testCourseCode,
        mode: "FULL_CBT",
        questionCount: 20,
        durationMinutes: 20,
      }),
    }).then((r) => r.json());

    assert(startRes.success === true, "POST /api/100l/cbt/start creates active attempt");
    assert(!!startRes.data.attemptId, `Attempt ID generated: ${startRes.data.attemptId}`);
    assert(startRes.data.questions.length === 20, "Exact requested question count provided (20 questions)");

    // CRITICAL SECURITY / INTEGRITY CHECK: No answers leaked!
    const leaked = startRes.data.questions.some((q: any) => "correctAnswer" in q || "explanation" in q);
    assert(!leaked, "CRITICAL: Correct answers & explanations are NOT leaked in client payload!");

    // 9. CBT Submit Attempt & Grading Engine
    console.log("\n9. Testing CBT Submission, Grading, and Explanations Review...");
    const answers: Record<string, string> = {};
    for (const q of startRes.data.questions) {
      answers[q.id] = "A";
    }

    const submitRes = await fetch(`${BASE}/api/100l/cbt/submit`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        attemptId: startRes.data.attemptId,
        courseCode: testCourseCode,
        mode: "FULL_CBT",
        selectedAnswers: answers,
        timeSpentSeconds: 450,
      }),
    }).then((r) => r.json());

    assert(submitRes.success === true, "POST /api/100l/cbt/submit successfully grades attempt");
    assert(typeof submitRes.data.score === "number", `Calculated score percentage: ${submitRes.data.score}%`);
    assert(submitRes.data.totalQuestions === 20, `Total questions graded: ${submitRes.data.totalQuestions}`);
    assert(!!submitRes.data.topicPerformance, "Topic mastery breakdown calculated");
    assert(submitRes.data.review.length === 20, "Detailed question review with explanations provided");
    assert(!!submitRes.data.review[0].explanation, `Sample explanation verified: "${submitRes.data.review[0].explanation.slice(0, 60)}..."`);
    assert(!!submitRes.data.review[0].sourceDocument, `Sample source provenance: "${submitRes.data.review[0].sourceDocument}"`);

    // 10. Flashcards API
    console.log("\n10. Testing Course Flashcards Engine...");
    const flashRes = await fetch(`${BASE}/api/100l/flashcards/${encodeURIComponent(testCourseCode)}`).then((r) => r.json());
    assert(flashRes.success === true, `GET /api/100l/flashcards/${testCourseCode} returns success`);
    assert(flashRes.data.length > 0, `Flashcards available for ${testCourseCode}: ${flashRes.data.length} cards`);
    assert(!!flashRes.data[0].front && !!flashRes.data[0].back, `Sample card concept & answer: "${flashRes.data[0].front}" -> "${flashRes.data[0].back}"`);

    // 11. Admin Inventory Summary
    console.log("\n11. Testing Admin Materials Vault & CBT Inventory...");
    const adminRes = await fetch(`${BASE}/api/100l/admin/inventory`).then((r) => r.json());
    assert(adminRes.success === true, "GET /api/100l/admin/inventory returns success");
    assert(adminRes.data.summary.totalMaterials >= 1800, `Total Materials verified in DB: ${adminRes.data.summary.totalMaterials}`);
    assert(adminRes.data.summary.totalQuestions >= 3800, `Total CBT Questions verified in DB: ${adminRes.data.summary.totalQuestions}`);
    assert(adminRes.data.summary.totalFlashcards >= 60, `Total Flashcards verified in DB: ${adminRes.data.summary.totalFlashcards}`);

    // 12. UTME Separation Verification (Non-regression)
    console.log("\n12. Testing UTME Section Separation & Non-Regression...");
    const utmeSubRes = await fetch(`${BASE}/api/utme/subjects`).then((r) => r.json());
    assert(utmeSubRes.success === true, "UTME subjects API operates normally without interference");

    const utmeCoursesRes = await fetch(`${BASE}/api/utme/courses`).then((r) => r.json());
    assert(utmeCoursesRes.success === true, "UTME courses API operates normally without interference");

    console.log("\n=================================================================");
    console.log(`   E2E VERIFICATION COMPLETE: ${testsPassed} PASSED, ${testsFailed} FAILED   `);
    console.log("=================================================================");

    if (testsFailed > 0) {
      process.exit(1);
    }
  } finally {
    server.close();
    await prisma.$disconnect();
  }
}

runEndToEndVerification().catch((err) => {
  console.error("Unhandled error in E2E tests:", err);
  process.exit(1);
});
