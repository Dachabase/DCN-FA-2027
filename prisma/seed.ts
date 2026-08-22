import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

const connectionString = process.env.DATABASE_URL || "postgresql://postgres:Wackywas1@fa27.ct2ua4mes3jl.eu-north-1.rds.amazonaws.com:5432/ui_freshers?schema=public";
const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

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

async function getOrCreateBot(telegramBotId: bigint, username: string, name: string, facultyId: string) {
  let bot = await prisma.bot.findFirst({ where: { telegramBotId } });
  if (!bot) {
    bot = await prisma.bot.create({
      data: { telegramBotId, username, name, facultyId },
    });
  }
  return bot;
}

async function main() {
  console.log("🌱 Starting UI Freshers Companion database seed...");

  // Grant schema privileges if needed
  try {
    await prisma.$executeRawUnsafe(`GRANT ALL ON SCHEMA public TO postgres;`);
  } catch (e) {
    // ignore
  }

  // 1. SEED FACULTIES
  const computing = await getOrCreateFaculty("Computing", "COMPUTING");
  const science = await getOrCreateFaculty("Science", "SCIENCE");
  const technology = await getOrCreateFaculty("Technology", "TECH");
  const clinical = await getOrCreateFaculty("Clinical Sciences", "MEDICINE");
  const arts = await getOrCreateFaculty("Arts", "ARTS");

  console.log("✅ Faculties seeded.");

  // 2. SEED DEPARTMENTS
  const computingDepts = ["Computer Science and AI", "Cybersecurity", "Information Technology", "Software Engineering"];
  for (const name of computingDepts) {
    await getOrCreateDepartment(computing.id, name);
  }

  const scienceDepts = ["Computer Science", "Mathematics", "Statistics", "Physics", "Chemistry"];
  for (const name of scienceDepts) {
    await getOrCreateDepartment(science.id, name);
  }

  const techDepts = ["Electrical & Electronic Engineering", "Mechanical Engineering", "Civil Engineering"];
  for (const name of techDepts) {
    await getOrCreateDepartment(technology.id, name);
  }

  console.log("✅ Departments seeded.");

  // 3. SEED BOTS FOR TELEGRAM HANDOFF
  await getOrCreateBot(BigInt(789012345), "UI_Computing_Bot", "UI Computing Freshers AI Assistant", computing.id);
  await getOrCreateBot(BigInt(789012346), "UI_Science_Bot", "UI Science Freshers AI Mentor", science.id);

  console.log("✅ Telegram Bots seeded.");

  // 4. SEED FACULTY GUIDES
  const csDept = await prisma.department.findFirst({ where: { facultyId: computing.id, name: "Computer Science and AI" } });

  const existingGuides = await prisma.guide.count();
  if (existingGuides === 0) {
    const guidesData = [
      {
        title: "100L Course Registration & Subject Combination Guide",
        summary: "Step-by-step walkthrough for registering 100L compulsory and elective courses at UI.",
        content: `## Welcome to UI Course Registration\nEvery 100 Level student in the Faculty of Computing must register for compulsory general courses (GST101, GST102, GES107) alongside departmental core courses.\n\n### Core 100L Computing Courses:\n- **CSC101**: Introduction to Computer Science (3 Units)\n- **CSC102**: Introduction to Problem Solving & Programming (3 Units)\n- **MAT111**: Algebra & Trigonometry (3 Units)\n- **MAT121**: Calculus I (3 Units)\n- **PHY101**: General Physics I (3 Units)\n\n### Key Rules:\n1. Maximum credit load per semester is **24 units**, minimum is **15 units**.\n2. Course registration must be validated by your Departmental Course Adviser before portal closure.\n3. Make sure to print 4 copies of your Form 01 for clearance.`,
        category: "Course Registration",
        facultyId: computing.id,
        departmentId: csDept?.id,
        source: "University of Ibadan Academic Affairs Secretariat",
        owner: "Office of the Dean, Faculty of Computing",
        verifiedDate: new Date("2026-01-15"),
      },
      {
        title: "Understanding the UI 4.0 CGPA Grading System",
        summary: "Comprehensive guide to grade points, semester GPA calculation, and probation limits.",
        content: `## UI Grading System (4.0 Scale)\nThe Senate of the University of Ibadan operates a 4.0 Cumulative Grade Point Average (CGPA) system.\n\n| Score Range | Letter Grade | Grade Point (GP) |\n|-------------|--------------|------------------|\n| 70% – 100%  | A            | 4.0              |\n| 60% – 69%   | B            | 3.0              |\n| 50% – 59%   | C            | 2.0              |\n| 45% – 49%   | D            | 1.0              |\n| 0% – 44%    | F            | 0.0              |\n\n### Good Standing & Probation:\n- **Good Standing**: CGPA of **1.50** and above.\n- **Academic Probation**: CGPA between **1.00 and 1.49** at the end of a session.\n- **Withdrawal**: CGPA below **1.00** at the end of 100 Level session results in advice to withdraw.`,
        category: "Grading System",
        facultyId: computing.id,
        source: "UI Student Information Handbook (2025/2026 Edition)",
        owner: "UI Academic Senate",
        verifiedDate: new Date("2026-01-20"),
      },
      {
        title: "Lecture Venues & Campus Navigation Map",
        summary: "Locate Large Lecture Theatres (LLT), ICT Center, Science Lecture Theater, and Faculty labs.",
        content: `## Key Lecture Venues for Computing Freshers\n- **Large Lecture Theatre (LLT)**: Located adjacent to Faculty of Science. Venue for GST & MAT lectures.\n- **Faculty of Computing Computer Lab 1 & 2**: Ground floor, New Computing Building.\n- **SUB Pit Theatre**: Student Union Building grounds for faculty orientation programs.\n- **Kenneth Dike Library (KDL) E-Classroom**: Second Floor, KDL main building.`,
        category: "Lecture Venues",
        facultyId: computing.id,
        source: "UI Student Union Physical Planning Committee",
        owner: "Directorate of Physical Planning",
        verifiedDate: new Date("2026-02-01"),
      },
    ];

    for (const guide of guidesData) {
      await prisma.guide.create({ data: guide });
    }
  }

  console.log("✅ Faculty Guides seeded.");

  // 5. SEED RESOURCES
  const existingResources = await prisma.resource.count();
  if (existingResources === 0) {
    const resourcesData = [
      {
        title: "UI Official Academic Calendar (2025/2026 Academic Session)",
        description: "Official timeline covering matriculation, lecture weeks, mid-semester breaks, exams, and holidays.",
        url: "https://ui.edu.ng/academic-calendar",
        type: "pdf",
        category: "Academic",
        tags: ["Calendar", "Important Dates", "Exams"],
        facultyId: computing.id,
        source: "UI Senate Secretariat",
        owner: "Academic Planning Office",
        verifiedDate: new Date("2026-01-05"),
      },
      {
        title: "CSC101: Introduction to Computer Science Lecture Slides",
        description: "Complete course deck covering binary arithmetic, logic gates, computer architecture, and algorithms.",
        url: "https://computing.ui.edu.ng/resources/csc101-slides.pdf",
        type: "lecture_notes",
        category: "Academic",
        tags: ["CSC101", "100L", "Lecture Notes"],
        facultyId: computing.id,
        departmentId: csDept?.id,
        source: "Department of Computer Science & AI",
        owner: "CSC101 Course Coordinator",
        verifiedDate: new Date("2026-02-10"),
      },
      {
        title: "Kenneth Dike Library (KDL) Digital Catalog & E-Journals",
        description: "Access thousands of subscribed IEEE, ScienceDirect, and ACM e-books using your UI student login.",
        url: "https://library.ui.edu.ng",
        type: "link",
        category: "Library",
        tags: ["Library", "KDL", "Research"],
        facultyId: null,
        source: "Kenneth Dike Library Board",
        owner: "University Librarian",
        verifiedDate: new Date("2026-01-18"),
      },
    ];

    for (const res of resourcesData) {
      await prisma.resource.create({ data: res });
    }
  }

  console.log("✅ Resources seeded.");

  // 6. SEED OPPORTUNITIES
  const existingOpps = await prisma.opportunity.count();
  if (existingOpps === 0) {
    const opportunitiesData = [
      {
        title: "MTN Foundation Science & Technology Scholarship 2026",
        description: "Annual ₦200,000 grant awarded to 200L+ high-performing students studying STEM courses in Nigerian public universities.",
        organization: "MTN Nigeria Foundation",
        url: "https://www.mtn.ng/scholarships/",
        deadline: new Date("2026-05-30"),
        type: "Scholarship",
        category: "Financial Aid",
        tags: ["MTN", "Scholarship", "STEM"],
        facultyId: computing.id,
        source: "MTN Foundation Official Portal",
        owner: "UI Financial Aid & Scholarship Desk",
        verifiedDate: new Date("2026-02-01"),
      },
      {
        title: "Google Developer Student Clubs (GDSC) UI Chapter Member Recruitment",
        description: "Join UI's premier tech community. Gain hands-on practice in Web Development, Mobile Dev, AI/ML, and Cloud Computing.",
        organization: "GDSC University of Ibadan",
        url: "https://gdsc.community.dev/university-of-ibadan/",
        deadline: new Date("2026-03-15"),
        type: "Mentorship",
        category: "Tech Community",
        tags: ["GDSC", "Coding", "Community"],
        facultyId: computing.id,
        source: "GDSC UI Executive Council",
        owner: "GDSC Lead",
        verifiedDate: new Date("2026-02-14"),
      },
      {
        title: "University of Ibadan Student Work-Study Program",
        description: "Earn up to ₦35,000 monthly working flexible hours (max 2 hours daily) in university libraries, ICT centers, or administrative offices.",
        organization: "UI Student Affairs Division",
        url: "https://ui.edu.ng/work-study",
        deadline: new Date("2026-04-10"),
        type: "Work-Study",
        category: "Campus Employment",
        tags: ["Work Study", "Jobs", "Campus"],
        facultyId: null,
        source: "UI Dean of Student Affairs Office",
        owner: "Work-Study Scheme Committee",
        verifiedDate: new Date("2026-01-25"),
      },
    ];

    for (const opp of opportunitiesData) {
      await prisma.opportunity.create({ data: opp });
    }
  }

  console.log("✅ Opportunities seeded.");

  // 7. SEED FAQS
  const existingFaqs = await prisma.faq.count();
  if (existingFaqs === 0) {
    const faqsData = [
      {
        question: "How do I complete my physical departmental clearance at UI?",
        answer: "Physical clearance requires your JAMB Admission Letter, UI Acceptance Fee Receipt, O'Level Certificate/Statement of Result, Birth Certificate, and 4 passport photographs. Visit the Faculty Secretariat with original documents and photocopies.",
        category: "Admissions & Clearance",
        tags: ["Clearance", "Freshers", "Documents"],
        source: "UI Admissions Officer Desk",
        owner: "Academic Affairs Officer",
        verifiedDate: new Date("2026-01-10"),
      },
      {
        question: "What is the deadline for course add/drop for the current semester?",
        answer: "Course add/drop closes exactly 4 weeks after lecture commencement. You can modify registered courses via the student portal before your departmental adviser signs your final course form.",
        category: "Course Add/Drop",
        tags: ["Courses", "Portal", "Deadline"],
        source: "UI Portal Administrator",
        owner: "ICT Infrastructure Unit",
        verifiedDate: new Date("2026-01-15"),
      },
      {
        question: "How is hostel accommodation allocated for 100 Level freshers?",
        answer: "Hostel space is reserved for 100L freshers and final year students. Once your school fees payment reflects on the portal, log into the portal under 'Hostel Reservation' on designated release dates.",
        category: "Hostel & Housing",
        tags: ["Hostel", "Accommodation"],
        source: "UI Student Affairs Division (Hall Management)",
        owner: "Dean of Student Affairs",
        verifiedDate: new Date("2026-01-08"),
      },
    ];

    for (const faq of faqsData) {
      await prisma.faq.create({ data: faq });
    }
  }

  console.log("✅ FAQs seeded.");
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