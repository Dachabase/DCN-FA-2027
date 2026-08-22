import "dotenv/config";
import { CourseStatus } from "@prisma/client";
import { prisma } from "../src/database/prisma";

async function getOrCreateFaculty(name: string, code: string) {
  let faculty = await prisma.faculty.findFirst({ where: { name } });
  if (!faculty) {
    faculty = await prisma.faculty.create({ data: { name, code } });
  }
  return faculty;
}

async function getOrCreateDepartment(facultyId: string, name: string) {
  let dept = await prisma.department.findFirst({ where: { facultyId, name } });
  if (!dept) {
    dept = await prisma.department.create({ data: { facultyId, name } });
  }
  return dept;
}

async function getOrCreateCourse(
  code: string,
  title: string,
  semester: "1st" | "2nd",
  status: CourseStatus,
  units: number,
  isUniversityWide = false
) {
  let course = await prisma.course.findUnique({ where: { code } });
  if (!course) {
    course = await prisma.course.create({
      data: {
        code,
        title,
        level: 100,
        semester,
        status,
        units,
        isUniversityWide,
      },
    });
  }
  return course;
}

async function linkDepartmentCourse(departmentId: string, courseId: string) {
  const existing = await prisma.departmentCourse.findUnique({
    where: { departmentId_courseId: { departmentId, courseId } },
  });
  if (!existing) {
    await prisma.departmentCourse.create({
      data: { departmentId, courseId },
    });
  }
}

async function main() {
  console.log("🌱 Starting University of Ibadan Academic Structure seed...");

  try {
    await prisma.$executeRawUnsafe(`GRANT ALL ON SCHEMA public TO postgres;`);
  } catch (e) {
    // ignore
  }

  // =========================================================
  // 1. SEED ALL 17 FACULTIES & DEPARTMENTS
  // =========================================================

  const facultyData = [
    { name: "Computing", code: "COMPUTING", depts: ["Computer Science", "Cybersecurity", "Information Technology", "Software Engineering"] },
    { name: "Science", code: "SCIENCE", depts: ["Computer Science", "Mathematics", "Statistics", "Physics", "Chemistry", "Botany", "Zoology", "Geology", "Microbiology", "Archaeology & Anthropology"] },
    { name: "Technology", code: "TECH", depts: ["Electrical & Electronic Engineering", "Mechanical Engineering", "Civil Engineering", "Agricultural & Environmental Engineering", "Petroleum Engineering", "Industrial & Production Engineering", "Biomedical Engineering", "Food Technology"] },
    { name: "Clinical Sciences", code: "CLINICAL", depts: ["Medicine & Surgery (MBBS)", "Nursing Science", "Physiotherapy", "Radiography & Radiation Science"] },
    { name: "Basic Medical Sciences", code: "BASIC_MED", depts: ["Anatomy", "Physiology", "Biochemistry", "Pharmacology & Therapeutics", "Human Nutrition & Dietetics"] },
    { name: "Dentistry", code: "DENTISTRY", depts: ["Child Dental Health", "Oral & Maxillofacial Surgery", "Oral Pathology & Medicine", "Periodontology & Community Dentistry", "Restorative Dentistry"] },
    { name: "Public Health", code: "PUBLIC_HEALTH", depts: ["Environmental Health Sciences", "Epidemiology & Medical Statistics", "Health Promotion & Education", "Health Policy & Management", "Human Nutrition"] },
    { name: "Pharmacy", code: "PHARMACY", depts: ["Pharmaceutical Chemistry", "Pharmaceutics & Industrial Pharmacy", "Pharmacognosy", "Pharmacology & Therapeutics", "Clinical Pharmacy & Pharmacy Administration"] },
    { name: "Environmental Design & Management", code: "EDM", depts: ["Architecture", "Estate Management", "Urban & Regional Planning", "Quantity Surveying", "Building"] },
    { name: "Veterinary Medicine", code: "VET_MED", depts: ["Veterinary Anatomy", "Veterinary Physiology & Biochemistry", "Veterinary Pathology", "Veterinary Microbiology & Parasitology", "Veterinary Public Health & Preventive Medicine", "Veterinary Medicine", "Veterinary Surgery & Radiology"] },
    { name: "Agriculture", code: "AGRIC", depts: ["Agricultural Economics", "Agricultural Extension & Rural Development", "Agronomy", "Animal Science", "Crop Protection & Environmental Biology"] },
    { name: "Renewable Natural Resources", code: "NAT_RES", depts: ["Forest Resources Management", "Wildlife & Ecotourism Management", "Aquaculture & Fisheries Management", "Social & Environmental Forestry"] },
    { name: "Economics & Management Sciences", code: "ECON_MGMT", depts: ["Economics", "Accounting", "Banking & Finance", "Marketing & Consumer Studies"] },
    { name: "The Social Sciences", code: "SOCIAL_SCI", depts: ["Political Science", "Psychology", "Sociology", "Geography"] },
    { name: "Arts", code: "ARTS", depts: ["English Language & Literature", "History", "Theatre Arts", "Philosophy", "Linguistics & African Languages", "Communication & Language Arts (CLA)", "Classics", "Religious Studies (Islamic/Christian)", "Music"] },
    { name: "Law", code: "LAW", depts: ["Public & International Law", "Private & Property Law", "Commercial & Industrial Law", "Jurisprudence & Legal Theory"] },
    { name: "Education", code: "EDUCATION", depts: ["Educational Management", "Guidance & Counseling", "Adult Education", "Special Education", "Science & Technology Education", "Arts & Social Sciences Education"] },
  ];

  const facultyMap: Record<string, any> = {};
  const deptMap: Record<string, any> = {};

  for (const f of facultyData) {
    const fac = await getOrCreateFaculty(f.name, f.code);
    facultyMap[f.name] = fac;

    for (const deptName of f.depts) {
      const dept = await getOrCreateDepartment(fac.id, deptName);
      deptMap[`${f.name}_${deptName}`] = dept;
    }
  }

  console.log("✅ 17 Faculties and 92+ Departments seeded.");

  // =========================================================
  // 2. SEED UNIVERSITY-WIDE GENERAL STUDIES (GES/GST BLOCK)
  // =========================================================

  const ges101 = await getOrCreateCourse("GST 111", "Communication in English I", "1st", CourseStatus.COMPULSORY, 2, true);
  const ges102 = await getOrCreateCourse("GST 112", "Communication in English II", "2nd", CourseStatus.COMPULSORY, 2, true);
  const ges103 = await getOrCreateCourse("GES 103", "Government, Society, and Economy", "1st", CourseStatus.COMPULSORY, 2, true);
  const ges106 = await getOrCreateCourse("GES 106", "Philosophy and Logic", "1st", CourseStatus.COMPULSORY, 2, true);
  const ges107 = await getOrCreateCourse("GES 107", "Reproductive Health, STIs, and HIV/AIDS", "2nd", CourseStatus.COMPULSORY, 2, true);
  const ges108 = await getOrCreateCourse("GES 108", "Introduction to French Language", "2nd", CourseStatus.COMPULSORY, 2, true);
  const ges109 = await getOrCreateCourse("GES 109", "Nigerian Peoples and Culture", "2nd", CourseStatus.COMPULSORY, 2, true);

  console.log("✅ University-wide GES/GST course block seeded.");

  // =========================================================
  // 3. SEED CORE 100-LEVEL COURSES
  // =========================================================

  // Computing & Science & Tech Core
  const csc101 = await getOrCreateCourse("CSC 101", "Introduction to Computer Science", "1st", CourseStatus.COMPULSORY, 3);
  const csc102 = await getOrCreateCourse("CSC 102", "Problem Solving & Programming", "2nd", CourseStatus.COMPULSORY, 3);
  const mat111 = await getOrCreateCourse("MAT 111", "Algebra and Trigonometry", "1st", CourseStatus.COMPULSORY, 3);
  const mat121 = await getOrCreateCourse("MAT 121", "Calculus I", "2nd", CourseStatus.COMPULSORY, 3);
  const phy101 = await getOrCreateCourse("PHY 101", "General Physics I (Mechanics & Heat)", "1st", CourseStatus.COMPULSORY, 3);
  const phy102 = await getOrCreateCourse("PHY 102", "General Physics II (Electricity & Magnetism)", "2nd", CourseStatus.COMPULSORY, 3);
  const phy107 = await getOrCreateCourse("PHY 107", "General Physics Practical I", "1st", CourseStatus.COMPULSORY, 1);
  const sta112 = await getOrCreateCourse("STA 112", "Introduction to Probability & Statistics", "2nd", CourseStatus.REQUIRED, 3);

  // Biology & Chemistry Core
  const bio101 = await getOrCreateCourse("BIO 101", "Basic Biology I (Cell Biology & Genetics)", "1st", CourseStatus.COMPULSORY, 3);
  const bio102 = await getOrCreateCourse("BIO 102", "Basic Biology II (Organismal Biology)", "2nd", CourseStatus.COMPULSORY, 3);
  const bio104 = await getOrCreateCourse("BIO 104", "Practical Biology Laboratory", "2nd", CourseStatus.COMPULSORY, 1);
  const chm101 = await getOrCreateCourse("CHM 101", "General Physical Chemistry", "1st", CourseStatus.COMPULSORY, 3);
  const chm102 = await getOrCreateCourse("CHM 102", "General Inorganic & Organic Chemistry", "2nd", CourseStatus.COMPULSORY, 3);
  const chm107 = await getOrCreateCourse("CHM 107", "General Chemistry Practical", "1st", CourseStatus.COMPULSORY, 1);

  // Technology Core
  const tch101 = await getOrCreateCourse("TCH 101", "Introduction to Engineering & Technology", "1st", CourseStatus.COMPULSORY, 2);
  const me101 = await getOrCreateCourse("ME 101", "Engineering Drawing I", "1st", CourseStatus.COMPULSORY, 2);
  const me102 = await getOrCreateCourse("ME 102", "Engineering Drawing II", "2nd", CourseStatus.COMPULSORY, 2);

  // Medical & Health Core
  const nut101 = await getOrCreateCourse("NUT 101", "Introduction to Human Nutrition", "1st", CourseStatus.COMPULSORY, 2);
  const ehs101 = await getOrCreateCourse("EHS 101", "Introduction to Environmental Health", "1st", CourseStatus.COMPULSORY, 2);

  // Environmental Design Core
  const esm101 = await getOrCreateCourse("ESM 101", "Introduction to Estate Management I", "1st", CourseStatus.COMPULSORY, 2);
  const esm102 = await getOrCreateCourse("ESM 102", "Introduction to Estate Management II", "2nd", CourseStatus.COMPULSORY, 2);
  const urp101 = await getOrCreateCourse("URP 101", "Introduction to Environmental Sciences", "1st", CourseStatus.COMPULSORY, 2);
  const urp104 = await getOrCreateCourse("URP 104", "Basic Elements of Planning", "2nd", CourseStatus.COMPULSORY, 2);
  const fea112 = await getOrCreateCourse("FEA 112", "Graphic Communication & Lettering I", "1st", CourseStatus.REQUIRED, 2);
  const fea122 = await getOrCreateCourse("FEA 122", "Graphic Communication & Lettering II", "2nd", CourseStatus.REQUIRED, 2);
  const mat101 = await getOrCreateCourse("MAT 101", "Supplementary Mathematics", "1st", CourseStatus.COMPULSORY, 4);

  // Management & Social Science Core
  const ams101 = await getOrCreateCourse("AMS 101", "Principles of Management", "1st", CourseStatus.COMPULSORY, 3);
  const ams102 = await getOrCreateCourse("AMS 102", "Basic Mathematics for Management", "1st", CourseStatus.COMPULSORY, 3);
  const ams103 = await getOrCreateCourse("AMS 103", "Introduction to Computing Science", "1st", CourseStatus.COMPULSORY, 3);
  const eco101 = await getOrCreateCourse("ECO 101", "Principles of Economics I", "1st", CourseStatus.COMPULSORY, 3);
  const eco102 = await getOrCreateCourse("ECO 102", "Principles of Economics II", "2nd", CourseStatus.COMPULSORY, 3);
  const acc101 = await getOrCreateCourse("ACC 101", "Introduction to Financial Accounting I", "1st", CourseStatus.COMPULSORY, 3);
  const acc102 = await getOrCreateCourse("ACC 102", "Introduction to Financial Accounting II", "2nd", CourseStatus.COMPULSORY, 3);
  const fin101 = await getOrCreateCourse("FIN 101", "Introduction to Finance I", "1st", CourseStatus.COMPULSORY, 3);
  const mcs103 = await getOrCreateCourse("MCS 103", "Introduction to Business I", "1st", CourseStatus.COMPULSORY, 3);
  const pos101 = await getOrCreateCourse("POS 101", "Introduction to Political Science", "1st", CourseStatus.COMPULSORY, 3);
  const soc101 = await getOrCreateCourse("SOC 101", "Introduction to Sociology", "1st", CourseStatus.COMPULSORY, 3);
  const psy101 = await getOrCreateCourse("PSY 101", "Introduction to Psychology", "1st", CourseStatus.COMPULSORY, 3);
  const geo101 = await getOrCreateCourse("GEO 101", "Physical Geography I", "1st", CourseStatus.COMPULSORY, 3);

  // Arts & Law & Education Core
  const eng101 = await getOrCreateCourse("ENG 101", "Introduction to English Language", "1st", CourseStatus.COMPULSORY, 3);
  const eng102 = await getOrCreateCourse("ENG 102", "Introduction to Literature in English", "2nd", CourseStatus.COMPULSORY, 3);
  const cla101 = await getOrCreateCourse("CLA 101", "Introduction to Communication Studies", "1st", CourseStatus.COMPULSORY, 3);
  const his101 = await getOrCreateCourse("HIS 101", "Nigeria from Earliest Times to 1800", "1st", CourseStatus.COMPULSORY, 3);
  const tha101 = await getOrCreateCourse("THA 101", "Introduction to Drama & Theatre", "1st", CourseStatus.COMPULSORY, 3);
  const phl101 = await getOrCreateCourse("PHL 101", "Introduction to Philosophy", "1st", CourseStatus.COMPULSORY, 3);
  const pul101 = await getOrCreateCourse("PUL 101", "Legal Method I", "1st", CourseStatus.COMPULSORY, 3);
  const pul102 = await getOrCreateCourse("PUL 102", "Legal Method II", "2nd", CourseStatus.COMPULSORY, 3);
  const ppr101 = await getOrCreateCourse("PPR 101", "Nigerian Legal System I", "1st", CourseStatus.COMPULSORY, 3);
  const ppr102 = await getOrCreateCourse("PPR 102", "Nigerian Legal System II", "2nd", CourseStatus.COMPULSORY, 3);
  const agr101 = await getOrCreateCourse("AGR 101", "Introductory Agriculture", "1st", CourseStatus.COMPULSORY, 2);
  const frm101 = await getOrCreateCourse("FRM 101", "Introduction to Forestry & Natural Resources", "1st", CourseStatus.COMPULSORY, 2);
  const wem101 = await getOrCreateCourse("WEM 101", "Introduction to Wildlife & Ecotourism", "2nd", CourseStatus.COMPULSORY, 2);
  const edu101 = await getOrCreateCourse("EDU 101", "History of Education", "1st", CourseStatus.COMPULSORY, 2);
  const edu102 = await getOrCreateCourse("EDU 102", "Philosophical Foundations of Education", "2nd", CourseStatus.COMPULSORY, 2);

  // =========================================================
  // 4. LINK COURSES TO DEPARTMENTS (SHARED PACKAGES)
  // =========================================================

  // Helper to link a list of courses to a department using batch createMany
  async function assignPackage(dept: any, courseList: any[]) {
    if (!dept || !courseList.length) return;
    const data = courseList.map((c) => ({
      departmentId: dept.id,
      courseId: c.id,
    }));
    await prisma.departmentCourse.createMany({
      data,
      skipDuplicates: true,
    });
  }

  // Pre-Med Package (Shared between Clinical Sciences & Dentistry!)
  const preMedPackage = [bio101, bio102, bio104, chm101, chm102, chm107, phy101, phy102, phy107];

  // Science Package (Shared between Science & Veterinary Medicine Pre-Vet!)
  const sciencePackage = [mat111, mat121, phy101, phy102, chm101, chm102, chm107, bio101, bio102, bio104];

  // Assign Computing Package
  const computingPackage = [csc101, csc102, mat111, mat121, phy101, phy102, phy107, sta112];
  for (const deptName of facultyData[0].depts) {
    await assignPackage(deptMap[`Computing_${deptName}`], computingPackage);
  }

  // Assign Science Package to Science departments
  for (const deptName of facultyData[1].depts) {
    await assignPackage(deptMap[`Science_${deptName}`], sciencePackage);
  }

  // Assign Technology Package
  const techPackage = [tch101, mat111, mat121, phy101, phy102, phy107, chm101, chm107, me101, me102];
  for (const deptName of facultyData[2].depts) {
    await assignPackage(deptMap[`Technology_${deptName}`], techPackage);
  }

  // Assign Pre-Med Package to Clinical Sciences
  for (const deptName of facultyData[3].depts) {
    await assignPackage(deptMap[`Clinical Sciences_${deptName}`], preMedPackage);
  }

  // LINK DENTISTRY DEPARTMENTS DIRECTLY TO CLINICAL SCIENCES PRE-MED PACKAGE (Principle 3 Shared Package!)
  for (const deptName of facultyData[5].depts) {
    await assignPackage(deptMap[`Dentistry_${deptName}`], preMedPackage);
  }

  // LINK VETERINARY MEDICINE DEPARTMENTS DIRECTLY TO SCIENCE PACKAGE (Principle 3 Shared Package!)
  for (const deptName of facultyData[9].depts) {
    await assignPackage(deptMap[`Veterinary Medicine_${deptName}`], sciencePackage);
  }

  // Assign Basic Medical Sciences
  const basicMedPackage = [bio101, bio102, bio104, chm101, chm102, chm107, phy101, phy102, phy107, nut101];
  for (const deptName of facultyData[4].depts) {
    await assignPackage(deptMap[`Basic Medical Sciences_${deptName}`], basicMedPackage);
  }

  // Assign Pharmacy
  const pharmacyPackage = [chm101, chm102, chm107, bio101, bio102, phy101, phy102, mat111];
  for (const deptName of facultyData[7].depts) {
    await assignPackage(deptMap[`Pharmacy_${deptName}`], pharmacyPackage);
  }

  // Assign EDM
  const edmPackage = [esm101, esm102, urp101, urp104, fea112, fea122, mat101, eco101, eco102];
  for (const deptName of facultyData[8].depts) {
    await assignPackage(deptMap[`Environmental Design & Management_${deptName}`], edmPackage);
  }

  // Assign Agriculture & Natural Resources
  const agricPackage = [agr101, bio101, bio102, chm101, chm102, phy101, phy102, mat111];
  for (const deptName of facultyData[10].depts) {
    await assignPackage(deptMap[`Agriculture_${deptName}`], agricPackage);
  }

  const natResPackage = [frm101, wem101, bio101, bio102, chm101, chm102, phy101, phy102];
  for (const deptName of facultyData[11].depts) {
    await assignPackage(deptMap[`Renewable Natural Resources_${deptName}`], natResPackage);
  }

  // Assign Econ & Mgmt
  const econMgmtPackage = [ams101, ams102, ams103, eco101, eco102, acc101, acc102, fin101, mcs103];
  for (const deptName of facultyData[12].depts) {
    await assignPackage(deptMap[`Economics & Management Sciences_${deptName}`], econMgmtPackage);
  }

  // Assign Social Sciences
  const socialSciPackage = [pos101, soc101, psy101, geo101, eco101];
  for (const deptName of facultyData[13].depts) {
    await assignPackage(deptMap[`The Social Sciences_${deptName}`], socialSciPackage);
  }

  // Assign Arts
  const artsPackage = [eng101, eng102, cla101, his101, tha101, phl101];
  for (const deptName of facultyData[14].depts) {
    await assignPackage(deptMap[`Arts_${deptName}`], artsPackage);
  }

  // Assign Law
  const lawPackage = [pul101, pul102, ppr101, ppr102, pos101];
  for (const deptName of facultyData[15].depts) {
    await assignPackage(deptMap[`Law_${deptName}`], lawPackage);
  }

  // Assign Education
  const eduPackage = [edu101, edu102, mat111, eng101, chm101];
  for (const deptName of facultyData[16].depts) {
    await assignPackage(deptMap[`Education_${deptName}`], eduPackage);
  }

  console.log("✅ All Course Packages and Shared Package Links assigned.");

  // =========================================================
  // 5. SEED REFERENCE RULES (CREDIT LIMITS & CGPA SCALE)
  // =========================================================

  await prisma.referenceRule.upsert({
    where: { key: "CREDIT_LOAD" },
    update: {
      value: JSON.stringify({ minUnitsPerSemester: 15, maxUnitsPerSemester: 24 }),
      description: "Minimum 15 units, Maximum 24 units allowed per semester at University of Ibadan.",
    },
    create: {
      category: "CREDIT_LOAD",
      title: "Semester Credit Load Rules",
      key: "CREDIT_LOAD",
      value: JSON.stringify({ minUnitsPerSemester: 15, maxUnitsPerSemester: 24 }),
      description: "Minimum 15 units, Maximum 24 units allowed per semester at University of Ibadan.",
    },
  });

  await prisma.referenceRule.upsert({
    where: { key: "CGPA_SCALE" },
    update: {
      value: JSON.stringify({
        scale: 4.0,
        grades: [
          { range: "70% – 100%", grade: "A", gp: 4.0 },
          { range: "60% – 69%", grade: "B", gp: 3.0 },
          { range: "50% – 59%", grade: "C", gp: 2.0 },
          { range: "45% – 49%", grade: "D", gp: 1.0 },
          { range: "0% – 44%", grade: "F", gp: 0.0 },
        ],
        goodStandingMinCgpa: 1.50,
        probationRange: "1.00 – 1.49",
        withdrawalThreshold: "< 1.00",
      }),
      description: "University of Ibadan 4.0 CGPA Senate Scale.",
    },
    create: {
      category: "CGPA_SCALE",
      title: "UI Senate 4.0 CGPA Grading Scale",
      key: "CGPA_SCALE",
      value: JSON.stringify({
        scale: 4.0,
        grades: [
          { range: "70% – 100%", grade: "A", gp: 4.0 },
          { range: "60% – 69%", grade: "B", gp: 3.0 },
          { range: "50% – 59%", grade: "C", gp: 2.0 },
          { range: "45% – 49%", grade: "D", gp: 1.0 },
          { range: "0% – 44%", grade: "F", gp: 0.0 },
        ],
        goodStandingMinCgpa: 1.50,
        probationRange: "1.00 – 1.49",
        withdrawalThreshold: "< 1.00",
      }),
      description: "University of Ibadan 4.0 CGPA Senate Scale.",
    },
  });

  console.log("✅ Reference Rules (Credit Load & CGPA Scale) seeded.");
  console.log("🎉 Database seeding completed successfully!");
}

main()
  .catch((e) => {
    console.error("❌ Seeding failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });