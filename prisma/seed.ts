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