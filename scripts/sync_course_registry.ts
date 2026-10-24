import "dotenv/config";
import { prisma } from "../src/database/prisma";
import fs from "fs";

interface InventoryItem {
  id: string;
  filename: string;
  rel_path: string;
  faculty_dir: string;
  ext: string;
  size: number;
  hash: string;
  page_count: number;
  is_scanned: boolean;
  char_count: number;
  course_code: string | null;
  course_title: string;
  category: string;
  semester: string;
  units: number;
  exam_year?: number | null;
  has_questions?: boolean;
}

const FACULTY_MAP: Record<string, string> = {
  "Faculty of Art": "ARTS",
  "Faculty of Law": "LAW",
  "Faculty of computing": "COMPUTING",
  "Faculty of economics": "ECON_MGMT",
  "Faculty of renewable natural resources": "NAT_RES",
  "Faculty of science and technology": "SCIENCE",
  "Faculty of social sciences": "SOCIAL_SCI",
  "Faculty of vet medicine": "VET_MED",
};

const UI_COURSE_SPECS: Record<string, { title: string; facultyCode: string; semester: string; units: number; isUniversityWide?: boolean }> = {
  "COS 101": { title: "Introduction to Computer Science & Computing", facultyCode: "COMPUTING", semester: "1st", units: 3 },
  "COS 102": { title: "Problem Solving & Programming in Python", facultyCode: "COMPUTING", semester: "2nd", units: 3 },
  "COS 103": { title: "Computer Hardware & Logic Systems", facultyCode: "COMPUTING", semester: "1st", units: 2 },
  "CSC 101": { title: "Introduction to Computer Science", facultyCode: "COMPUTING", semester: "1st", units: 3 },
  "CSC 102": { title: "Basic Computer Programming", facultyCode: "COMPUTING", semester: "2nd", units: 3 },
  "MTH 101": { title: "Elementary Mathematics I (Algebra & Trigonometry)", facultyCode: "SCIENCE", semester: "1st", units: 3 },
  "MTH 102": { title: "Elementary Mathematics II (Calculus)", facultyCode: "SCIENCE", semester: "2nd", units: 3 },
  "MTH 103": { title: "Elementary Mathematics III (Vectors, Geometry & Dynamics)", facultyCode: "SCIENCE", semester: "1st", units: 3 },
  "MAT 111": { title: "Algebra & Trigonometry (Special)", facultyCode: "SCIENCE", semester: "1st", units: 3 },
  "MAT 141": { title: "Introductory Coordinate Geometry", facultyCode: "SCIENCE", semester: "1st", units: 3 },
  "PHY 101": { title: "General Physics I (Mechanics & Thermal Physics)", facultyCode: "SCIENCE", semester: "1st", units: 3 },
  "PHY 102": { title: "General Physics II (Electricity & Magnetism)", facultyCode: "SCIENCE", semester: "2nd", units: 3 },
  "PHY 103": { title: "General Physics III (Waves, Optics & Modern Physics)", facultyCode: "SCIENCE", semester: "1st", units: 2 },
  "PHY 104": { title: "Practical Physics Laboratory I", facultyCode: "SCIENCE", semester: "1st", units: 1 },
  "PHY 105": { title: "Practical Physics Laboratory II", facultyCode: "SCIENCE", semester: "2nd", units: 1 },
  "CHM 101": { title: "General Physical Chemistry", facultyCode: "SCIENCE", semester: "1st", units: 3 },
  "CHM 102": { title: "General Inorganic & Organic Chemistry", facultyCode: "SCIENCE", semester: "2nd", units: 3 },
  "CHM 107": { title: "General Practical Chemistry I", facultyCode: "SCIENCE", semester: "1st", units: 1 },
  "CHM 108": { title: "General Practical Chemistry II", facultyCode: "SCIENCE", semester: "2nd", units: 1 },
  "CHE 156": { title: "Introductory Chemical Thermodynamics", facultyCode: "SCIENCE", semester: "1st", units: 2 },
  "CHE 176": { title: "Introductory Chemical Kinetics", facultyCode: "SCIENCE", semester: "2nd", units: 2 },
  "BIO 101": { title: "Cell Biology & Genetics", facultyCode: "SCIENCE", semester: "1st", units: 3 },
  "BIO 102": { title: "Organismal Biology (Botany & Zoology)", facultyCode: "SCIENCE", semester: "2nd", units: 3 },
  "BIO 104": { title: "General Biology Practical Laboratory", facultyCode: "SCIENCE", semester: "2nd", units: 1 },
  "BIO 107": { title: "Practical Biology I", facultyCode: "SCIENCE", semester: "1st", units: 1 },
  "BIO 108": { title: "Practical Biology II", facultyCode: "SCIENCE", semester: "2nd", units: 1 },
  "BOT 101": { title: "Introductory Botany", facultyCode: "SCIENCE", semester: "1st", units: 3 },
  "BOT 141": { title: "Basic Principles of Botany (Ecology)", facultyCode: "SCIENCE", semester: "1st", units: 3 },
  "ZOO 101": { title: "Introductory Zoology", facultyCode: "SCIENCE", semester: "1st", units: 3 },
  "ZOO 102": { title: "Animal Ecology and Adaptation", facultyCode: "SCIENCE", semester: "2nd", units: 3 },
  "ZOO 114": { title: "Basic Zoology & Functional Morphology", facultyCode: "SCIENCE", semester: "1st", units: 2 },
  "STA 111": { title: "Probability & Statistics I", facultyCode: "SCIENCE", semester: "1st", units: 3 },
  "STA 112": { title: "Probability & Statistics II", facultyCode: "SCIENCE", semester: "2nd", units: 3 },
  "STA 114": { title: "General Statistics & Data Sources", facultyCode: "SCIENCE", semester: "1st", units: 2 },
  "STA 115": { title: "Introductory Applied Statistics", facultyCode: "SCIENCE", semester: "1st", units: 3 },
  "STA 121": { title: "Mathematics for Statistics", facultyCode: "SCIENCE", semester: "1st", units: 2 },
  "GST 111": { title: "Communication in English I", facultyCode: "ARTS", semester: "1st", units: 2, isUniversityWide: true },
  "GST 112": { title: "Nigerian Peoples and Culture", facultyCode: "ARTS", semester: "2nd", units: 2, isUniversityWide: true },
  "GES 101": { title: "Use of English & Communication Skills", facultyCode: "ARTS", semester: "1st", units: 3, isUniversityWide: true },
  "GES 107": { title: "Reproductive Health, STIs and Human Rights", facultyCode: "ARTS", semester: "1st", units: 2, isUniversityWide: true },
  "GES 108": { title: "Introduction to French", facultyCode: "ARTS", semester: "2nd", units: 2, isUniversityWide: true },
  "ECO 101": { title: "Principles of Economics I (Microeconomics)", facultyCode: "ECON_MGMT", semester: "1st", units: 3 },
  "ECO 102": { title: "Principles of Economics II (Macroeconomics)", facultyCode: "ECON_MGMT", semester: "2nd", units: 3 },
  "ECO 103": { title: "Introductory Mathematics for Economists", facultyCode: "ECON_MGMT", semester: "1st", units: 3 },
  "ECO 104": { title: "Introductory Statistics for Economists", facultyCode: "ECON_MGMT", semester: "2nd", units: 3 },
  "ACC 101": { title: "Introduction to Financial Accounting I", facultyCode: "ECON_MGMT", semester: "1st", units: 3 },
  "ACC 102": { title: "Introduction to Financial Accounting II", facultyCode: "ECON_MGMT", semester: "2nd", units: 3 },
  "BAF 103": { title: "Introduction to Finance & Banking", facultyCode: "ECON_MGMT", semester: "1st", units: 3 },
  "AMS 101": { title: "Principles of Management", facultyCode: "ECON_MGMT", semester: "1st", units: 3 },
  "AMS 102": { title: "Basic Mathematics for Management", facultyCode: "ECON_MGMT", semester: "1st", units: 3 },
  "AMS 103": { title: "Introduction to Computing Science", facultyCode: "ECON_MGMT", semester: "1st", units: 3 },
  "SOC 101": { title: "Introduction to Sociology I", facultyCode: "SOCIAL_SCI", semester: "1st", units: 3 },
  "SOC 102": { title: "Introduction to Sociology II", facultyCode: "SOCIAL_SCI", semester: "2nd", units: 3 },
  "SOC 105": { title: "Elements of Social Structure & Organization", facultyCode: "SOCIAL_SCI", semester: "1st", units: 3 },
  "PSY 101": { title: "Introduction to Psychology I", facultyCode: "SOCIAL_SCI", semester: "1st", units: 3 },
  "PSY 104": { title: "Basic Concepts in Psychology", facultyCode: "SOCIAL_SCI", semester: "2nd", units: 3 },
  "POS 101": { title: "Introduction to Political Science", facultyCode: "SOCIAL_SCI", semester: "1st", units: 3 },
  "POS 103": { title: "The Organization of Government", facultyCode: "SOCIAL_SCI", semester: "1st", units: 3 },
  "POS 106": { title: "Nigerian Constitutional Development", facultyCode: "SOCIAL_SCI", semester: "2nd", units: 3 },
  "GEO 101": { title: "Introduction to Physical Geography", facultyCode: "SOCIAL_SCI", semester: "1st", units: 3 },
  "GEO 102": { title: "Introduction to Human Geography", facultyCode: "SOCIAL_SCI", semester: "2nd", units: 3 },
  "PUL 101": { title: "Introduction to Legal Method I", facultyCode: "LAW", semester: "1st", units: 3 },
  "PUL 102": { title: "Introduction to Legal Method II", facultyCode: "LAW", semester: "2nd", units: 3 },
  "LAW 102": { title: "Legal Logic & Reasoning", facultyCode: "LAW", semester: "2nd", units: 2 },
  "CLL 103": { title: "Latin for Lawyers", facultyCode: "LAW", semester: "1st", units: 2 },
  "VMD 101": { title: "Introductory Veterinary Medicine", facultyCode: "VET_MED", semester: "1st", units: 2 },
  "VAN 101": { title: "Veterinary Anatomy I", facultyCode: "VET_MED", semester: "1st", units: 3 },
  "AGR 101": { title: "Introductory Agriculture", facultyCode: "AGRIC", semester: "1st", units: 2 },
  "AGG 102": { title: "Basic Agricultural Concepts", facultyCode: "AGRIC", semester: "2nd", units: 2 },
  "CPE 110": { title: "Introduction to Agricultural Technology", facultyCode: "AGRIC", semester: "1st", units: 2 },
  "CPE 111": { title: "Farm Machinery & Mechanization", facultyCode: "AGRIC", semester: "1st", units: 2 },
  "GET 102": { title: "Applied Mechanics", facultyCode: "TECH", semester: "2nd", units: 3 },
  "GET 103": { title: "Engineering Graphics", facultyCode: "TECH", semester: "1st", units: 2 },
  "RNR 101": { title: "Introduction to Renewable Natural Resources", facultyCode: "NAT_RES", semester: "1st", units: 2 },
  "FRM 101": { title: "Forest Resources Management", facultyCode: "NAT_RES", semester: "1st", units: 2 },
  "WLM 101": { title: "Wildlife Management & Ecology", facultyCode: "NAT_RES", semester: "1st", units: 2 },
  "AQF 101": { title: "Introductory Aquaculture & Fisheries", facultyCode: "NAT_RES", semester: "1st", units: 2 },
  "CLA 101": { title: "Introduction to Communication Studies", facultyCode: "ARTS", semester: "1st", units: 3 },
  "LIN 105": { title: "Languages of the World", facultyCode: "ARTS", semester: "1st", units: 3 },
  "PHL 101": { title: "Introduction to Philosophy", facultyCode: "ARTS", semester: "1st", units: 3 },
  "PHL 102": { title: "Arguments and Critical Thinking", facultyCode: "ARTS", semester: "2nd", units: 3 },
};

async function syncCourseRegistry() {
  console.log("Starting Course Registry Synchronization...");

  // Load existing faculties
  const faculties = await prisma.faculty.findMany();
  const facByCode = new Map(faculties.map(f => [f.code, f]));

  // Load existing courses
  const existingCourses = await prisma.course.findMany();
  const courseByCode = new Map(existingCourses.map(c => [c.code.toUpperCase().trim(), c]));

  let createdCount = 0;
  let updatedCount = 0;

  for (const [code, spec] of Object.entries(UI_COURSE_SPECS)) {
    const faculty = facByCode.get(spec.facultyCode);
    const facultyId = faculty ? faculty.id : null;

    // Check if course exists directly or with C- prefix
    let existing = courseByCode.get(code) || courseByCode.get(`C-${code}`);

    if (existing) {
      // Update with verified title, faculty, semester, units
      await prisma.course.update({
        where: { id: existing.id },
        data: {
          title: existing.title || spec.title,
          semester: spec.semester,
          units: spec.units,
          facultyId: facultyId || existing.facultyId,
          isUniversityWide: spec.isUniversityWide || existing.isUniversityWide || false,
          level: 100,
        },
      });
      updatedCount++;
    } else {
      // Create new verified course
      await prisma.course.create({
        data: {
          code: code,
          title: spec.title,
          level: 100,
          semester: spec.semester,
          status: "COMPULSORY",
          units: spec.units,
          isUniversityWide: spec.isUniversityWide || false,
          facultyId: facultyId,
        },
      });
      createdCount++;
    }
  }

  const totalCourses = await prisma.course.count();
  console.log(`Course registry sync complete!`);
  console.log(`- Created: ${createdCount} courses`);
  console.log(`- Updated: ${updatedCount} courses`);
  console.log(`- Total courses in DB: ${totalCourses}`);
}

syncCourseRegistry()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
