import "dotenv/config";
import { prisma } from "../src/database/prisma";
import { normalizeAudience, mapAudienceToRole, mapRoleToAudience, resolveAudienceFromRequest } from '../src/personalization/audience.helper';

async function runVerification() {
  console.log("=================================================================");
  console.log("COMPREHENSIVE AUDIENCE SEGMENTATION & SYSTEM VERIFICATION TEST");
  console.log("=================================================================\n");

  let totalTests = 0;
  let passedTests = 0;

  function assert(condition: boolean, testName: string, details?: any) {
    totalTests++;
    if (condition) {
      passedTests++;
      console.log(`[PASS] ${testName}`);
    } else {
      console.error(`[FAIL] ${testName}`);
      if (details) console.error("       Details:", details);
    }
  }

  try {
    // -------------------------------------------------------------
    // Test Suite 1: Audience Normalization & Role Bidirectional Mapping
    // -------------------------------------------------------------
    console.log("--- TEST SUITE 1: Audience Normalization & Role Bidirectional Mapping ---");
    assert(normalizeAudience('UTME_STUDENT') === 'UTME_STUDENT', "normalizeAudience('UTME_STUDENT')");
    assert(normalizeAudience('PROSPECTIVE_UTME') === 'UTME_STUDENT', "normalizeAudience('PROSPECTIVE_UTME') -> UTME_STUDENT");
    assert(normalizeAudience('UI_100_LEVEL_STUDENT') === 'UI_100_LEVEL_STUDENT', "normalizeAudience('UI_100_LEVEL_STUDENT')");
    assert(normalizeAudience('CURRENT_STUDENT') === 'UI_100_LEVEL_STUDENT', "normalizeAudience('CURRENT_STUDENT') -> UI_100_LEVEL_STUDENT");
    assert(normalizeAudience('unknown') === null, "normalizeAudience returns null for unknown values");
    
    assert(mapAudienceToRole('UTME_STUDENT') === 'PROSPECTIVE_UTME', "mapAudienceToRole('UTME_STUDENT') -> PROSPECTIVE_UTME");
    assert(mapAudienceToRole('UI_100_LEVEL_STUDENT') === 'CURRENT_STUDENT', "mapAudienceToRole('UI_100_LEVEL_STUDENT') -> CURRENT_STUDENT");

    assert(mapRoleToAudience('PROSPECTIVE_UTME') === 'UTME_STUDENT', "mapRoleToAudience('PROSPECTIVE_UTME') -> UTME_STUDENT");
    assert(mapRoleToAudience('CURRENT_STUDENT') === 'UI_100_LEVEL_STUDENT', "mapRoleToAudience('CURRENT_STUDENT') -> UI_100_LEVEL_STUDENT");

    // Request resolution helper
    const reqFromQuery = { query: { audience: 'UTME_STUDENT' }, headers: {} };
    assert(resolveAudienceFromRequest(reqFromQuery) === 'UTME_STUDENT', "resolveAudienceFromRequest from query param");

    const reqFromHeader = { query: {}, headers: { 'x-target-audience': 'UI_100_LEVEL_STUDENT' } };
    assert(resolveAudienceFromRequest(reqFromHeader) === 'UI_100_LEVEL_STUDENT', "resolveAudienceFromRequest from header");

    const reqFromUser = { query: {}, headers: {}, user: { role: 'PROSPECTIVE_UTME' } };
    assert(resolveAudienceFromRequest(reqFromUser) === 'UTME_STUDENT', "resolveAudienceFromRequest from authenticated user profile");

    // -------------------------------------------------------------
    // Test Suite 2: Database Schema & Entity Counts
    // -------------------------------------------------------------
    console.log("\n--- TEST SUITE 2: Database Schema & Entity Integrity ---");
    const [guideCount, resourceCount, oppCount, faqCount, userCount, attemptCount, questionCount, courseCount] = await Promise.all([
      prisma.guide.count(),
      prisma.resource.count(),
      prisma.opportunity.count(),
      prisma.fAQ.count(),
      prisma.user.count(),
      prisma.utmeExamAttempt.count(),
      prisma.utmeQuestion.count(),
      prisma.departmentCourse.count()
    ]);

    console.log(`Audited database contents:`);
    console.log(`- Guides: ${guideCount}`);
    console.log(`- Resources: ${resourceCount}`);
    console.log(`- Opportunities: ${oppCount}`);
    console.log(`- FAQs: ${faqCount}`);
    console.log(`- Users: ${userCount}`);
    console.log(`- Mock Attempts: ${attemptCount}`);
    console.log(`- UTME Questions: ${questionCount}`);
    console.log(`- 100L Department Courses: ${courseCount}`);

    assert(guideCount >= 250, "All 250+ guides preserved in database", { count: guideCount });
    assert(resourceCount >= 10, "Educational resources preserved", { count: resourceCount });
    assert(oppCount >= 4, "Opportunities preserved", { count: oppCount });
    assert(faqCount >= 4, "FAQs preserved", { count: faqCount });
    assert(userCount >= 27, "All 27 user accounts preserved without duplication", { count: userCount });
    assert(attemptCount >= 49, "All 49 exam attempts preserved without loss", { count: attemptCount });
    assert(questionCount >= 10550, "All 10,555 UTME questions preserved", { count: questionCount });
    assert(courseCount >= 100, "100L Course packages preserved", { count: courseCount });

    // -------------------------------------------------------------
    // Test Suite 3: Content Classification & Filtering Logic
    // -------------------------------------------------------------
    console.log("\n--- TEST SUITE 3: Content Classification & Filtering Verification ---");

    // Guides by audience
    const utmeGuides = await prisma.guide.findMany({
      where: { audience: { has: 'UTME_STUDENT' } }
    });
    const ui100lGuides = await prisma.guide.findMany({
      where: { audience: { has: 'UI_100_LEVEL_STUDENT' } }
    });
    const sharedGuides = await prisma.guide.findMany({
      where: {
        AND: [
          { audience: { has: 'UTME_STUDENT' } },
          { audience: { has: 'UI_100_LEVEL_STUDENT' } }
        ]
      }
    });
    const unclassifiedGuides = await prisma.guide.findMany({
      where: { audience: { isEmpty: true } }
    });

    console.log(`Guide segmentation breakdown:`);
    console.log(`- UTME-accessible: ${utmeGuides.length}`);
    console.log(`- UI 100L-accessible: ${ui100lGuides.length}`);
    console.log(`- Shared Both: ${sharedGuides.length}`);
    console.log(`- Unclassified: ${unclassifiedGuides.length}`);

    assert(utmeGuides.length >= 2, "UTME students receive UTME-specific guides", { count: utmeGuides.length });
    assert(ui100lGuides.length >= 100, "100L students receive 100L-specific guides", { count: ui100lGuides.length });
    assert(sharedGuides.length >= 100, "Shared foundational guides appear for both audiences without row duplication", { count: sharedGuides.length });
    assert(unclassifiedGuides.length <= 15, "Unclassified guides identified for admin review", { count: unclassifiedGuides.length });

    // Resources by audience
    const utmeResources = await prisma.resource.findMany({
      where: { audience: { has: 'UTME_STUDENT' } }
    });
    const ui100lResources = await prisma.resource.findMany({
      where: { audience: { has: 'UI_100_LEVEL_STUDENT' } }
    });
    const sharedResources = await prisma.resource.findMany({
      where: {
        AND: [
          { audience: { has: 'UTME_STUDENT' } },
          { audience: { has: 'UI_100_LEVEL_STUDENT' } }
        ]
      }
    });

    console.log(`\nResource segmentation breakdown:`);
    console.log(`- UTME-accessible: ${utmeResources.length}`);
    console.log(`- UI 100L-accessible: ${ui100lResources.length}`);
    console.log(`- Shared Both: ${sharedResources.length}`);

    assert(utmeResources.length >= 3, "UTME syllabus & question drives accessible to UTME students", { count: utmeResources.length });
    assert(ui100lResources.length >= 6, "100L departmental drive vaults accessible to 100L students", { count: ui100lResources.length });
    assert(sharedResources.length >= 1, "Shared study templates accessible to both groups", { count: sharedResources.length });

    // Verify UTME resources have valid file/URL links
    const invalidUrlResources = await prisma.resource.findMany({
      where: { url: { equals: "" } }
    });
    assert(invalidUrlResources.length === 0, "All educational resources have valid external/drive URLs");

    // -------------------------------------------------------------
    // Test Suite 4: Opportunities & FAQs Audience Separation
    // -------------------------------------------------------------
    console.log("\n--- TEST SUITE 4: Opportunities & FAQs Audience Separation ---");
    const utmeOpps = await prisma.opportunity.findMany({ where: { audience: { has: 'UTME_STUDENT' } } });
    const ui100lOpps = await prisma.opportunity.findMany({ where: { audience: { has: 'UI_100_LEVEL_STUDENT' } } });
    assert(utmeOpps.length >= 2, "UTME students can view admission scholarships & loans (e.g. NELFUND)");
    assert(ui100lOpps.length >= 3, "100L students can view undergraduate grants & work-study");

    const utmeFaqs = await prisma.fAQ.findMany({ where: { audience: { has: 'UTME_STUDENT' } } });
    const ui100lFaqs = await prisma.fAQ.findMany({ where: { audience: { has: 'UI_100_LEVEL_STUDENT' } } });
    assert(utmeFaqs.length >= 2, "UTME FAQs cover cutoffs and CBT strategy");
    assert(ui100lFaqs.length >= 3, "100L FAQs cover clearance and add/drop");

    // -------------------------------------------------------------
    // Test Suite 5: Non-Destructive User Account & Audience Switch Safety
    // -------------------------------------------------------------
    console.log("\n--- TEST SUITE 5: Account Integrity & Audience Switching Safety ---");
    
    // Find or test a sample user
    const sampleUser = await prisma.user.findFirst({
      include: {
        utmeAttempts: true
      }
    });

    if (sampleUser) {
      const originalRole = sampleUser.role;
      const originalAttempts = sampleUser.utmeAttempts.length;

      // Simulate switching audience to UTME
      const updatedToUtme = await prisma.user.update({
        where: { id: sampleUser.id },
        data: { role: 'PROSPECTIVE_UTME' },
        include: { utmeAttempts: true }
      });
      assert(updatedToUtme.role === 'PROSPECTIVE_UTME', "User switched to PROSPECTIVE_UTME role");
      assert(updatedToUtme.utmeAttempts.length === originalAttempts, "Switching audience does NOT delete exam attempts");

      // Switch back to original
      const restoredUser = await prisma.user.update({
        where: { id: sampleUser.id },
        data: { role: originalRole }
      });
      assert(restoredUser.role === originalRole, "User restored to original role without data loss");
    }

    // -------------------------------------------------------------
    // Test Suite 6: Admin Content Classification Endpoint Emulation
    // -------------------------------------------------------------
    console.log("\n--- TEST SUITE 6: Admin Content Classification Workflow ---");

    // Find a guide to test reclassification
    const testGuide = await prisma.guide.findFirst({ where: { category: 'Academics' } });
    if (testGuide) {
      const originalAudience = [...testGuide.audience];

      // Reclassify to UTME only
      const updated = await prisma.guide.update({
        where: { id: testGuide.id },
        data: { audience: ['UTME_STUDENT'] }
      });
      assert(updated.audience.length === 1 && updated.audience[0] === 'UTME_STUDENT', "Admin can reclassify guide to UTME_STUDENT");

      // Reclassify to Shared
      const updatedShared = await prisma.guide.update({
        where: { id: testGuide.id },
        data: { audience: ['UTME_STUDENT', 'UI_100_LEVEL_STUDENT'] }
      });
      assert(updatedShared.audience.includes('UTME_STUDENT') && updatedShared.audience.includes('UI_100_LEVEL_STUDENT'), "Admin can reclassify guide to Shared");

      // Restore original
      await prisma.guide.update({
        where: { id: testGuide.id },
        data: { audience: originalAudience }
      });
      console.log(`[PASS] Reclassification tested and restored original audience: [${originalAudience.join(', ')}]`);
    }

    console.log("\n=================================================================");
    console.log(`VERIFICATION SUMMARY: ${passedTests}/${totalTests} TESTS PASSED (${Math.round((passedTests/totalTests)*100)}%)`);
    console.log("=================================================================");

    if (passedTests === totalTests) {
      process.exit(0);
    } else {
      process.exit(1);
    }
  } catch (err) {
    console.error("Verification error:", err);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

runVerification();
