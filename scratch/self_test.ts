import "dotenv/config";
import { prisma } from "../src/database/prisma";

async function runSelfTest() {
  console.log("==================================================");
  console.log("🧪 STEP 5: SELF-TEST & SYSTEM VERIFICATION PROTOCOL");
  console.log("==================================================\n");

  let passes = 0;
  let fails = 0;

  // Test 1: Verify 17 Faculties
  try {
    const faculties = await prisma.faculty.findMany({ select: { id: true, name: true } });
    if (faculties.length === 17) {
      console.log(`✅ TEST 1 PASSED: Exactly 17 canonical UI faculties seeded. Names: ${faculties.map(f => f.name).join(", ")}`);
      passes++;
    } else {
      console.log(`❌ TEST 1 FAILED: Expected 17 faculties, found ${faculties.length}.`);
      fails++;
    }
  } catch (err) {
    console.log(`❌ TEST 1 FAILED: ${err}`);
    fails++;
  }

  // Test 2: Shared Course Package Verification (Dentistry ↔ Clinical Sciences & Vet Med ↔ Science)
  try {
    const dent = await prisma.faculty.findFirst({ where: { name: "Dentistry" }, select: { id: true } });
    const clin = await prisma.faculty.findFirst({ where: { name: "Clinical Sciences" }, select: { id: true } });
    const vet = await prisma.faculty.findFirst({ where: { name: "Veterinary Medicine" }, select: { id: true } });
    const sci = await prisma.faculty.findFirst({ where: { name: "Science" }, select: { id: true } });

    const dentistryDept = await prisma.department.findFirst({ where: { facultyId: dent?.id }, select: { id: true, name: true, courses: { select: { courseId: true } } } });
    const clinicalDept = await prisma.department.findFirst({ where: { facultyId: clin?.id }, select: { id: true, name: true, courses: { select: { courseId: true } } } });
    const vetDept = await prisma.department.findFirst({ where: { facultyId: vet?.id }, select: { id: true, name: true, courses: { select: { courseId: true } } } });
    const scienceDept = await prisma.department.findFirst({ where: { facultyId: sci?.id }, select: { id: true, name: true, courses: { select: { courseId: true } } } });

    const dentCourseIds = dentistryDept?.courses.map(c => c.courseId).sort().join(",");
    const clinCourseIds = clinicalDept?.courses.map(c => c.courseId).sort().join(",");
    const vetCourseIds = vetDept?.courses.map(c => c.courseId).sort().join(",");
    const sciCourseIds = scienceDept?.courses.map(c => c.courseId).sort().join(",");

    const dentistryShared = dentCourseIds === clinCourseIds && (dentCourseIds?.length || 0) > 0;
    const vetShared = vetCourseIds === sciCourseIds && (vetCourseIds?.length || 0) > 0;

    if (dentistryShared && vetShared) {
      console.log(`✅ TEST 2 PASSED: Shared Package Links verified! Dentistry points to Clinical Sciences Pre-Med package. Vet Med points to Science package.`);
      passes++;
    } else {
      console.log(`❌ TEST 2 FAILED: Package links mismatched or unlinked.`);
      fails++;
    }
  } catch (err) {
    console.log(`❌ TEST 2 FAILED: ${err}`);
    fails++;
  }

  // Test 3: University-Wide GES/GST Single Shared Block
  try {
    const gesCourses = await prisma.course.findMany({ where: { isUniversityWide: true }, select: { code: true, units: true } });
    if (gesCourses.length === 7) {
      console.log(`✅ TEST 3 PASSED: University-Wide GES/GST shared block verified! Exactly 7 GES courses (${gesCourses.map(c => c.code).join(", ")}).`);
      passes++;
    } else {
      console.log(`❌ TEST 3 FAILED: Expected 7 GES courses, found ${gesCourses.length}.`);
      fails++;
    }
  } catch (err) {
    console.log(`❌ TEST 3 FAILED: ${err}`);
    fails++;
  }

  // Test 4: Unit Sum Sanitization against 15-24 Credit Limit Rule
  try {
    const compFac = await prisma.faculty.findFirst({ where: { name: "Computing" }, select: { id: true } });
    const csDept = await prisma.department.findFirst({ where: { facultyId: compFac?.id, name: "Computer Science" }, select: { courses: { select: { course: true } } } });
    const gesCourses = await prisma.course.findMany({ where: { isUniversityWide: true }, select: { semester: true, units: true } });

    const sem1DeptUnits = csDept?.courses.map(dc => dc.course).filter(c => c.semester === "1st").reduce((sum, c) => sum + c.units, 0) || 0;
    const sem1GesUnits = gesCourses.filter(c => c.semester === "1st").reduce((sum, c) => sum + c.units, 0); // 4 units
    const totalSem1Units = sem1DeptUnits + sem1GesUnits;

    if (totalSem1Units >= 15 && totalSem1Units <= 24) {
      console.log(`✅ TEST 4 PASSED: Credit load sum for Computing (CS) 1st Semester is ${totalSem1Units} Units (within valid 15 – 24 units limit).`);
      passes++;
    } else {
      console.log(`❌ TEST 4 FAILED: Credit load sum ${totalSem1Units} violates 15-24 limit.`);
      fails++;
    }
  } catch (err) {
    console.log(`❌ TEST 4 FAILED: ${err}`);
    fails++;
  }

  // Test 5: Reference Rules (Credit Load & 4.0 CGPA Scale)
  try {
    const creditRule = await prisma.referenceRule.findUnique({ where: { key: "CREDIT_LOAD" } });
    const cgpaRule = await prisma.referenceRule.findUnique({ where: { key: "CGPA_SCALE" } });

    if (creditRule && cgpaRule) {
      console.log(`✅ TEST 5 PASSED: Reference rules verified! Credit Limit (15-24 Units) and Senate 4.0 CGPA Scale present in DB.`);
      passes++;
    } else {
      console.log(`❌ TEST 5 FAILED: Missing reference rules.`);
      fails++;
    }
  } catch (err) {
    console.log(`❌ TEST 5 FAILED: ${err}`);
    fails++;
  }

  console.log("\n==================================================");
  console.log(`RESULTS SUMMARY: ${passes} PASSED, ${fails} FAILED.`);
  console.log("==================================================");

  await prisma.$disconnect();
}

runSelfTest();
