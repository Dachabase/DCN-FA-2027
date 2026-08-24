import "dotenv/config";
import express, { Request, Response } from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import path from "path";
import { prisma } from "./database/prisma";
import { startComputingBot } from "./telegram/computing-bot";
import { authRouter } from "./auth/auth.controller";
import { personalizationRouter } from "./personalization/personalization.controller";
import { requireAuth, optionalAuth } from "./auth/auth.middleware";

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors({ origin: true, credentials: true }));
app.use(cookieParser());
app.use(express.json());

// Auth & Personalization Routes
app.use("/api/auth", authRouter);
app.use("/api", personalizationRouter);

// =========================================================
// FALLBACK DATA (For offline/testing resilience)
// =========================================================
const FALLBACK_FACULTIES = [
  {
    id: "fac_computing",
    name: "Computing",
    code: "COMPUTING",
    departments: [
      { id: "dept_csai", name: "Computer Science and AI" },
      { id: "dept_cyb", name: "Cybersecurity" },
      { id: "dept_it", name: "Information Technology" },
      { id: "dept_se", name: "Software Engineering" },
    ],
    _count: { guides: 4, resources: 5, opportunities: 4 },
  },
  {
    id: "fac_science",
    name: "Science",
    code: "SCIENCE",
    departments: [
      { id: "dept_cs", name: "Computer Science" },
      { id: "dept_math", name: "Mathematics" },
      { id: "dept_stat", name: "Statistics" },
    ],
    _count: { guides: 2, resources: 3, opportunities: 2 },
  },
  {
    id: "fac_tech",
    name: "Technology",
    code: "TECH",
    departments: [
      { id: "dept_eee", name: "Electrical & Electronic Engineering" },
      { id: "dept_mech", name: "Mechanical Engineering" },
    ],
    _count: { guides: 2, resources: 2, opportunities: 2 },
  },
];

const FALLBACK_GUIDES = [
  {
    id: "guide_100l_reg",
    title: "100L Course Registration & Subject Combination Guide",
    summary: "Step-by-step walkthrough for registering 100L compulsory and elective courses at UI.",
    content: `## Welcome to UI Course Registration\nEvery 100 Level student in the Faculty of Computing must register for compulsory general courses (GST101, GST102, GES107) alongside departmental core courses.\n\n### Core 100L Computing Courses:\n- **CSC101**: Introduction to Computer Science (3 Units)\n- **CSC102**: Introduction to Problem Solving & Programming (3 Units)\n- **MAT111**: Algebra & Trigonometry (3 Units)\n- **MAT121**: Calculus I (3 Units)\n- **PHY101**: General Physics I (3 Units)\n\n### Key Rules:\n1. Maximum credit load per semester is **24 units**, minimum is **15 units**.\n2. Course registration must be validated by your Departmental Course Adviser before portal closure.\n3. Make sure to print 4 copies of your Form 01 for clearance.`,
    category: "Course Registration",
    status: "PUBLISHED",
    facultyId: "fac_computing",
    faculty: { id: "fac_computing", name: "Computing" },
    department: { id: "dept_csai", name: "Computer Science and AI" },
    source: "University of Ibadan Academic Affairs Secretariat",
    owner: "Office of the Dean, Faculty of Computing",
    verifiedDate: "2026-01-15T00:00:00.000Z",
  },
  {
    id: "guide_cgpa",
    title: "Understanding the UI 5.0 CGPA Grading System",
    summary: "Comprehensive guide to grade points, semester GPA calculation, and probation limits.",
    content: `## UI Senate Grading System (5.0 Scale)\nThe Senate of the University of Ibadan operates a **5.0 Cumulative Grade Point Average (CGPA)** system.\n\n| Score Range | Letter Grade | Grade Point (GP) | Classification |\n|-------------|--------------|------------------|----------------|\n| 70% – 100%  | A            | 5.0              | First Class (4.50 – 5.00) |\n| 60% – 69%   | B            | 4.0              | 2nd Class Upper (3.50 – 4.49) |\n| 50% – 59%   | C            | 3.0              | 2nd Class Lower (2.40 – 3.49) |\n| 45% – 49%   | D            | 2.0              | 3rd Class (1.50 – 2.39) |\n| 40% – 44%   | E            | 1.0              | Pass (1.00 – 1.49) |\n| 0% – 39%    | F            | 0.0              | Fail (< 1.00) |\n\n### Good Standing & Academic Regulations:\n- **Good Standing**: CGPA of **1.50** and above.\n- **Academic Probation**: CGPA between **1.00 and 1.49** at the end of a session.\n- **Withdrawal**: CGPA below **1.00** at the end of 100-Level session results in advice to withdraw.`,
    category: "Grading System",
    status: "PUBLISHED",
    facultyId: "fac_computing",
    faculty: { id: "fac_computing", name: "Computing" },
    source: "UI Academic Regulations Handbook & Senate Bulletin",
    owner: "UI Academic Senate",
    verifiedDate: "2026-01-20T00:00:00.000Z",
  },
  {
    id: "guide_venues",
    title: "Lecture Venues & Campus Navigation Map",
    summary: "Locate Large Lecture Theatres (LLT), ICT Center, Science Lecture Theater, and Faculty labs.",
    content: `## Key Lecture Venues for Computing Freshers\n- **Large Lecture Theatre (LLT)**: Located adjacent to Faculty of Science. Venue for GST & MAT lectures.\n- **Faculty of Computing Computer Lab 1 & 2**: Ground floor, New Computing Building.\n- **SUB Pit Theatre**: Student Union Building grounds for faculty orientation programs.`,
    category: "Lecture Venues",
    status: "PUBLISHED",
    facultyId: "fac_computing",
    faculty: { id: "fac_computing", name: "Computing" },
    source: "UI Student Union Physical Planning Committee",
    owner: "Directorate of Physical Planning",
    verifiedDate: "2026-02-01T00:00:00.000Z",
  },
];

const FALLBACK_RESOURCES = [
  {
    id: "res_calendar",
    title: "UI Official Academic Calendar (2025/2026 Academic Session)",
    description: "Official timeline covering matriculation, lecture weeks, mid-semester breaks, exams, and holidays.",
    url: "https://ui.edu.ng/academic-calendar",
    type: "pdf",
    category: "Academic",
    tags: ["Calendar", "Important Dates", "Exams"],
    facultyId: "fac_computing",
    faculty: { id: "fac_computing", name: "Computing" },
    source: "UI Senate Secretariat",
    owner: "Academic Planning Office",
    verifiedDate: "2026-01-05T00:00:00.000Z",
  },
  {
    id: "res_csc101_slides",
    title: "CSC101: Introduction to Computer Science Lecture Slides",
    description: "Complete course deck covering binary arithmetic, logic gates, computer architecture, and algorithms.",
    url: "https://computing.ui.edu.ng/resources/csc101-slides.pdf",
    type: "lecture_notes",
    category: "Academic",
    tags: ["CSC101", "100L", "Lecture Notes"],
    facultyId: "fac_computing",
    faculty: { id: "fac_computing", name: "Computing" },
    source: "Department of Computer Science & AI",
    owner: "CSC101 Course Coordinator",
    verifiedDate: "2026-02-10T00:00:00.000Z",
  },
];

const FALLBACK_OPPORTUNITIES = [
  {
    id: "opp_mtn",
    title: "MTN Foundation Science & Technology Scholarship 2026",
    description: "Annual ₦200,000 grant awarded to 200L+ high-performing students studying STEM courses in Nigerian public universities.",
    organization: "MTN Nigeria Foundation",
    url: "https://www.mtn.ng/scholarships/",
    deadline: "2026-05-30T00:00:00.000Z",
    type: "Scholarship",
    category: "Financial Aid",
    tags: ["MTN", "Scholarship", "STEM"],
    facultyId: "fac_computing",
    faculty: { id: "fac_computing", name: "Computing" },
    source: "MTN Foundation Official Portal",
    owner: "UI Financial Aid & Scholarship Desk",
    verifiedDate: "2026-02-01T00:00:00.000Z",
  },
  {
    id: "opp_gdsc",
    title: "Google Developer Student Clubs (GDSC) UI Chapter Member Recruitment",
    description: "Join UI's premier tech community. Gain hands-on practice in Web Development, Mobile Dev, AI/ML, and Cloud Computing.",
    organization: "GDSC University of Ibadan",
    url: "https://gdsc.community.dev/university-of-ibadan/",
    deadline: "2026-03-15T00:00:00.000Z",
    type: "Mentorship",
    category: "Tech Community",
    tags: ["GDSC", "Coding", "Community"],
    facultyId: "fac_computing",
    faculty: { id: "fac_computing", name: "Computing" },
    source: "GDSC UI Executive Council",
    owner: "GDSC Lead",
    verifiedDate: "2026-02-14T00:00:00.000Z",
  },
  {
    id: "opp_workstudy",
    title: "University of Ibadan Student Work-Study Program",
    description: "Earn up to ₦35,000 monthly working flexible hours (max 2 hours daily) in university libraries, ICT centers, or administrative offices.",
    organization: "UI Student Affairs Division",
    url: "https://ui.edu.ng/work-study",
    deadline: "2026-04-10T00:00:00.000Z",
    type: "Work-Study",
    category: "Campus Employment",
    tags: ["Work Study", "Jobs", "Campus"],
    facultyId: null,
    source: "UI Dean of Student Affairs Office",
    owner: "Work-Study Scheme Committee",
    verifiedDate: "2026-01-25T00:00:00.000Z",
  },
];

const FALLBACK_FAQS = [
  {
    id: "faq_clearance",
    question: "How do I complete my physical departmental clearance at UI?",
    answer: "Physical clearance requires your JAMB Admission Letter, UI Acceptance Fee Receipt, O'Level Certificate/Statement of Result, Birth Certificate, and 4 passport photographs. Visit the Faculty Secretariat with original documents and photocopies.",
    category: "Admissions & Clearance",
    tags: ["Clearance", "Freshers", "Documents"],
    source: "UI Admissions Officer Desk",
    owner: "Academic Affairs Officer",
    verifiedDate: "2026-01-10T00:00:00.000Z",
  },
  {
    id: "faq_adddrop",
    question: "What is the deadline for course add/drop for the current semester?",
    answer: "Course add/drop closes exactly 4 weeks after lecture commencement. You can modify registered courses via the student portal before your departmental adviser signs your final course form.",
    category: "Course Add/Drop",
    tags: ["Courses", "Portal", "Deadline"],
    source: "UI Portal Administrator",
    owner: "ICT Infrastructure Unit",
    verifiedDate: "2026-01-15T00:00:00.000Z",
  },
  {
    id: "faq_hostel",
    question: "How is hostel accommodation allocated for 100 Level freshers?",
    answer: "Hostel space is reserved for 100L freshers and final year students. Once your school fees payment reflects on the portal, log into the portal under 'Hostel Reservation' on designated release dates.",
    category: "Hostel & Housing",
    tags: ["Hostel", "Accommodation"],
    source: "UI Student Affairs Division (Hall Management)",
    owner: "Dean of Student Affairs",
    verifiedDate: "2026-01-08T00:00:00.000Z",
  },
];

// =========================================================
// HEALTH CHECK
// =========================================================
app.get("/api/health", (req: Request, res: Response) => {
  res.json({
    status: "ok",
    app: "UI Freshers Companion Web API",
    timestamp: new Date().toISOString(),
  });
});

// =========================================================
// FACULTIES & GUIDES API
// =========================================================

// GET /faculties and /api/faculties (Protected)
const getFacultiesHandler = async (req: Request, res: Response) => {
  try {
    const faculties = await prisma.faculty.findMany({
      include: {
        departments: { select: { id: true, name: true } },
        _count: { select: { departments: true } },
      },
      orderBy: { name: "asc" },
    });

    if (faculties.length > 0) {
      return res.json({ success: true, data: faculties });
    }
  } catch (error) {
    console.warn("DB connection warning, serving fallback faculties.");
  }
  res.json({ success: true, data: FALLBACK_FACULTIES });
};
app.get("/faculties", requireAuth, getFacultiesHandler);
app.get("/api/faculties", requireAuth, getFacultiesHandler);

// GET /faculties/:id/departments and /api/faculties/:id/departments (Protected)
const getFacultyDepartmentsHandler = async (req: Request, res: Response) => {
  try {
    const facultyId = String(req.params.id);
    const faculty = await prisma.faculty.findFirst({
      where: { OR: [{ id: facultyId }, { name: { equals: facultyId, mode: "insensitive" } }] },
      include: {
        departments: {
          select: { id: true, name: true, facultyId: true },
          orderBy: { name: "asc" },
        },
      },
    });

    if (faculty) {
      return res.json({ success: true, data: faculty.departments, facultyName: faculty.name });
    }
  } catch (error) {
    console.warn("DB error fetching departments for faculty:", req.params.id);
  }
  res.status(404).json({ success: false, message: "Faculty not found", data: [] });
};
app.get("/faculties/:id/departments", requireAuth, getFacultyDepartmentsHandler);
app.get("/api/faculties/:id/departments", requireAuth, getFacultyDepartmentsHandler);

// GET /departments/:id/courses and /api/departments/:id/courses (Protected)
const getDepartmentCoursesHandler = async (req: Request, res: Response) => {
  try {
    const departmentId = String(req.params.id);
    const department = await prisma.department.findFirst({
      where: { OR: [{ id: departmentId }, { name: { equals: departmentId, mode: "insensitive" } }] },
      include: {
        faculty: { select: { id: true, name: true } },
        courses: {
          include: { course: true },
          orderBy: { course: { code: "asc" } },
        },
      },
    });

    if (!department) {
      return res.status(404).json({
        success: false,
        message: "Department not found",
        data: null,
      });
    }

    // Shared University-Wide GES/GST Courses
    const universityWideGes = await prisma.course.findMany({
      where: { isUniversityWide: true },
      orderBy: [{ semester: "asc" }, { code: "asc" }],
    });

    const deptCourses = department.courses.map((dc) => dc.course);

    // Calculate sum of units per semester
    const sem1DeptUnits = deptCourses.filter((c) => c.semester === "1st").reduce((sum, c) => sum + c.units, 0);
    const sem2DeptUnits = deptCourses.filter((c) => c.semester === "2nd").reduce((sum, c) => sum + c.units, 0);
    const sem1GesUnits = universityWideGes.filter((c) => c.semester === "1st").reduce((sum, c) => sum + c.units, 0);
    const sem2GesUnits = universityWideGes.filter((c) => c.semester === "2nd").reduce((sum, c) => sum + c.units, 0);

    return res.json({
      success: true,
      data: {
        department: {
          id: department.id,
          name: department.name,
          faculty: department.faculty,
        },
        departmentCourses: deptCourses,
        universityWideGesCourses: universityWideGes,
        unitSummary: {
          semester1Total: sem1DeptUnits + sem1GesUnits,
          semester2Total: sem2DeptUnits + sem2GesUnits,
          semester1DeptUnits: sem1DeptUnits,
          semester2DeptUnits: sem2DeptUnits,
          semester1GesUnits: sem1GesUnits,
          semester2GesUnits: sem2GesUnits,
        },
      },
    });
  } catch (error) {
    console.error("DB error fetching department courses:", error);
    res.status(500).json({ success: false, message: "Internal server error fetching course package" });
  }
};
app.get("/departments/:id/courses", requireAuth, getDepartmentCoursesHandler);
app.get("/api/departments/:id/courses", requireAuth, getDepartmentCoursesHandler);

// GET /courses/university-wide and /api/courses/university-wide (Protected)
const getUniversityWideCoursesHandler = async (req: Request, res: Response) => {
  try {
    const gesCourses = await prisma.course.findMany({
      where: { isUniversityWide: true },
      orderBy: [{ semester: "asc" }, { code: "asc" }],
    });

    return res.json({
      success: true,
      title: "University-Wide General Studies (GES/GST)",
      description: "Compulsory for all 100-Level students across all 17 faculties at the University of Ibadan.",
      data: gesCourses,
    });
  } catch (error) {
    console.error("DB error fetching GES courses:", error);
    res.status(500).json({ success: false, message: "Error fetching GES courses" });
  }
};
app.get("/courses/university-wide", requireAuth, getUniversityWideCoursesHandler);
app.get("/api/courses/university-wide", requireAuth, getUniversityWideCoursesHandler);

// GET /reference/credit-rules and /api/reference/credit-rules (Protected)
const getReferenceRulesHandler = async (req: Request, res: Response) => {
  try {
    const rules = await prisma.referenceRule.findMany({});
    const formatted = rules.map((r) => ({
      category: r.category,
      title: r.title,
      key: r.key,
      details: JSON.parse(r.value),
      description: r.description,
    }));

    return res.json({
      success: true,
      data: formatted,
    });
  } catch (error) {
    console.error("DB error fetching reference rules:", error);
    res.status(500).json({ success: false, message: "Error fetching reference rules" });
  }
};
app.get("/reference/credit-rules", requireAuth, getReferenceRulesHandler);
app.get("/api/reference/credit-rules", requireAuth, getReferenceRulesHandler);

// GET /api/faculties/:id/guides (Protected)
app.get("/api/faculties/:id/guides", requireAuth, async (req: Request, res: Response) => {
  try {
    const facultyId = String(req.params.id);
    const whereClause: any = facultyId === "all" ? { status: "PUBLISHED" } : { OR: [{ facultyId }, { facultyId: null }], status: "PUBLISHED" };
    const guides = await prisma.guide.findMany({
      where: whereClause,
      include: {
        faculty: { select: { id: true, name: true } },
        department: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    if (guides.length > 0) {
      return res.json({ success: true, data: guides });
    }
  } catch (error) {
    console.warn("DB error, serving fallback guides.");
  }
  res.json({ success: true, data: FALLBACK_GUIDES });
});

// GET /api/guides/:id (Protected)
app.get("/api/guides/:id", requireAuth, async (req: Request, res: Response) => {
  try {
    const guideId = String(req.params.id);
    const guide = await prisma.guide.findUnique({
      where: { id: guideId },
      include: {
        faculty: { select: { id: true, name: true } },
        department: { select: { id: true, name: true } },
      },
    });

    if (guide) {
      return res.json({ success: true, data: guide });
    }
  } catch (error) {
    console.warn("DB error fetching guide.");
  }

  const fallbackGuide = FALLBACK_GUIDES.find(g => g.id === req.params.id) || FALLBACK_GUIDES[0];
  res.json({ success: true, data: fallbackGuide });
});

// =========================================================
// RESOURCES API (Protected)
// =========================================================
app.get("/api/resources", requireAuth, async (req: Request, res: Response) => {
  try {
    const { category, search } = req.query;
    const resources = await prisma.resource.findMany({
      where: { status: "PUBLISHED" },
      include: {
        faculty: { select: { id: true, name: true } },
        department: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    if (resources.length > 0) {
      let filtered = resources;
      if (category && category !== "ALL") {
        filtered = filtered.filter(r => r.category === category);
      }
      if (search) {
        const q = String(search).toLowerCase();
        filtered = filtered.filter(r => r.title.toLowerCase().includes(q) || r.description.toLowerCase().includes(q));
      }
      return res.json({ success: true, data: filtered });
    }
  } catch (error) {
    console.warn("DB error fetching resources, using fallback.");
  }

  let filteredFallback = FALLBACK_RESOURCES;
  const { category, search } = req.query;
  if (category && category !== "ALL") {
    filteredFallback = filteredFallback.filter(r => r.category === category);
  }
  if (search) {
    const q = String(search).toLowerCase();
    filteredFallback = filteredFallback.filter(r => r.title.toLowerCase().includes(q) || r.description.toLowerCase().includes(q));
  }
  res.json({ success: true, data: filteredFallback });
});

// =========================================================
// OPPORTUNITIES API (Protected)
// =========================================================
app.get("/api/opportunities", requireAuth, async (req: Request, res: Response) => {
  try {
    const opportunities = await prisma.opportunity.findMany({
      where: { status: "ACTIVE" },
      include: { faculty: { select: { id: true, name: true } } },
      orderBy: { createdAt: "desc" },
    });

    if (opportunities.length > 0) {
      let filtered = opportunities;
      const { type } = req.query;
      if (type && type !== "ALL") {
        filtered = filtered.filter(o => o.type === type);
      }
      return res.json({ success: true, data: filtered });
    }
  } catch (error) {
    console.warn("DB error fetching opportunities, using fallback.");
  }

  let filteredFallback = FALLBACK_OPPORTUNITIES;
  const { type } = req.query;
  if (type && type !== "ALL") {
    filteredFallback = filteredFallback.filter(o => o.type === type);
  }
  res.json({ success: true, data: filteredFallback });
});

// =========================================================
// FAQS API (Protected)
// =========================================================
app.get("/api/faqs", requireAuth, async (req: Request, res: Response) => {
  try {
    const faqs = await prisma.fAQ.findMany({
      where: { status: "PUBLISHED" },
      include: { faculty: { select: { id: true, name: true } } },
      orderBy: { createdAt: "desc" },
    });

    if (faqs.length > 0) {
      return res.json({ success: true, data: faqs });
    }
  } catch (error) {
    console.warn("DB error fetching FAQs, using fallback.");
  }

  res.json({ success: true, data: FALLBACK_FAQS });
});

// =========================================================
// STUDY ASSISTANT HANDOFF API (Protected)
// =========================================================
app.get("/api/study-assistant-link", requireAuth, async (req: Request, res: Response) => {
  try {
    const { facultyId } = req.query;
    let bot = null;

    if (facultyId) {
      bot = await prisma.bot.findFirst({
        where: { facultyId: String(facultyId) },
        include: { faculty: true },
      });
    }

    if (!bot) {
      bot = await prisma.bot.findFirst({
        include: { faculty: true },
      });
    }

    const username = bot?.username || process.env.DEFAULT_TELEGRAM_BOT_USERNAME || "UIDCNComputingFreshersBot";
    const name = bot?.name || "UI Freshers Study Companion";
    const facultyName = bot?.faculty?.name || "University of Ibadan";

    res.json({
      success: true,
      data: {
        botUsername: username,
        botUrl: `https://t.me/${username}`,
        botName: name,
        facultyName,
        handoffMessage: `Connect with your departmental study companion on Telegram.`,
      },
    });
  } catch (error) {
    const fallbackUsername = process.env.DEFAULT_TELEGRAM_BOT_USERNAME || "UIDCNComputingFreshersBot";
    res.json({
      success: true,
      data: {
        botUsername: fallbackUsername,
        botUrl: `https://t.me/${fallbackUsername}`,
        botName: "UI Freshers Study Companion",
        facultyName: "University of Ibadan",
        handoffMessage: "Connect with your departmental study companion on Telegram.",
      },
    });
  }
});

// =========================================================
// OFFICIAL QUESTION BANK UPLOAD & QUERY API (Protected)
// =========================================================
app.get("/api/questions", requireAuth, async (req: Request, res: Response) => {
  try {
    const { courseCode, topic, type } = req.query;
    const whereClause: any = {};
    if (courseCode) whereClause.courseCode = { equals: String(courseCode), mode: "insensitive" };
    if (topic) whereClause.topic = { contains: String(topic), mode: "insensitive" };
    if (type) whereClause.type = String(type);

    const questions = await prisma.question.findMany({
      where: whereClause,
      orderBy: { createdAt: "desc" },
    });

    res.json({ success: true, count: questions.length, data: questions });
  } catch (error) {
    console.error("Error fetching questions:", error);
    res.status(500).json({ success: false, error: "Failed to fetch questions" });
  }
});

// POST /api/questions/upload (Bulk upload question bank array - Protected)
app.post("/api/questions/upload", requireAuth, async (req: Request, res: Response) => {
  try {
    const { questions } = req.body;
    if (!Array.isArray(questions) || questions.length === 0) {
      return res.status(400).json({
        success: false,
        error: "Invalid payload. Provide an array of questions: { questions: [...] }",
      });
    }

    const created = await prisma.question.createMany({
      data: questions.map((q: any) => ({
        courseCode: String(q.courseCode || "GST101"),
        courseTitle: String(q.courseTitle || "General Studies"),
        topic: String(q.topic || "General"),
        type: String(q.type || "MCQ"),
        questionText: String(q.questionText),
        options: Array.isArray(q.options) ? q.options.map(String) : [],
        correctAnswer: String(q.correctAnswer),
        explanation: String(q.explanation || ""),
        facultyId: q.facultyId ? String(q.facultyId) : null,
      })),
    });

    res.json({
      success: true,
      message: `Successfully uploaded ${created.count} official questions to question bank.`,
      count: created.count,
    });
  } catch (error) {
    console.error("Error uploading question bank:", error);
    res.status(500).json({ success: false, error: "Failed to upload question bank" });
  }
});

// Serve frontend build static files with no-cache headers for HTML
const publicDir = path.join(process.cwd(), "public");
app.use(express.static(publicDir, {
  setHeaders: (res, filePath) => {
    if (filePath.endsWith('.html')) {
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
    }
  }
}));

app.use((req: Request, res: Response) => {
  if (req.path.startsWith("/api/")) {
    return res.status(404).json({ success: false, error: "API endpoint not found" });
  }
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.sendFile(path.join(publicDir, "index.html"), (err) => {
    if (err) {
      res.status(404).send("UI Freshers Companion Web App - API is active at /api");
    }
  });
});

app.listen(PORT, () => {
  console.log(`UI Freshers Companion Backend API running on http://localhost:${PORT}`);
  startComputingBot().catch((err) => {
    console.error("Telegram Bot failed to start:", err);
  });
});
