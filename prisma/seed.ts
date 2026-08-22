import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

const connectionString = process.env.DATABASE_URL || "postgresql://postgres:postgres@localhost:5432/ui_freshers?schema=public";
const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("🌱 Starting UI Freshers Companion database seed...");

  // =========================================================
  // 1. SEED FACULTIES
  // =========================================================
  const computing = await prisma.faculty.upsert({
    where: { name: "Computing" },
    update: { code: "COMPUTING" },
    create: { name: "Computing", code: "COMPUTING" },
  });

  const science = await prisma.faculty.upsert({
    where: { name: "Science" },
    update: { code: "SCIENCE" },
    create: { name: "Science", code: "SCIENCE" },
  });

  const technology = await prisma.faculty.upsert({
    where: { name: "Technology" },
    update: { code: "TECH" },
    create: { name: "Technology", code: "TECH" },
  });

  const clinical = await prisma.faculty.upsert({
    where: { name: "Clinical Sciences" },
    update: { code: "MEDICINE" },
    create: { name: "Clinical Sciences", code: "MEDICINE" },
  });

  const arts = await prisma.faculty.upsert({
    where: { name: "Arts" },
    update: { code: "ARTS" },
    create: { name: "Arts", code: "ARTS" },
  });

  console.log("✅ Faculties seeded.");

  // =========================================================
  // 2. SEED DEPARTMENTS
  // =========================================================
  const computingDepts = [
    "Computer Science and AI",
    "Cybersecurity",
    "Information Technology",
    "Software Engineering",
  ];

  for (const name of computingDepts) {
    await prisma.department.upsert({
      where: { facultyId_name: { facultyId: computing.id, name } },
      update: {},
      create: { name, facultyId: computing.id },
    });
  }

  const scienceDepts = ["Computer Science", "Mathematics", "Statistics", "Physics", "Chemistry"];
  for (const name of scienceDepts) {
    await prisma.department.upsert({
      where: { facultyId_name: { facultyId: science.id, name } },
      update: {},
      create: { name, facultyId: science.id },
    });
  }

  const techDepts = ["Electrical & Electronic Engineering", "Mechanical Engineering", "Civil Engineering"];
  for (const name of techDepts) {
    await prisma.department.upsert({
      where: { facultyId_name: { facultyId: technology.id, name } },
      update: {},
      create: { name, facultyId: technology.id },
    });
  }

  console.log("✅ Departments seeded.");

  // =========================================================
  // 3. SEED BOTS FOR TELEGRAM HANDOFF
  // =========================================================
  await prisma.bot.upsert({
    where: { telegramBotId: BigInt(789012345) },
    update: {
      username: "UI_Computing_Bot",
      name: "UI Computing Freshers AI Assistant",
      facultyId: computing.id,
    },
    create: {
      telegramBotId: BigInt(789012345),
      username: "UI_Computing_Bot",
      name: "UI Computing Freshers AI Assistant",
      facultyId: computing.id,
    },
  });

  await prisma.bot.upsert({
    where: { telegramBotId: BigInt(789012346) },
    update: {
      username: "UI_Science_Bot",
      name: "UI Science Freshers AI Mentor",
      facultyId: science.id,
    },
    create: {
      telegramBotId: BigInt(789012346),
      username: "UI_Science_Bot",
      name: "UI Science Freshers AI Mentor",
      facultyId: science.id,
    },
  });

  console.log("✅ Telegram Bots seeded.");

  // =========================================================
  // 4. SEED FACULTY GUIDES
  // =========================================================
  const csDept = await prisma.department.findFirst({
    where: { facultyId: computing.id, name: "Computer Science and AI" },
  });

  const guidesData = [
    {
      title: "100L Course Registration & Subject Combination Guide",
      summary: "Step-by-step walkthrough for registering 100L compulsory and elective courses at UI.",
      content: `## Welcome to UI Course Registration
Every 100 Level student in the Faculty of Computing must register for compulsory general courses (GST101, GST102, GES107) alongside departmental core courses.

### Core 100L Computing Courses:
- **CSC101**: Introduction to Computer Science (3 Units)
- **CSC102**: Introduction to Problem Solving & Programming (3 Units)
- **MAT111**: Algebra & Trigonometry (3 Units)
- **MAT121**: Calculus I (3 Units)
- **PHY101**: General Physics I (3 Units)

### Key Rules:
1. Maximum credit load per semester is **24 units**, minimum is **15 units**.
2. Course registration must be validated by your Departmental Course Adviser before portal closure.
3. Make sure to print 4 copies of your Form 01 for clearance.`,
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
      content: `## UI Grading System (4.0 Scale)
The Senate of the University of Ibadan operates a 4.0 Cumulative Grade Point Average (CGPA) system.

| Score Range | Letter Grade | Grade Point (GP) |
|-------------|--------------|------------------|
| 70% – 100%  | A            | 4.0              |
| 60% – 69%   | B            | 3.0              |
| 50% – 59%   | C            | 2.0              |
| 45% – 49%   | D            | 1.0              |
| 0% – 44%    | F            | 0.0              |

### Good Standing & Probation:
- **Good Standing**: CGPA of **1.50** and above.
- **Academic Probation**: CGPA between **1.00 and 1.49** at the end of a session.
- **Withdrawal**: CGPA below **1.00** at the end of 100 Level session results in advice to withdraw.`,
      category: "Grading System",
      facultyId: computing.id,
      source: "UI Student Information Handbook (2025/2026 Edition)",
      owner: "UI Academic Senate",
      verifiedDate: new Date("2026-01-20"),
    },
    {
      title: "Lecture Venues & Campus Navigation Map",
      summary: "Locate Large Lecture Theatres (LLT), ICT Center, Science Lecture Theater, and Faculty labs.",
      content: `## Key Lecture Venues for Computing Freshers
- **Large Lecture Theatre (LLT)**: Located adjacent to Faculty of Science. Venue for GST & MAT lectures.
- **Faculty of Computing Computer Lab 1 & 2**: Ground floor, New Computing Building.
- **SUB Pit Theatre**: Student Union Building grounds for faculty orientation programs.
- **Kenneth Dike Library (KDL) E-Classroom**: Second Floor, KDL main building.`,
      category: "Lecture Venues",
      facultyId: computing.id,
      source: "UI Student Union Physical Planning Committee",
      owner: "Directorate of Physical Planning",
      verifiedDate: new Date("2026-02-01"),
    },
    {
      title: "UI Examination Rules & Student Code of Conduct",
      summary: "Official exam regulation, docket requirements, lateness policies, and discipline guidelines.",
      content: `## Examination Rules Every Fresher Must Know
1. **Exam Docket**: You MUST present an authenticated printed Examination Docket with your photo.
2. **Timing**: Candidates will not be admitted into the hall more than **30 minutes** after exam start time.
3. **Prohibited Items**: Smartwatches, programmable devices, and unapproved papers are strictly banned.
4. **ID Card**: Bring your temporary or permanent UI Student Identity Card to every examination paper.`,
      category: "Exams & Rules",
      facultyId: computing.id,
      source: "UI Examinations & Records Office",
      owner: "University Registrar",
      verifiedDate: new Date("2026-01-10"),
    },
  ];

  for (const guide of guidesData) {
    await prisma.guide.create({ data: guide });
  }

  console.log("✅ Faculty Guides seeded.");

  // =========================================================
  // 5. SEED RESOURCES
  // =========================================================
  const resourcesData = [
    {
      title: "UI Official Academic Calendar (2025/2026 Academic Session)",
      description: "Official timeline covering matriculation, lecture weeks, mid-semester breaks, exams, and holidays.",
      url: "https://ui.edu.ng/academic-calendar",
      type: "pdf",
      category: "Academic",
      tags: ["Calendar", "Important Dates", "Matriculation", "Exams"],
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
      tags: ["CSC101", "100L", "Lecture Notes", "Computer Science"],
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
      tags: ["Library", "KDL", "Research", "E-Books"],
      facultyId: null,
      source: "Kenneth Dike Library Board",
      owner: "University Librarian",
      verifiedDate: new Date("2026-01-18"),
    },
    {
      title: "Faculty of Computing Freshers Handbook (PDF)",
      description: "Official departmental handbook detailing degree requirements, course descriptions, and staff contacts.",
      url: "https://computing.ui.edu.ng/handbook-2025.pdf",
      type: "handbook",
      category: "Administrative",
      tags: ["Handbook", "Faculty", "Degree Requirements"],
      facultyId: computing.id,
      source: "Faculty of Computing Dean's Office",
      owner: "Faculty Sub-Dean (Undergraduate)",
      verifiedDate: new Date("2026-01-12"),
    },
    {
      title: "GST101 / GES107 Past Examination Questions & Answers (2020-2024)",
      description: "Verified collection of past CBT questions for General Studies compulsory courses.",
      url: "https://ui.edu.ng/portal/past-questions/gst101",
      type: "past_questions",
      category: "Academic",
      tags: ["GST101", "GES107", "Past Questions", "CBT Practice"],
      facultyId: null,
      source: "UI General Studies Directorate (GES)",
      owner: "GES Board of Studies",
      verifiedDate: new Date("2026-02-05"),
    },
  ];

  for (const resource of resourcesData) {
    await prisma.resource.create({ data: resource });
  }

  console.log("✅ Resources seeded.");

  // =========================================================
  // 6. SEED OPPORTUNITIES
  // =========================================================
  const opportunitiesData = [
    {
      title: "MTN Foundation Science & Technology Scholarship 2026",
      description: "Annual ₦200,000 grant awarded to 200L+ high-performing students studying STEM courses in Nigerian public universities.",
      organization: "MTN Nigeria Foundation",
      url: "https://www.mtn.ng/scholarships/",
      deadline: new Date("2026-05-30"),
      type: "Scholarship",
      category: "Financial Aid",
      tags: ["MTN", "Scholarship", "STEM", "Grants"],
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
      tags: ["GDSC", "Coding", "Community", "Projects"],
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
      tags: ["Work Study", "Jobs", "Campus", "Financial Aid"],
      facultyId: null,
      source: "UI Dean of Student Affairs Office",
      owner: "Work-Study Scheme Committee",
      verifiedDate: new Date("2026-01-25"),
    },
    {
      title: "UI Hackathon 2026: AI & Sustainability Challenge",
      description: "48-hour campus hackathon with over ₦1,500,000 in cash prizes, cloud credits, and incubation for winning student teams.",
      organization: "Faculty of Computing & Ventures Platform",
      url: "https://hackathon.computing.ui.edu.ng",
      deadline: new Date("2026-06-01"),
      type: "Hackathon",
      category: "Competition",
      tags: ["Hackathon", "AI", "Prizes", "Innovation"],
      facultyId: computing.id,
      source: "Faculty Innovation Committee",
      owner: "Hackathon Steering Lead",
      verifiedDate: new Date("2026-02-12"),
    },
  ];

  for (const opp of opportunitiesData) {
    await prisma.opportunity.create({ data: opp });
  }

  console.log("✅ Opportunities seeded.");

  // =========================================================
  // 7. SEED FAQS
  // =========================================================
  const faqsData = [
    {
      question: "How do I complete my physical departmental clearance at UI?",
      answer: "Physical clearance requires your JAMB Admission Letter, UI Acceptance Fee Receipt, O'Level Certificate/Statement of Result, Birth Certificate, and 4 passport photographs. Visit the Faculty Secretariat with original documents and photocopies.",
      category: "Admissions & Clearance",
      tags: ["Clearance", "Freshers", "Documents", "Admission"],
      facultyId: computing.id,
      source: "UI Admissions Officer Desk",
      owner: "Academic Affairs Officer",
      verifiedDate: new Date("2026-01-10"),
    },
    {
      question: "What is the deadline for course add/drop for the current semester?",
      answer: "Course add/drop closes exactly 4 weeks after lecture commencement. You can modify registered courses via the student portal before your departmental adviser signs your final course form.",
      category: "Course Add/Drop",
      tags: ["Courses", "Portal", "Deadline"],
      facultyId: null,
      source: "UI Portal Administrator",
      owner: "ICT Infrastructure Unit",
      verifiedDate: new Date("2026-01-15"),
    },
    {
      question: "How is hostel accommodation allocated for 100 Level freshers?",
      answer: "Hostel space is reserved for 100L freshers and final year students. Once your school fees payment reflects on the portal, log into the portal under 'Hostel Reservation' on designated release dates.",
      category: "Hostel & Housing",
      tags: ["Hostel", "Accommodation", "Hall of Residence"],
      facultyId: null,
      source: "UI Student Affairs Division (Hall Management)",
      owner: "Dean of Student Affairs",
      verifiedDate: new Date("2026-01-08"),
    },
    {
      question: "What should I do if my course registration payment status shows pending?",
      answer: "If Remita or card payment status remains pending after 24 hours, do not repay. Send your RRR code, transaction reference, and student ID number to portal-support@ui.edu.ng or visit the ICT Center behind KDL.",
      category: "Fees & Payments",
      tags: ["Payment", "Remita", "Portal", "Support"],
      facultyId: null,
      source: "UI Bursary Department",
      owner: "University Bursar",
      verifiedDate: new Date("2026-02-02"),
    },
    {
      question: "Where can I get help if I need specialized academic counseling or subject tutoring?",
      answer: "For specialized, AI-driven personal guidance tailored to your specific department and level, click the 'Chat with Telegram Study Assistant' button below or ask your Faculty AI mentor in Telegram!",
      category: "Exams & Results",
      tags: ["AI", "Study Assistant", "Mentorship", "Tutoring"],
      facultyId: computing.id,
      source: "UI Freshers AI Mentorship Project",
      owner: "Lead AI Engineer",
      verifiedDate: new Date("2026-02-15"),
    },
  ];

  for (const faq of faqsData) {
    await prisma.faq.create({ data: faq });
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