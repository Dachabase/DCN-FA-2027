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
  } else {
    // Update fields if needed
    course = await prisma.course.update({
      where: { code },
      data: { title, semester, status, units, isUniversityWide }
    });
  }
  return course;
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
    { name: "Computing", code: "COMPUTING", depts: ["Computer Science", "Cybersecurity", "Information Technology", "Software Engineering", "Data Science"] },
    { name: "Science", code: "SCIENCE", depts: ["Computer Science", "Mathematics", "Statistics", "Physics", "Chemistry", "Botany", "Zoology", "Geology", "Microbiology", "Archaeology & Anthropology"] },
    { name: "Technology", code: "TECH", depts: ["Electrical & Electronic Engineering", "Mechanical Engineering", "Civil Engineering", "Agricultural & Environmental Engineering", "Petroleum Engineering", "Industrial & Production Engineering", "Biomedical Engineering", "Food Technology", "Automotive Engineering", "Wood Products Engineering"] },
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
    { name: "Arts", code: "ARTS", depts: ["Arabic & Islamic Studies", "Archaeology & Anthropology", "Classics", "Communication & Language Arts", "English", "European Studies", "History", "Linguistics & African Languages", "Music", "Philosophy", "Religious Studies", "Theatre Arts"] },
    { name: "Law", code: "LAW", depts: ["Public & International Law", "Private & Property Law", "Commercial & Industrial Law", "Jurisprudence & Legal Theory"] },
    { name: "Education", code: "EDUCATION", depts: ["Educational Management", "Guidance & Counselling", "Adult Education", "Special Education", "Human Kinetics & Health Education", "Social Work", "Science & Technology Education", "Arts & Social Sciences Education"] },
    { name: "Nursing Science", code: "NURSING", depts: ["Nursing Science (BNSc)", "Maternal & Child Health Nursing", "Community Health Nursing", "Medical-Surgical Nursing"] },
    { name: "Multidisciplinary Studies", code: "MDS", depts: ["Data and Information Science", "Minerals, Petroleum, Energy Economics and Law", "Sustainability Studies", "Peace, Security and Humanitarian Studies", "Bioethics and Medical Humanities"] }
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

  console.log("✅ 18 Faculties and 95+ Departments seeded.");

  // =========================================================
  // 2. SEED UNIVERSITY-WIDE GENERAL STUDIES (GES/GST BLOCK)
  // =========================================================

  const gst111 = await getOrCreateCourse("C-GST 111", "Communication in English I", "1st", CourseStatus.COMPULSORY, 2, true);
  const gst112 = await getOrCreateCourse("C-GST 112", "Nigerian Peoples and Culture", "2nd", CourseStatus.COMPULSORY, 2, true);
  const ges107 = await getOrCreateCourse("C-UI-GES 107", "Reproductive Health, STIs & HIV", "1st", CourseStatus.REQUIRED, 1, true);
  const ges108 = await getOrCreateCourse("C-UI-GES 108", "Introduction to French", "2nd", CourseStatus.REQUIRED, 1, true);
  const ges103 = await getOrCreateCourse("GES 103", "Government, Society, and Economy", "1st", CourseStatus.COMPULSORY, 2, true);
  const ges106 = await getOrCreateCourse("GES 106", "Philosophy and Logic", "1st", CourseStatus.COMPULSORY, 2, true);

  console.log("✅ University-wide GES/GST course block seeded.");

  // =========================================================
  // 3. SEED CANONICAL 100-LEVEL COURSES BY FACULTY
  // =========================================================

  // --- Faculty of Computing (CCMAS Unified 100L) ---
  const cos101 = await getOrCreateCourse("C-COS 101", "Introduction to Computing Sciences", "1st", CourseStatus.COMPULSORY, 3);
  const mth101 = await getOrCreateCourse("C-MTH 101", "Elementary Mathematics I (Algebra & Trigonometry)", "1st", CourseStatus.COMPULSORY, 2);
  const sta111 = await getOrCreateCourse("C-STA 111", "Descriptive Statistics", "1st", CourseStatus.COMPULSORY, 3);
  const phy101c = await getOrCreateCourse("C-PHY 101", "General Physics I (Mechanics)", "1st", CourseStatus.COMPULSORY, 2);
  const phy107c = await getOrCreateCourse("C-PHY 107", "General Practical Physics I", "1st", CourseStatus.COMPULSORY, 1);
  const mth103 = await getOrCreateCourse("C-MTH 103", "Elementary Mathematics III (Vectors, Geometry & Dynamics)", "1st", CourseStatus.REQUIRED, 2);

  const cos102 = await getOrCreateCourse("C-COS 102", "Problem Solving", "2nd", CourseStatus.COMPULSORY, 3);
  const mth102 = await getOrCreateCourse("C-MTH 102", "Elementary Mathematics II (Calculus)", "2nd", CourseStatus.COMPULSORY, 2);
  const phy102c = await getOrCreateCourse("C-PHY 102", "General Physics II (Electricity & Magnetism)", "2nd", CourseStatus.COMPULSORY, 2);
  const phy108c = await getOrCreateCourse("C-PHY 108", "General Practical Physics II", "2nd", CourseStatus.COMPULSORY, 1);
  const sta122 = await getOrCreateCourse("C-STA 122", "Statistical Computing I", "2nd", CourseStatus.REQUIRED, 3);
  const cos103 = await getOrCreateCourse("C-UI-COS 103", "Practical Lab I", "1st", CourseStatus.COMPULSORY, 2);

  // --- Faculty of Arts ---
  const phl101 = await getOrCreateCourse("C-PHL 101", "Introduction to Philosophy", "1st", CourseStatus.COMPULSORY, 3);
  const phl102 = await getOrCreateCourse("C-PHL 102", "Arguments and Critical Thinking", "2nd", CourseStatus.COMPULSORY, 3);
  const phl103 = await getOrCreateCourse("C-PHL 103", "Elementary Ethics", "1st", CourseStatus.REQUIRED, 3);
  const phl104 = await getOrCreateCourse("C-PHL 104", "History of Philosophy", "2nd", CourseStatus.REQUIRED, 3);
  const phl106 = await getOrCreateCourse("C-PHL 106", "Introduction to African Philosophy", "2nd", CourseStatus.COMPULSORY, 3);
  const lin105 = await getOrCreateCourse("C-LIN 105", "Languages of the World", "1st", CourseStatus.COMPULSORY, 3);
  const lin107 = await getOrCreateCourse("C-LIN 107", "Introduction to Grammatical Analysis I", "2nd", CourseStatus.COMPULSORY, 3);
  const liy101 = await getOrCreateCourse("C-LIY 101", "Introduction to Yorùbá People, Language and Culture", "1st", CourseStatus.COMPULSORY, 3);

  // --- Faculty of Education ---
  const edu101 = await getOrCreateCourse("EDU 101", "Introduction to Teaching and Foundations of Education", "1st", CourseStatus.COMPULSORY, 2);
  const edu100 = await getOrCreateCourse("UI-EDU 100", "Instructional Methods I", "2nd", CourseStatus.COMPULSORY, 2);
  const eae101 = await getOrCreateCourse("EAE 101", "Introduction to Adult Education", "1st", CourseStatus.COMPULSORY, 3);
  const eae102 = await getOrCreateCourse("EAE 102", "Historical Foundations of Adult Education", "2nd", CourseStatus.COMPULSORY, 3);
  const edm101 = await getOrCreateCourse("EDM 101", "History of Educational Management in Nigeria", "1st", CourseStatus.COMPULSORY, 3);
  const edm102 = await getOrCreateCourse("EDM 102", "Introduction to Management and Human Resources Behaviours", "2nd", CourseStatus.COMPULSORY, 3);
  const edm104 = await getOrCreateCourse("EDM 104", "Basic Concepts in Economics of Education and Planning", "2nd", CourseStatus.COMPULSORY, 3);
  const hee105 = await getOrCreateCourse("UI-HEE 105", "Health Care Delivery System in Nigeria", "1st", CourseStatus.COMPULSORY, 2);
  const ehe120 = await getOrCreateCourse("EHE 120", "Introduction to Community and Public Health", "2nd", CourseStatus.COMPULSORY, 2);
  const gce101 = await getOrCreateCourse("GCE 101", "Introduction to Guidance and Counselling", "1st", CourseStatus.COMPULSORY, 3);
  const gce103 = await getOrCreateCourse("GCE 103", "Developmental Psychology", "2nd", CourseStatus.COMPULSORY, 3);
  const swk111 = await getOrCreateCourse("SWK 111", "Introduction to Social Work", "1st", CourseStatus.COMPULSORY, 3);
  const swk112 = await getOrCreateCourse("SWK 112", "Introduction to Indigenous Social Welfare", "2nd", CourseStatus.COMPULSORY, 3);

  // --- Faculty of EDM (Environmental Design & Management) ---
  const esm101 = await getOrCreateCourse("ESM 101", "Introduction to Estate Management I", "1st", CourseStatus.COMPULSORY, 2);
  const esm102 = await getOrCreateCourse("ESM 102", "Introduction to Estate Management II", "2nd", CourseStatus.COMPULSORY, 2);
  const esm103 = await getOrCreateCourse("ESM 103", "Principles of Land Economy", "2nd", CourseStatus.COMPULSORY, 2);
  const esm105 = await getOrCreateCourse("ESM 105", "Introduction to Accounting for Estate Management I", "1st", CourseStatus.REQUIRED, 2);
  const esm106 = await getOrCreateCourse("ESM 106", "Introduction to Accounting for Estate Management II", "2nd", CourseStatus.REQUIRED, 2);
  const urp101 = await getOrCreateCourse("URP 101", "Introduction to Environmental Sciences", "1st", CourseStatus.COMPULSORY, 2);
  const urp104 = await getOrCreateCourse("URP 104", "Basic Elements of Planning", "2nd", CourseStatus.COMPULSORY, 2);
  const fea112 = await getOrCreateCourse("FEA 112", "Graphic Communication and Lettering I", "1st", CourseStatus.REQUIRED, 2);
  const fea122 = await getOrCreateCourse("FEA 122", "Graphic Communication and Lettering II", "2nd", CourseStatus.REQUIRED, 2);
  const mat101e = await getOrCreateCourse("MAT 101", "Supplementary Mathematics", "1st", CourseStatus.COMPULSORY, 3);
  const pos114 = await getOrCreateCourse("POS 114", "The Citizen and the State", "2nd", CourseStatus.ELECTIVE, 2);

  // --- Faculty of Law ---
  const law101 = await getOrCreateCourse("LAW 101", "Legal Methods I", "1st", CourseStatus.COMPULSORY, 2);
  const law102 = await getOrCreateCourse("LAW 102", "Legal Methods II", "2nd", CourseStatus.COMPULSORY, 2);

  // --- Faculty of Pharmacy ---
  const pcy101 = await getOrCreateCourse("PCY 101", "Introduction to Pharmacy", "1st", CourseStatus.COMPULSORY, 2);

  // --- Faculty of Technology ---
  const get111 = await getOrCreateCourse("GET 111", "Engineer in Society I", "1st", CourseStatus.COMPULSORY, 1);
  const get112 = await getOrCreateCourse("GET 112", "Engineer in Society II", "2nd", CourseStatus.COMPULSORY, 1);
  const tme111 = await getOrCreateCourse("TME 111", "Basic Engineering Drawing", "1st", CourseStatus.COMPULSORY, 2);
  const tme121 = await getOrCreateCourse("TME 121", "Basic Workshop Practice", "2nd", CourseStatus.COMPULSORY, 2);

  // --- Science & Pre-Med Foundations ---
  const bio101 = await getOrCreateCourse("BIO 101", "Cell Biology & Genetics", "1st", CourseStatus.COMPULSORY, 3);
  const bio102 = await getOrCreateCourse("BIO 102", "Organismal Biology", "2nd", CourseStatus.COMPULSORY, 3);
  const bio104 = await getOrCreateCourse("BIO 104", "Practical Biology Laboratory", "2nd", CourseStatus.COMPULSORY, 1);
  const chm101 = await getOrCreateCourse("CHM 101", "General Physical Chemistry", "1st", CourseStatus.COMPULSORY, 3);
  const chm102 = await getOrCreateCourse("CHM 102", "General Inorganic & Organic Chemistry", "2nd", CourseStatus.COMPULSORY, 3);
  const chm107 = await getOrCreateCourse("CHM 107", "General Chemistry Practical", "1st", CourseStatus.COMPULSORY, 1);
  const eco101 = await getOrCreateCourse("ECO 101", "Introductory Economics I", "1st", CourseStatus.COMPULSORY, 3);
  const eco102 = await getOrCreateCourse("ECO 102", "Introductory Economics II", "2nd", CourseStatus.COMPULSORY, 3);
  const soc101 = await getOrCreateCourse("SOC 101", "Principles of Sociology", "1st", CourseStatus.ELECTIVE, 3);

  // =========================================================
  // 4. ASSIGN PACKAGES TO DEPARTMENTS
  // =========================================================

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

  // Computing Package (CCMAS Unified)
  const computingPkg = [gst111, cos101, mth101, sta111, phy101c, phy107c, mth103, ges107, ges108, gst112, cos102, mth102, phy102c, phy108c, sta122, cos103];
  for (const deptName of facultyData[0].depts) {
    await assignPackage(deptMap[`Computing_${deptName}`], computingPkg);
  }

  // Arts Package
  const artsPkg = [gst111, gst112, ges107, ges108, phl101, phl102, phl103, phl104, phl106, lin105, lin107, liy101];
  for (const deptName of facultyData[14].depts) {
    await assignPackage(deptMap[`Arts_${deptName}`], artsPkg);
  }

  // Education Package
  const eduPkg = [gst111, gst112, edu101, edu100, eae101, eae102, edm101, edm102, edm104, hee105, ehe120, gce101, gce103, swk111, swk112];
  for (const deptName of facultyData[16].depts) {
    await assignPackage(deptMap[`Education_${deptName}`], eduPkg);
  }

  // EDM Package
  const edmPkg = [esm101, esm102, esm103, esm105, esm106, urp101, urp104, fea112, fea122, mat101e, eco101, eco102, soc101, pos114, gst111, ges107, ges108];
  for (const deptName of facultyData[8].depts) {
    await assignPackage(deptMap[`Environmental Design & Management_${deptName}`], edmPkg);
  }

  // Law Package
  const lawPkg = [law101, law102, gst111, gst112, ges107, ges108];
  for (const deptName of facultyData[15].depts) {
    await assignPackage(deptMap[`Law_${deptName}`], lawPkg);
  }

  // Pharmacy Package
  const pharmPkg = [pcy101, chm101, chm102, chm107, bio101, bio102, bio104, phy101c, phy102c, mth101, gst111, ges107, ges108];
  for (const deptName of facultyData[7].depts) {
    await assignPackage(deptMap[`Pharmacy_${deptName}`], pharmPkg);
  }

  // Technology Package
  const techPkg = [get111, get112, tme111, tme121, chm101, chm102, chm107, phy101c, phy102c, mth101, mth102, cos101, sta111, gst111, gst112, ges107];
  for (const deptName of facultyData[2].depts) {
    await assignPackage(deptMap[`Technology_${deptName}`], techPkg);
  }

  // Pre-Med Package (Clinical Sciences, Dentistry & Nursing Science Shared)
  const preMedPkg = [bio101, bio102, bio104, chm101, chm102, chm107, phy101c, phy102c, phy107c, gst111, gst112, ges107];
  for (const deptName of facultyData[3].depts) {
    await assignPackage(deptMap[`Clinical Sciences_${deptName}`], preMedPkg);
  }
  for (const deptName of facultyData[5].depts) {
    await assignPackage(deptMap[`Dentistry_${deptName}`], preMedPkg);
  }
  for (const deptName of facultyData[17].depts) {
    await assignPackage(deptMap[`Nursing Science_${deptName}`], preMedPkg);
  }

  // Science Package (Science & Veterinary Medicine Shared)
  const sciencePkg = [mth101, mth102, phy101c, phy102c, chm101, chm102, chm107, bio101, bio102, bio104, gst111, gst112, ges107];
  for (const deptName of facultyData[1].depts) {
    await assignPackage(deptMap[`Science_${deptName}`], sciencePkg);
  }
  for (const deptName of facultyData[9].depts) {
    await assignPackage(deptMap[`Veterinary Medicine_${deptName}`], sciencePkg);
  }

  // Basic Medical Sciences Package
  const basicMedPkg = [bio101, bio102, bio104, chm101, chm102, chm107, phy101c, phy102c, gst111, gst112, ges107];
  for (const deptName of facultyData[4].depts) {
    await assignPackage(deptMap[`Basic Medical Sciences_${deptName}`], basicMedPkg);
  }

  console.log("✅ All Course Packages and CCMAS datasets assigned.");

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
        scale: 5.0,
        grades: [
          { range: "70% – 100%", grade: "A", gp: 5.0 },
          { range: "60% – 69%", grade: "B", gp: 4.0 },
          { range: "50% – 59%", grade: "C", gp: 3.0 },
          { range: "45% – 49%", grade: "D", gp: 2.0 },
          { range: "40% – 44%", grade: "E", gp: 1.0 },
          { range: "0% – 39%", grade: "F", gp: 0.0 },
        ],
        goodStandingMinCgpa: 1.50,
        probationRange: "1.00 – 1.49",
        withdrawalThreshold: "< 1.00",
        classifications: [
          { range: "4.50 – 5.00", class: "First Class Honours" },
          { range: "3.50 – 4.49", class: "Second Class Honours (Upper Division)" },
          { range: "2.40 – 3.49", class: "Second Class Honours (Lower Division)" },
          { range: "1.50 – 2.39", class: "Third Class Honours" },
          { range: "1.00 – 1.49", class: "Pass" },
        ]
      }),
      description: "University of Ibadan 5.0 CGPA Senate Scale.",
    },
    create: {
      category: "CGPA_SCALE",
      title: "UI Senate 5.0 CGPA Grading Scale",
      key: "CGPA_SCALE",
      value: JSON.stringify({
        scale: 5.0,
        grades: [
          { range: "70% – 100%", grade: "A", gp: 5.0 },
          { range: "60% – 69%", grade: "B", gp: 4.0 },
          { range: "50% – 59%", grade: "C", gp: 3.0 },
          { range: "45% – 49%", grade: "D", gp: 2.0 },
          { range: "40% – 44%", grade: "E", gp: 1.0 },
          { range: "0% – 39%", grade: "F", gp: 0.0 },
        ],
        goodStandingMinCgpa: 1.50,
        probationRange: "1.00 – 1.49",
        withdrawalThreshold: "< 1.00",
        classifications: [
          { range: "4.50 – 5.00", class: "First Class Honours" },
          { range: "3.50 – 4.49", class: "Second Class Honours (Upper Division)" },
          { range: "2.40 – 3.49", class: "Second Class Honours (Lower Division)" },
          { range: "1.50 – 2.39", class: "Third Class Honours" },
          { range: "1.00 – 1.49", class: "Pass" },
        ]
      }),
      description: "University of Ibadan 5.0 CGPA Senate Scale.",
    },
  });

  // Seed Bot Record for @UIDCNComputingFreshersBot
  const computingFac = await prisma.faculty.findFirst({ where: { code: "COMPUTING" } });
  await prisma.bot.upsert({
    where: { username: "UIDCNComputingFreshersBot" },
    update: {
      telegramBotId: BigInt(8954703429),
      name: "UI Computing Freshers Study Buddy",
      facultyId: computingFac ? computingFac.id : null,
    },
    create: {
      telegramBotId: BigInt(8954703429),
      username: "UIDCNComputingFreshersBot",
      name: "UI Computing Freshers Study Buddy",
      facultyId: computingFac ? computingFac.id : null,
    },
  });

  // =========================================================
  // 6. SEED ALL ESSENTIAL IN-APP GUIDES
  // =========================================================

  const allGuides = [
    {
      id: "guide_100l_reg",
      title: "100L Course Registration & Subject Combination Guide",
      summary: "Step-by-step walkthrough for registering 100L compulsory and elective courses at UI, credit load limits, and course adviser validation.",
      content: `## 1. Overview of 100-Level Course Registration

Welcome to the University of Ibadan! Course registration is the foundational academic activity for every fresh undergraduate. Completing your registration correctly ensures your Continuous Assessment (CA) scores, attendance records, and examination clearance are properly captured on the Senate portal.

---

## 2. University General Courses (Compulsory Block)

All 100-Level undergraduates across all 18 faculties are required to register and pass the following General Studies (GST/GES) courses:

- **GST 111 (Use of English I)** — 2 Units (1st Semester): Focuses on communication in English, academic reading, essay writing, comprehension, and library reference skills.
- **GST 112 (Use of English II)** — 2 Units (2nd Semester): Advanced logical composition, argumentation, scientific and technical writing conventions.
- **GES 107 (Philosophy and Logic)** — 2 Units (1st Semester): Fundamental principles of symbolic logic, deduction, fallacies, and philosophical reasoning.
- **GST 113 (Nigerian Peoples and Culture)** — 2 Units: History, sociopolitical structure, and cultural heritage of Nigerian ethnic groups.

---

## 3. Faculty of Computing Core 100L Courses

For students in Computer Science, Cybersecurity, Information Technology, Software Engineering, and Data Science:

| Course Code | Course Title | Units | Semester | Status |
| :--- | :--- | :--- | :--- | :--- |
| **CSC 101** | Introduction to Computer Science | 3 Units | 1st Semester | Compulsory |
| **CSC 102** | Problem Solving & Python Programming | 3 Units | 2nd Semester | Compulsory |
| **MAT 111** | Algebra & Trigonometry | 3 Units | 1st Semester | Required |
| **MAT 121** | Calculus I | 3 Units | 1st Semester | Required |
| **PHY 101** | General Physics (Mechanics & Thermal) | 3 Units | 1st Semester | Required |
| **PHY 107** | Practical Physics Laboratory I | 1 Unit | 1st Semester | Compulsory |

---

## 4. Step-by-Step Portal Workflow

Follow these exact steps on the UI Undergraduate Portal:

1. **Log in to Portal:** Navigate to \`https://portal.ui.edu.ng\` using your Matriculation Number or JAMB Registration Number and temporary password.
2. **Fee Verification:** Ensure your Acceptance Fee and Session School Fees are marked as **PAID** with receipt status verified.
3. **Course Selection:** Select your faculty and department. Check all compulsory 100L departmental courses and university-wide GST courses.
4. **Credit Unit Validation:** Ensure your total semester units fall strictly between **15 units (minimum)** and **24 units (maximum)**.
5. **Submit for Vetting:** Click "Submit for Departmental Approval". Do not leave your courses in "Draft" state.
6. **Course Adviser Endorsement:** Meet your Level Adviser at your department with your course slip draft for physical endorsement.
7. **Final Printout:** Once approved, print **four (4) copies of Form 01 (Course Registration Form)**.

---

## 5. Form 01 Distribution Checklist

- Copy 1: Faculty Officer / Sub-Dean's Office
- Copy 2: Departmental Head / Level Adviser
- Copy 3: Academic Affairs Secretariat
- Copy 4: Student Personal File (Keep safely for 400L final clearance!)

> [!IMPORTANT]
> **Deadline Notice:** Late course registration carries a mandatory penalty fee. Unregistered students will NOT be issued examination dockets or permitted into CBT exam venues.`,
      category: "Course Registration",
      status: "PUBLISHED",
      facultyId: computingFac ? computingFac.id : null,
      source: "UI Academic Affairs Secretariat & Faculty of Computing Handbook",
      owner: "Office of the Dean, Faculty of Computing",
    },
    {
      id: "guide_cgpa",
      title: "Understanding the UI 5.0 CGPA Grading System",
      summary: "Comprehensive guide to grade points, semester GPA calculation, probation limits, and degree classifications on UI's 5.0 scale.",
      content: `## 1. The University of Ibadan 5.0 CGPA Scale

The Senate of the University of Ibadan operates a Cumulative Grade Point Average (CGPA) system evaluated on a **5-Point Scale (5.00)**. Your academic standing and degree classification are determined by the quality points earned in all registered courses.

---

## 2. Official UI Senate Grading System

| Score Range | Letter Grade | Grade Point (GP) | Classification Equivalent |
| :--- | :--- | :--- | :--- |
| **70% – 100%** | **A** | **5.0** | First Class |
| **60% – 69%** | **B** | **4.0** | Second Class Upper (2:1) |
| **50% – 59%** | **C** | **3.0** | Second Class Lower (2:2) |
| **45% – 49%** | **D** | **2.0** | Third Class |
| **40% – 44%** | **E** | **1.0** | Pass |
| **0% – 39%** | **F** | **0.0** | Fail |

---

## 3. How to Calculate Your GPA & CGPA

Your Grade Point Average (GPA) is computed by multiplying each course's credit units by the Grade Point earned, summing the results (Total Quality Points), and dividing by the Total Registered Units:

$$\\text{GPA} = \\frac{\\sum (\\text{Course Units} \\times \\text{Grade Point})}{\\sum \\text{Total Course Units}}$$

### Worked Example:
Suppose a 100L student registers 5 courses totaling 15 units:
- **CSC 101** (3 Units) — Score: 76% (A = 5.0) $\\rightarrow 3 \\times 5.0 = 15.0$
- **MAT 111** (3 Units) — Score: 64% (B = 4.0) $\\rightarrow 3 \\times 4.0 = 12.0$
- **PHY 101** (3 Units) — Score: 55% (C = 3.0) $\\rightarrow 3 \\times 3.0 = 9.0$
- **GST 111** (2 Units) — Score: 81% (A = 5.0) $\\rightarrow 2 \\times 5.0 = 10.0$
- **GES 107** (2 Units) — Score: 68% (B = 4.0) $\\rightarrow 2 \\times 4.0 = 8.0$
- **PHY 107** (2 Units) — Score: 72% (A = 5.0) $\\rightarrow 2 \\times 5.0 = 10.0$

**Total Units:** $3 + 3 + 3 + 2 + 2 + 2 = 15$ Units  
**Total Quality Points:** $15 + 12 + 9 + 10 + 8 + 10 = 64.0$ Points  
**Semester GPA:** $64.0 \\div 15 = \\mathbf{4.27}$ (Strong Second Class Upper!)

---

## 4. Academic Standing & Senate Regulations

- **Good Standing:** A Cumulative GPA of **1.50 and above**.
- **Academic Warning:** CGPA between **1.00 and 1.49** after 1st Semester.
- **Academic Probation:** A student whose CGPA falls between **1.00 and 1.49** at the end of the entire academic session will be placed on formal Senate probation.
- **Advice to Withdraw (Probation Failure):** Any student whose CGPA is **less than 1.00** at the end of their 100-Level session will be advised to withdraw from the University.

---

## 5. Degree Classifications at Graduation

- **4.50 – 5.00** : First Class Honours
- **3.50 – 4.49** : Second Class Honours (Upper Division)
- **2.40 – 3.49** : Second Class Honours (Lower Division)
- **1.50 – 2.39** : Third Class Honours
- **1.00 – 1.49** : Pass Degree

> [!TIP]
> **Strategic Freshers Tip:** Your 100-Level courses represent the highest volume of fundamental units. Securing an A/B grade foundation in 100L creates a resilient buffer that protects your CGPA throughout 200L to 400L.`,
      category: "Grading System",
      status: "PUBLISHED",
      facultyId: null,
      source: "UI Academic Regulations Handbook & Senate Bulletin",
      owner: "UI Academic Senate",
    },
    {
      id: "guide_venues",
      title: "Lecture Venues & Campus Navigation Map",
      summary: "Locate Large Lecture Theatres (LLT), ICT Center, Science Lecture Theater, Faculty labs, and campus complexes.",
      content: `## 1. Campus Geography & Key Lecture Venues

The University of Ibadan spans over 2,550 acres. As a fresher, navigating between general lecture halls, faculty complexes, and laboratories efficiently prevents late arrivals and missing unannounced quizzes.

---

## 2. Major 100L Lecture Theatres

### Large Lecture Theatre (LLT)
- **Location:** Directly opposite Faculty of Science, adjacent to Physics department.
- **Primary Use:** GST 111, GST 112, and large MAT 111/121 lecture sessions.
- **Tips:** Arrive 15 minutes before 8:00 AM lectures to secure seating near public address speakers.

### Science Lecture Theatre (SLT) & Multipurpose Theatre (MLT)
- **Location:** Faculty of Science inner quadrangle.
- **Primary Use:** Chemistry (CHM 101), Physics, and combined biological science lectures.

### Faculty of Computing Complex
- **Location:** New Computing Building near Tech Faculty roundabout.
- **Facilities:** Computing Lab 1 (Ground Floor), Software Engineering Lab 2 (1st Floor), and Computing Seminar Hall.

### Trenchard Hall
- **Location:** University Central Administrative Axis, opposite the Tower.
- **Primary Use:** Matriculation ceremony, University-wide orientation programs, and major guest lectures.

---

## 3. Campus Transportation Guide

- **Campus Shuttle Cabs:** Operates between University Main Gate and Sub-Stations (UI Bookshop, Central Bank Building, KDL, and Faculties). Fare is standardized at ₦100 – ₦150 per drop.
- **Tricycles (Keke):** Fast point-to-point transit connecting Residential Halls (Zik, Indy, Idia, Queen Elizabeth) with Faculty zones.
- **Walking Times:** 
  - Main Gate to LLT: ~10 minutes walk
  - KDL to Faculty of Computing: ~6 minutes walk
  - SUB to Tech Quadrangle: ~8 minutes walk

---

## 4. Practical Laboratory Etiquette

1. **Lab Coats:** White lab coats are mandatory for all Physics (PHY 107) and Chemistry (CHM 107) practicals.
2. **Computing Labs:** No food or open liquids permitted near workstation terminals.
3. **Safety Shoes:** Closed flat footwear is strictly enforced inside engineering and science laboratories.`,
      category: "Campus Navigation",
      status: "PUBLISHED",
      facultyId: null,
      source: "UI Directorate of Physical Planning & Student Affairs",
      owner: "Directorate of Physical Planning",
    },
    {
      id: "guide_clearance",
      title: "Departmental Physical Clearance Requirements & Document Checklist",
      summary: "Comprehensive checklist of mandatory physical documents, acceptance fee receipts, JAMB letters, and medical clearance files.",
      content: `## 1. Physical Clearance Overview

Physical departmental clearance is the official process where your admission credentials and identity documents are physically verified by your Faculty Officer and Head of Department.

---

## 2. Mandatory Document Dossier (Originals + 4 Photocopies)

Prepare a clean document file folder containing the following:

1. **JAMB Admission Letter:** Official institution copy printed in color from JAMB CAPS.
2. **UI Acceptance Fee Receipt:** Original electronic payment receipt printed from the admissions portal.
3. **O'Level Result / Certificate:** WAEC, NECO, or NABTEB certificate (with scratch card for online PIN verification).
4. **Birth Certificate or Statutory Declaration of Age:** Issued by the National Population Commission (NPC) or a recognized High Court.
5. **Local Government / State of Origin Identification Certificate:** Signed by your LGA Chairman or Secretary.
6. **Letters of Reference / Attestation (2 copies):** Issued by a registered Clergy, Legal Practitioner, Civil Servant (GL 12+), or Secondary School Principal.
7. **Passport Photographs:** Eight (8) recent colored passport photos on a white or red background with your full name written on the back.
8. **UI Medical Certificate:** Issued by the Director of University Health Services (Jaja Clinic).

---

## 3. Jaja Clinic Health Centre Clearance Steps

All freshers must complete medical clearance before matriculation:

1. **Chest X-Ray:** Undertake chest radiography at the University Health Services diagnostic center.
2. **Laboratory Tests:** Blood group, genotype, urinalysis, and PCV assessment.
3. **Physical Examination:** Height, weight, blood pressure, visual acuity, and dental examination.
4. **Medical File Creation:** Submit test results to receive your stamped green medical registration card.

---

## 4. Clearance Day Advice

- Dress in modest formal/semi-formal attire.
- Arrange your documents in the exact sequence specified by your Faculty Notice Board.
- Never laminate original certificates before verification.`,
      category: "Clearance & Documents",
      status: "PUBLISHED",
      facultyId: null,
      source: "UI Admissions Office & Academic Secretariat",
      owner: "Academic Affairs Secretariat",
    },
    {
      id: "guide_scholarships",
      title: "Freshers Scholarships, Grants & Work-Study Opportunities Guide",
      summary: "Guide to applying for verified undergraduate scholarships, UI Work-Study scheme, state bursaries, and corporate foundation grants.",
      content: `## 1. Financial Opportunities for Freshers

Undergraduate education can be supported through numerous verified corporate merit scholarships, state government bursaries, and university employment programs.

---

## 2. Top Merit Scholarships Open to 100-Level

### 1. MTN Foundation Science & Technology Scholarship
- **Target:** 100L & 200L STEM students (Computing, Engineering, Science, Pure Maths).
- **Award:** **₦200,000 annually** until graduation.
- **Requirement:** Minimum CGPA of 3.50 (or top UTME score for freshers).

### 2. Agbami Medical & Engineering Professionals Scholarship
- **Target:** 100L Medicine, Dentistry, Pharmacy, Nursing, and Engineering students.
- **Award:** **₦100,000 – ₦200,000 yearly**.

### 3. NNPC / TotalEnergies National Merit Scholarship
- **Target:** All 100-Level undergraduates across Nigerian universities.
- **Award:** Merit-based annual stipend through university tenure.

### 4. Shell Petroleum Development Company (SPDC) JV Award
- **Target:** 100-Level students in accredited faculties.

---

## 3. University of Ibadan Work-Study Programme

The Student Affairs Division runs an internal Work-Study scheme designed to help students earn while studying:

- **Monthly Stipend:** Up to **₦35,000 per month**.
- **Maximum Hours:** 2 hours per day (10 hours weekly) to prevent interference with academic schedules.
- **Job Stations:** Kenneth Dike Library, Departmental computer rooms, UI Bookshop, Campus Sports Council, Botanical Gardens.
- **How to Apply:** Pick up an application form from the Student Affairs Division (Sub-Dean Office) in the 2nd semester.

---

## 4. Key Tips for Winning Scholarships

- Keep scanned copies of your JAMB result, admission letter, O'Level, and LGA certificate ready in PDF format (under 500KB).
- Open a dedicated email address for scholarship applications.
- Practice numerical reasoning and verbal aptitude questions regularly.`,
      category: "Scholarships & Grants",
      status: "PUBLISHED",
      facultyId: null,
      source: "UI Student Affairs Division & Financial Aid Committee",
      owner: "Student Affairs Division",
    },
    {
      id: "guide_add_drop",
      title: "UI Add and Drop Policy & Portal Change of Course Procedure",
      summary: "Official rules, portal deadlines, and procedure for adding or dropping 100-Level courses without academic penalty.",
      content: `## 1. What is the Add & Drop Exercise?

The Add and Drop window is a regulated period granted by the Senate (usually in Weeks 3 to 5 of the semester) during which students may adjust their course load by dropping registered courses or adding approved electives.

---

## 2. Strict Senate Credit Load Limits

Even when modifying courses during Add & Drop, your semester total MUST respect the Senate limits:

- **Minimum Allowed Units:** 15 Units per semester
- **Maximum Allowed Units:** 24 Units per semester

> [!WARNING]
> You cannot drop a course if doing so reduces your total registered units below 15. You cannot add a course if the addition causes your total to exceed 24 units without approved Senate waiver.

---

## 3. Step-by-Step Add & Drop Workflow

1. **Consult Course Adviser:** Discuss the reason for course change with your Level Adviser.
2. **Access Add/Drop Portal:** Log in to \`https://portal.ui.edu.ng\` $\\rightarrow$ "Course Registration" $\\rightarrow$ "Add/Drop Courses".
3. **Select Course Modifications:** Mark the courses you wish to drop or add.
4. **Submit for HOD Approval:** Click submit. Your Head of Department and Faculty Sub-Dean will review and electronically approve the changes.
5. **Print Revised Form 01:** Once approved, reprint your modified Form 01 and have it re-endorsed.

---

## 4. The Critical Danger of Unofficial Drops

**Never simply stop attending a registered course without formally dropping it on the portal.** If a course remains on your portal record at the end of the semester, you will be assigned a score of **0% (F Grade / Absent)**, which directly diminishes your CGPA.`,
      category: "Academic Policies",
      status: "PUBLISHED",
      facultyId: null,
      source: "UI Senate Secretariat & Examination Office",
      owner: "UI Academic Senate",
    },
    {
      id: "guide_library",
      title: "Kenneth Dike Library (KDL) Orientation & Digital Access Guide",
      summary: "How to register your KDL library card, access physical books, use digital databases (JSTOR, ScienceDirect), and quiet study carrels.",
      content: `## 1. Welcome to Kenneth Dike Library

Kenneth Dike Library (KDL) is the premier academic research library of the University of Ibadan, housing over 1.5 million volumes, specialized reference collections, Africana archives, and 24/7 digital resource subscriptions.

---

## 2. Library Registration for 100-Level Freshers

To register and activate your borrowing privileges:

1. Visit the **Readers' Services Desk** on the Ground Floor of KDL.
2. Present your UI Student ID Card (or stamped Acceptance Fee Receipt & Course Registration Form).
3. Complete the digital library registration form to receive your **KDL Barcode Card**.

---

## 3. Borrowing Rules & Quotas

- **Undergraduate Quota:** Maximum of **2 books for a period of 14 days**.
- **Renewals:** Eligible for 1 renewal if no other user has placed a hold reservation.
- **Overdue Fines:** Standard overdue fees apply per day per late book.

---

## 4. Accessing Online e-Resources from Anywhere

UI subscribes to top global academic repositories. Freshers can access these for research and assignments:

- **Databases:** ScienceDirect, IEEE Xplore, JSTOR, SpringerLink, PubMed, AGORA, and HINARI.
- **Access Method:** Connect to the UI Campus WiFi (\`UI-Students\`) or log in via **OpenAthens** using your student email credentials.
- **Research Commons:** Dedicated air-conditioned hall with high-speed internet and computer terminals on the 1st Floor.`,
      category: "Library & Research",
      status: "PUBLISHED",
      facultyId: null,
      source: "University of Ibadan Library System",
      owner: "Kenneth Dike Library",
    },
    {
      id: "guide_exam_rules",
      title: "UI Senate Examination Rules, Regulations & Malpractice Penalties",
      summary: "Senate rules governing semester examinations, continuous assessments, 75% attendance rule, and examination conduct.",
      content: `## 1. Examination Eligibility & The 75% Attendance Rule

Under UI Senate regulations, no undergraduate student is eligible to write the end-of-semester examination in any course unless they have attained a minimum of **75% lecture and practical attendance**.

---

## 2. Mandatory Items for Examination Hall Entry

- **Signed Examination Docket:** Downloaded from the student portal and signed by your Faculty Officer.
- **Valid University ID Card:** Or official temporary identification letter.
- **Approved Writing Materials:** Pens, pencils, rulers, and non-programmable calculators (where explicitly authorized).

---

## 3. Strictly Prohibited Items in Examination Halls

The following items are strictly contraband inside exam halls and holding areas:

- Mobile phones, smartwatches, fitness trackers, and programmable gadgets (even if switched off).
- Prepared notes, scrap paper, or cheat sheets.
- Bringing bags, unauthorized mathematical tables, or course texts.

---

## 4. Senate Sanctions for Examination Misconduct

The Student Disciplinary Committee (SDC) enforces strict zero-tolerance policies:

- **Possession of Contraband / Notes:** 2 to 4 semesters suspension (rustication).
- **Impersonation (Writing for another student):** Immediate expulsion from the University for both the impersonator and the candidate.
- **Disturbance / Refusal to Obey Invigilators:** Cancellation of examination results and formal disciplinary hearing.

> [!IMPORTANT]
> Always check your assigned seating arrangement on your Departmental Notice Board at least 24 hours before each scheduled paper.`,
      category: "Exams & Rules",
      status: "PUBLISHED",
      facultyId: null,
      source: "UI Senate Examination Regulations & Disciplinary Code",
      owner: "UI Central Examination Committee",
    },
  ];

  for (const g of allGuides) {
    await prisma.guide.upsert({
      where: { id: g.id },
      update: {
        title: g.title,
        summary: g.summary,
        content: g.content,
        category: g.category,
        status: g.status,
        facultyId: g.facultyId,
        source: g.source,
        owner: g.owner,
      },
      create: {
        id: g.id,
        title: g.title,
        summary: g.summary,
        content: g.content,
        category: g.category,
        status: g.status,
        facultyId: g.facultyId,
        source: g.source,
        owner: g.owner,
      },
    });
  }

  console.log(`✅ ${allGuides.length} In-App Academic & Clearance Guides seeded.`);
  console.log("✅ Reference Rules & Telegram Bot record seeded.");
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