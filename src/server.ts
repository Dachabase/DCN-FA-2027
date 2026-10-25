import "dotenv/config";
import express, { Request, Response } from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import path from "path";
import { prisma } from "./database/prisma";
import { startComputingBot } from "./telegram/computing-bot";
import { authRouter } from "./auth/auth.controller";
import { personalizationRouter } from "./personalization/personalization.controller";
import { utmeRouter } from "./utme/utme.controller";
import { academic100lRouter, vaultRouter } from "./academic100l/academic100l.controller";
import { requireAuth, optionalAuth } from "./auth/auth.middleware";
import { ALL_GUIDES } from "./data/guides-data";
import { resolveAudienceFromRequest, normalizeAudience } from "./personalization/audience.helper";
import { createCorsOptions } from "./config/cors";
import { env } from "./config/env";

const app = express();
const PORT = env.PORT;

// Trust reverse proxies (Render, Cloudflare, AWS ALB/CloudFront) for secure HTTPS cookies
app.set("trust proxy", 1);

// =========================================================
// CANONICAL DOMAIN 301 PERMANENT REDIRECT MIDDLEWARE
// Redirects legacy Render domain and www subdomain to preferred apex https://blastexams.app
// =========================================================
app.use((req: Request, res: Response, next) => {
  const host = (req.headers.host || "").split(":")[0].toLowerCase();

  // Exclude local development and automated local test runners
  if (host === "localhost" || host === "127.0.0.1" || host === "0.0.0.0") {
    return next();
  }

  // Redirect legacy Render hostname, www subdomain, or any non-canonical Render host to apex
  if (
    host === "dcn-fa-2027.onrender.com" ||
    host === "www.blastexams.app" ||
    (process.env.NODE_ENV === "production" && host.endsWith(".onrender.com") && host !== "blastexams.app")
  ) {
    const targetUrl = `https://blastexams.app${req.originalUrl}`;
    res.setHeader("Cache-Control", "public, max-age=31536000"); // 1-year cache for 301 permanent redirect
    return res.redirect(301, targetUrl);
  }

  next();
});

app.use(cors(createCorsOptions()));
app.use(cookieParser());

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Auth & Personalization Routes
app.use("/api/auth", authRouter);
app.use("/auth", authRouter);
app.use("/api", personalizationRouter);
app.use("/api/utme", utmeRouter);
app.use("/api/100l", academic100lRouter);
app.use("/api/vault", vaultRouter);

// =========================================================
// FALLBACK DATA (For offline/testing resilience)
// =========================================================
const FALLBACK_FACULTIES = [
  { id: "fac_computing", name: "Computing", code: "COMPUTING", departments: [{ id: "dept_csai", name: "Computer Science and AI" }, { id: "dept_cyb", name: "Cybersecurity" }, { id: "dept_it", name: "Information Technology" }, { id: "dept_se", name: "Software Engineering" }, { id: "dept_ds", name: "Data Science" }] },
  { id: "fac_science", name: "Science", code: "SCIENCE", departments: [{ id: "dept_cs", name: "Computer Science" }, { id: "dept_math", name: "Mathematics" }, { id: "dept_stat", name: "Statistics" }, { id: "dept_phy", name: "Physics" }, { id: "dept_chm", name: "Chemistry" }] },
  { id: "fac_tech", name: "Technology", code: "TECH", departments: [{ id: "dept_eee", name: "Electrical & Electronic Engineering" }, { id: "dept_mech", name: "Mechanical Engineering" }, { id: "dept_civ", name: "Civil Engineering" }] },
  { id: "fac_agric", name: "Agriculture", code: "AGRIC", departments: [{ id: "dept_agecon", name: "Agricultural Economics" }, { id: "dept_agron", name: "Agronomy" }, { id: "dept_anim", name: "Animal Science" }] },
  { id: "fac_basic_med", name: "Basic Medical Sciences", code: "BASIC_MED", departments: [{ id: "dept_anat", name: "Anatomy" }, { id: "dept_phys", name: "Physiology" }, { id: "dept_biochem", name: "Biochemistry" }] },
  { id: "fac_clinical", name: "Clinical Sciences", code: "CLINICAL", departments: [{ id: "dept_mbbs", name: "Medicine & Surgery" }, { id: "dept_physio", name: "Physiotherapy" }] },
  { id: "fac_dentistry", name: "Dentistry", code: "DENTISTRY", departments: [{ id: "dept_dent", name: "Child Dental Health" }] },
  { id: "fac_public_health", name: "Public Health", code: "PUBLIC_HEALTH", departments: [{ id: "dept_envh", name: "Environmental Health Sciences" }, { id: "dept_epi", name: "Epidemiology" }] },
  { id: "fac_pharmacy", name: "Pharmacy", code: "PHARMACY", departments: [{ id: "dept_pharm", name: "Pharmaceutical Chemistry" }, { id: "dept_pceut", name: "Pharmaceutics" }] },
  { id: "fac_edm", name: "Environmental Design & Management", code: "EDM", departments: [{ id: "dept_arch", name: "Architecture" }, { id: "dept_estate", name: "Estate Management" }, { id: "dept_urp", name: "Urban & Regional Planning" }] },
  { id: "fac_vet_med", name: "Veterinary Medicine", code: "VET_MED", departments: [{ id: "dept_vet_anat", name: "Veterinary Anatomy" }] },
  { id: "fac_nat_res", name: "Renewable Natural Resources", code: "NAT_RES", departments: [{ id: "dept_frm", name: "Forest Resources Management" }, { id: "dept_wild", name: "Wildlife & Ecotourism" }, { id: "dept_aqua", name: "Aquaculture & Fisheries" }] },
  { id: "fac_econ_mgmt", name: "Economics & Management Sciences", code: "ECON_MGMT", departments: [{ id: "dept_econ", name: "Economics" }, { id: "dept_acct", name: "Accounting" }, { id: "dept_bank", name: "Banking & Finance" }] },
  { id: "fac_social_sci", name: "The Social Sciences", code: "SOCIAL_SCI", departments: [{ id: "dept_pol", name: "Political Science" }, { id: "dept_psych", name: "Psychology" }, { id: "dept_soc", name: "Sociology" }] },
  { id: "fac_arts", name: "Arts", code: "ARTS", departments: [{ id: "dept_cla", name: "Communication & Language Arts" }, { id: "dept_eng", name: "English" }, { id: "dept_hist", name: "History" }, { id: "dept_phil", name: "Philosophy" }] },
  { id: "fac_law", name: "Law", code: "LAW", departments: [{ id: "dept_pub_law", name: "Public & International Law" }, { id: "dept_priv_law", name: "Private & Property Law" }] },
  { id: "fac_education", name: "Education", code: "EDUCATION", departments: [{ id: "dept_ad_ed", name: "Adult Education" }, { id: "dept_gc", name: "Guidance & Counselling" }, { id: "dept_laris", name: "LARIS" }, { id: "dept_sp_ed", name: "Special Education" }] },
  { id: "fac_nursing", name: "Nursing Science", code: "NURSING", departments: [{ id: "dept_nurs", name: "Nursing Science (BNSc)" }] },
];

const FALLBACK_GUIDES = ALL_GUIDES;

const GOOGLE_DRIVE_VAULT_URL = env.GOOGLE_DRIVE_RESOURCES_URL || "";

const FALLBACK_RESOURCES = [
  {
    id: "res_drive_master",
    title: "100L Complete Academic Resource Drive (All Folders)",
    description: "Central Google Drive folder containing all verified 100-Level lecture slides, textbooks, tutorial sheets, and past questions.",
    url: GOOGLE_DRIVE_VAULT_URL,
    type: "drive_folder",
    category: "Academic",
    tags: ["Google Drive", "100L", "All Materials"],
    facultyId: "fac_computing",
    faculty: { id: "fac_computing", name: "Computing" },
    source: "UI Computing & DCN Academic Directorate",
    owner: "Academic Committee",
    verifiedDate: "2026-02-15T00:00:00.000Z",
  },
  {
    id: "res_csc101_drive",
    title: "CSC101: Introduction to Computer Science Slides & Handouts",
    description: "Binary arithmetic, logic circuits, operating system fundamentals, and introductory Python programming materials on Google Drive.",
    url: GOOGLE_DRIVE_VAULT_URL,
    type: "drive_folder",
    category: "Academic",
    tags: ["CSC101", "Computing", "Slides"],
    facultyId: "fac_computing",
    faculty: { id: "fac_computing", name: "Computing" },
    source: "Department of Computer Science & AI",
    owner: "CSC101 Course Coordinator",
    verifiedDate: "2026-02-10T00:00:00.000Z",
  },
  {
    id: "res_mat111_drive",
    title: "MAT111: Algebra & Trigonometry Problem Sets & Solutions",
    description: "Step-by-step solved tutorial sheets covering polynomials, series, mathematical induction, and complex numbers.",
    url: GOOGLE_DRIVE_VAULT_URL,
    type: "drive_folder",
    category: "Academic",
    tags: ["MAT111", "Mathematics", "Tutorials"],
    facultyId: "fac_computing",
    faculty: { id: "fac_computing", name: "Computing" },
    source: "Department of Mathematics",
    owner: "MAT111 Teaching Assistant Desk",
    verifiedDate: "2026-02-08T00:00:00.000Z",
  },
  {
    id: "res_gst101_drive",
    title: "GST101: Use of English & Communication Skills Compendium",
    description: "Grammar rules, sentence structure analysis, summary writing guides, and past examination questions.",
    url: GOOGLE_DRIVE_VAULT_URL,
    type: "drive_folder",
    category: "General Study",
    tags: ["GST101", "General Studies", "English"],
    facultyId: null,
    source: "Centre for General Studies (CGS)",
    owner: "GST101 Coordinator",
    verifiedDate: "2026-01-20T00:00:00.000Z",
  },
  {
    id: "res_ges107_drive",
    title: "GES107: Nigerian Peoples & Culture Comprehensive Study Notes",
    description: "Summarized study notes and test preparation material covering ancient Nigerian kingdoms, cultural evolution, and social structure.",
    url: GOOGLE_DRIVE_VAULT_URL,
    type: "drive_folder",
    category: "General Study",
    tags: ["GES107", "Culture", "CGS"],
    facultyId: null,
    source: "Centre for General Studies (CGS)",
    owner: "GES107 Coordinator",
    verifiedDate: "2026-01-22T00:00:00.000Z",
  },
  {
    id: "res_calendar",
    title: "UI Official Academic Calendar (2025/2026 Session)",
    description: "Official senate calendar with semester dates, registration deadlines, matriculation schedule, and exam periods.",
    url: GOOGLE_DRIVE_VAULT_URL,
    type: "pdf",
    category: "Administrative",
    tags: ["Calendar", "Important Dates", "Exams"],
    facultyId: null,
    source: "UI Senate Secretariat",
    owner: "Academic Planning Office",
    verifiedDate: "2026-01-05T00:00:00.000Z",
  },
];

const FALLBACK_OPPORTUNITIES = [
  {
    id: "opp_nelfund",
    title: "Federal Government Student Loan Scheme (NELFUND)",
    description: "100% tuition fees coverage plus monthly upkeep allowance for enrolled Nigerian undergraduate students.",
    organization: "Nigeria Education Loan Fund (NELFUND)",
    url: "https://nelf.gov.ng/",
    deadline: "2026-06-30T00:00:00.000Z",
    type: "Scholarship",
    category: "Financial Aid",
    tags: ["NELFUND", "Student Loan", "Federal Govt"],
    facultyId: null,
    source: "NELFUND Official Portal",
    owner: "Student Affairs Financial Aid",
    verifiedDate: "2026-02-15T00:00:00.000Z",
  },
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
    id: "opp_totalenergies",
    title: "NNPC / TotalEnergies National Merit Scholarship",
    description: "Annual merit scholarship for 100-Level undergraduates across recognized Nigerian tertiary institutions.",
    organization: "TotalEnergies EP Nigeria",
    url: "https://scholarships.totalenergies.ng/",
    deadline: "2026-04-30T00:00:00.000Z",
    type: "Scholarship",
    category: "Financial Aid",
    tags: ["TotalEnergies", "NNPC", "Merit"],
    facultyId: null,
    source: "TotalEnergies Scholarship Portal",
    owner: "Scholarship Committee",
    verifiedDate: "2026-02-10T00:00:00.000Z",
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
    app: "BlastExams Web API",
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

// Metadata enrichment map for articles and guides
const metaMap = new Map<string, any>();
for (const item of FALLBACK_GUIDES) {
  if (item.id) metaMap.set(item.id, item);
  if ((item as any).slug) metaMap.set((item as any).slug, item);
  if (item.title) metaMap.set(item.title.toLowerCase().trim(), item);
}

const enrichGuide = (g: any) => {
  const cleanId = (g.id || "").replace(/^guide_/, "");
  const enriched = metaMap.get(g.id) ||
                   metaMap.get(`guide_${cleanId}`) ||
                   metaMap.get(cleanId) ||
                   metaMap.get((g.title || "").toLowerCase().trim()) || {};
  return {
    ...g,
    body: g.content || g.body,
    verified: g.status === "PUBLISHED",
    author: (enriched as any).author || g.owner || "UI Academic Adviser Desk",
    authorRole: (enriched as any).authorRole || "Campus Survival & Academic Contributor",
    readTime: (enriched as any).readTime || "5 min read",
    slug: (enriched as any).slug || cleanId,
    featuredImage: (enriched as any).featuredImage || null,
    faq: (enriched as any).faq || (enriched as any).faqs || [],
    faqs: (enriched as any).faqs || (enriched as any).faq || [],
    tags: (enriched as any).tags || [],
  };
};

// GET /api/faculties/:id/guides and /api/guides (Public / Optional Auth)
const getGuidesHandler = async (req: Request, res: Response) => {
  const facultyId = req.params.id ? String(req.params.id) : (req.query.facultyId ? String(req.query.facultyId) : "all");
  const category = req.query.category ? String(req.query.category) : null;
  const search = req.query.search ? String(req.query.search).toLowerCase() : null;
  const targetAudience = resolveAudienceFromRequest(req);

  try {
    const whereClause: any = { status: "PUBLISHED" };
    if (facultyId !== "all") {
      whereClause.OR = [{ facultyId }, { facultyId: null }];
    }
    if (category && category !== "ALL") {
      whereClause.category = { equals: category, mode: "insensitive" };
    }
    if (targetAudience) {
      whereClause.audience = { has: targetAudience };
    }

    const guides = await prisma.guide.findMany({
      where: whereClause,
      include: {
        faculty: { select: { id: true, name: true, code: true } },
        department: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    if (guides.length > 0) {
      let formatted = guides.map(g => enrichGuide(g));
      if (search) {
        formatted = formatted.filter(g =>
          g.title.toLowerCase().includes(search) ||
          g.summary.toLowerCase().includes(search) ||
          (g.content && g.content.toLowerCase().includes(search))
        );
      }
      return res.json({ success: true, data: formatted });
    }
  } catch (error) {
    console.warn("DB error, serving fallback guides.");
  }

  let fallbackList = FALLBACK_GUIDES;
  if (targetAudience) {
    fallbackList = fallbackList.filter(g => !(g as any).audience || (g as any).audience.includes(targetAudience));
  }
  if (facultyId !== "all") {
    fallbackList = fallbackList.filter(g => !g.facultyId || g.facultyId === facultyId || g.faculty?.id === facultyId);
  }
  if (category && category !== "ALL") {
    fallbackList = fallbackList.filter(g =>
      g.category?.toLowerCase() === category.toLowerCase() ||
      (g as any).rawCategory?.toLowerCase() === category.toLowerCase()
    );
  }
  if (search) {
    fallbackList = fallbackList.filter(g =>
      g.title.toLowerCase().includes(search) ||
      g.summary.toLowerCase().includes(search) ||
      (g.content && g.content.toLowerCase().includes(search))
    );
  }
  const formatted = fallbackList.map(g => enrichGuide(g));
  res.json({ success: true, data: formatted });
};

app.get("/api/faculties/:id/guides", optionalAuth, getGuidesHandler);
app.get("/api/guides", optionalAuth, getGuidesHandler);

// GET /api/guides/:id (Public / Optional Auth)
app.get("/api/guides/:id", optionalAuth, async (req: Request, res: Response) => {
  const guideId = String(req.params.id);
  const cleanId = guideId.replace(/^guide_/, "");
  
  // Helper to compute series navigation
  const attachSeriesNavigation = (g: any, allList: any[]) => {
    let seriesGuides: any[] = [];
    let prevGuide: any = null;
    let nextGuide: any = null;

    if (g.seriesId) {
      seriesGuides = allList
        .filter((item: any) => item.seriesId === g.seriesId)
        .sort((a: any, b: any) => (a.seriesOrder || 0) - (b.seriesOrder || 0))
        .map((item: any) => ({
          id: item.id,
          title: item.title,
          seriesOrder: item.seriesOrder,
          seriesTotal: item.seriesTotal,
        }));
      
      const currentOrder = g.seriesOrder || 1;
      const prev = seriesGuides.find((item: any) => item.seriesOrder === currentOrder - 1);
      const next = seriesGuides.find((item: any) => item.seriesOrder === currentOrder + 1);
      if (prev) prevGuide = { id: prev.id, title: prev.title, seriesOrder: prev.seriesOrder };
      if (next) nextGuide = { id: next.id, title: next.title, seriesOrder: next.seriesOrder };
    }

    return {
      ...g,
      body: g.content || g.body,
      verified: g.status === "PUBLISHED",
      seriesGuides,
      prevGuide,
      nextGuide,
    };
  };

  try {
    const guide = await prisma.guide.findFirst({
      where: {
        OR: [
          { id: guideId },
          { id: `guide_${cleanId}` },
          { id: cleanId },
        ]
      },
      include: {
        faculty: { select: { id: true, name: true, code: true } },
        department: { select: { id: true, name: true } },
      },
    });

    if (guide) {
      if ((req as any).user?.id) {
        prisma.interaction.create({
          data: {
            userId: (req as any).user.id,
            eventType: "VIEW_GUIDE",
            resourceId: guide.id,
            metadata: { title: guide.title, category: guide.category },
          }
        }).catch(err => console.warn("Guide interaction log error:", err));
      }

      let allSeries: any[] = [];
      if (guide.seriesId) {
        allSeries = await prisma.guide.findMany({
          where: { seriesId: guide.seriesId },
          orderBy: { seriesOrder: "asc" },
        });
      }

      return res.json({
        success: true,
        data: enrichGuide(attachSeriesNavigation(guide, allSeries.length > 0 ? allSeries : FALLBACK_GUIDES)),
      });
    }
  } catch (error) {
    console.warn("DB error fetching guide.");
  }

  const fallbackGuide = FALLBACK_GUIDES.find(g =>
    g.id === guideId ||
    g.id === `guide_${cleanId}` ||
    g.id === cleanId ||
    (g as any).slug === cleanId
  ) || FALLBACK_GUIDES[0];

  res.json({
    success: true,
    data: enrichGuide(attachSeriesNavigation(fallbackGuide, FALLBACK_GUIDES)),
  });
});


// =========================================================
// RESOURCES API (Audience-Aware, Optional Auth)
// =========================================================
app.get("/api/resources", optionalAuth, async (req: Request, res: Response) => {
  try {
    const { category, search } = req.query;
    const targetAudience = resolveAudienceFromRequest(req);
    const whereClause: any = { status: "PUBLISHED" };
    if (targetAudience) {
      whereClause.audience = { has: targetAudience };
    }

    const resources = await prisma.resource.findMany({
      where: whereClause,
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
  const targetAudience = resolveAudienceFromRequest(req);
  if (targetAudience) {
    filteredFallback = filteredFallback.filter(r => !(r as any).audience || (r as any).audience.includes(targetAudience));
  }
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
// OPPORTUNITIES API (Audience-Aware, Optional Auth)
// =========================================================
app.get("/api/opportunities", optionalAuth, async (req: Request, res: Response) => {
  try {
    const targetAudience = resolveAudienceFromRequest(req);
    const whereClause: any = { status: "ACTIVE" };
    if (targetAudience) {
      whereClause.audience = { has: targetAudience };
    }

    const opportunities = await prisma.opportunity.findMany({
      where: whereClause,
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
  const targetAudience = resolveAudienceFromRequest(req);
  if (targetAudience) {
    filteredFallback = filteredFallback.filter(o => !(o as any).audience || (o as any).audience.includes(targetAudience));
  }
  const { type } = req.query;
  if (type && type !== "ALL") {
    filteredFallback = filteredFallback.filter(o => o.type === type);
  }
  res.json({ success: true, data: filteredFallback });
});

// =========================================================
// FAQS API (Audience-Aware, Optional Auth)
// =========================================================
app.get("/api/faqs", optionalAuth, async (req: Request, res: Response) => {
  try {
    const targetAudience = resolveAudienceFromRequest(req);
    const whereClause: any = { status: "PUBLISHED" };
    if (targetAudience) {
      whereClause.audience = { has: targetAudience };
    }

    const faqs = await prisma.fAQ.findMany({
      where: whereClause,
      include: { faculty: { select: { id: true, name: true } } },
      orderBy: { createdAt: "desc" },
    });

    if (faqs.length > 0) {
      return res.json({ success: true, data: faqs });
    }
  } catch (error) {
    console.warn("DB error fetching FAQs, using fallback.");
  }

  let filteredFallback = FALLBACK_FAQS;
  const targetAudience = resolveAudienceFromRequest(req);
  if (targetAudience) {
    filteredFallback = filteredFallback.filter(f => !(f as any).audience || (f as any).audience.includes(targetAudience));
  }
  res.json({ success: true, data: filteredFallback });
});

// =========================================================
// ADMIN AUDIENCE CLASSIFICATION & INVENTORY APIS
// =========================================================
app.get("/api/admin/content-inventory", optionalAuth, async (req: Request, res: Response) => {
  try {
    const filterAudience = req.query.audience ? normalizeAudience(String(req.query.audience)) : null;
    const filterType = req.query.type ? String(req.query.type).toLowerCase() : "all";
    const search = req.query.search ? String(req.query.search).toLowerCase() : "";

    const [guides, resources, opportunities, faqs] = await Promise.all([
      prisma.guide.findMany({
        where: filterAudience ? { audience: { has: filterAudience } } : {},
        select: { id: true, title: true, category: true, audience: true, status: true, source: true, owner: true, createdAt: true },
        orderBy: { createdAt: "desc" },
      }),
      prisma.resource.findMany({
        where: filterAudience ? { audience: { has: filterAudience } } : {},
        select: { id: true, title: true, category: true, type: true, audience: true, status: true, url: true, source: true, createdAt: true },
        orderBy: { createdAt: "desc" },
      }),
      prisma.opportunity.findMany({
        where: filterAudience ? { audience: { has: filterAudience } } : {},
        select: { id: true, title: true, category: true, type: true, audience: true, status: true, url: true, deadline: true, createdAt: true },
        orderBy: { createdAt: "desc" },
      }),
      prisma.fAQ.findMany({
        where: filterAudience ? { audience: { has: filterAudience } } : {},
        select: { id: true, question: true, category: true, audience: true, status: true, createdAt: true },
        orderBy: { createdAt: "desc" },
      }),
    ]);

    let items: any[] = [];
    if (filterType === "all" || filterType === "guide") {
      items.push(...guides.map(g => ({
        id: g.id,
        title: g.title,
        type: "Guide / Article",
        model: "guide",
        category: g.category,
        audience: g.audience,
        status: g.status,
        source: g.source,
        owner: g.owner,
        isShared: g.audience.length > 1,
        isUncertain: g.audience.length === 0,
      })));
    }
    if (filterType === "all" || filterType === "resource") {
      items.push(...resources.map(r => ({
        id: r.id,
        title: r.title,
        type: `Resource (${r.type})`,
        model: "resource",
        category: r.category,
        audience: r.audience,
        status: r.status,
        url: r.url,
        isShared: r.audience.length > 1,
        isUncertain: r.audience.length === 0,
      })));
    }
    if (filterType === "all" || filterType === "opportunity") {
      items.push(...opportunities.map(o => ({
        id: o.id,
        title: o.title,
        type: `Opportunity (${o.type})`,
        model: "opportunity",
        category: o.category,
        audience: o.audience,
        status: o.status,
        url: o.url,
        isShared: o.audience.length > 1,
        isUncertain: o.audience.length === 0,
      })));
    }
    if (filterType === "all" || filterType === "faq") {
      items.push(...faqs.map(f => ({
        id: f.id,
        title: f.question,
        type: "FAQ",
        model: "faq",
        category: f.category,
        audience: f.audience,
        status: f.status,
        isShared: f.audience.length > 1,
        isUncertain: f.audience.length === 0,
      })));
    }

    if (search) {
      items = items.filter(i =>
        i.title.toLowerCase().includes(search) ||
        (i.category && i.category.toLowerCase().includes(search)) ||
        i.id.toLowerCase().includes(search)
      );
    }

    const totalAudited = items.length;
    const utmeOnly = items.filter(i => i.audience.length === 1 && i.audience.includes("UTME_STUDENT")).length;
    const ui100LOnly = items.filter(i => i.audience.length === 1 && i.audience.includes("UI_100_LEVEL_STUDENT")).length;
    const shared = items.filter(i => i.audience.length > 1).length;
    const unclassifiedOrReview = items.filter(i => i.audience.length === 0).length;

    res.json({
      success: true,
      summary: {
        totalAudited,
        utmeOnly,
        ui100LOnly,
        shared,
        unclassifiedOrReview,
      },
      data: items,
    });
  } catch (error: any) {
    console.error("Error fetching content inventory:", error);
    res.status(500).json({ success: false, error: "Failed to load content inventory" });
  }
});

// PATCH /api/admin/classify-item - Single item classification update
app.patch("/api/admin/classify-item", optionalAuth, async (req: Request, res: Response) => {
  try {
    const { model, id, audience } = req.body;
    if (!model || !id || !Array.isArray(audience)) {
      return res.status(400).json({ success: false, error: "Missing required fields: model, id, audience (array)" });
    }

    const validAudiences = audience.map((a: string) => normalizeAudience(a)).filter(Boolean) as string[];
    if (validAudiences.length === 0 && audience.length > 0) {
      return res.status(400).json({ success: false, error: "Invalid audience tags provided." });
    }

    let updated: any = null;
    if (model === "guide") {
      updated = await prisma.guide.update({ where: { id }, data: { audience: validAudiences } });
    } else if (model === "resource") {
      updated = await prisma.resource.update({ where: { id }, data: { audience: validAudiences } });
    } else if (model === "opportunity") {
      updated = await prisma.opportunity.update({ where: { id }, data: { audience: validAudiences } });
    } else if (model === "faq") {
      updated = await prisma.fAQ.update({ where: { id }, data: { audience: validAudiences } });
    } else {
      return res.status(400).json({ success: false, error: `Unsupported content model: ${model}` });
    }

    res.json({
      success: true,
      message: `Successfully classified ${model} [${id}] to audience: [${validAudiences.join(", ")}]`,
      data: updated,
    });
  } catch (error: any) {
    console.error("Error classifying item:", error);
    res.status(500).json({ success: false, error: "Failed to update audience classification" });
  }
});

// POST /api/admin/bulk-classify - Bulk classification with validation & preview
app.post("/api/admin/bulk-classify", optionalAuth, async (req: Request, res: Response) => {
  try {
    const { updates, dryRun } = req.body;
    if (!Array.isArray(updates) || updates.length === 0) {
      return res.status(400).json({ success: false, error: "Provide array of updates: [{ model, id, audience: [] }]" });
    }

    const validatedUpdates = updates.map((u: any) => ({
      model: String(u.model).toLowerCase(),
      id: String(u.id),
      audience: Array.isArray(u.audience)
        ? (u.audience.map((a: string) => normalizeAudience(a)).filter(Boolean) as string[])
        : [],
    }));

    if (dryRun) {
      return res.json({
        success: true,
        dryRun: true,
        previewCount: validatedUpdates.length,
        proposedUpdates: validatedUpdates,
      });
    }

    let successCount = 0;
    const errors: any[] = [];

    for (const item of validatedUpdates) {
      try {
        if (item.model === "guide") {
          await prisma.guide.update({ where: { id: item.id }, data: { audience: item.audience } });
        } else if (item.model === "resource") {
          await prisma.resource.update({ where: { id: item.id }, data: { audience: item.audience } });
        } else if (item.model === "opportunity") {
          await prisma.opportunity.update({ where: { id: item.id }, data: { audience: item.audience } });
        } else if (item.model === "faq") {
          await prisma.fAQ.update({ where: { id: item.id }, data: { audience: item.audience } });
        }
        successCount++;
      } catch (err: any) {
        errors.push({ id: item.id, model: item.model, error: err.message });
      }
    }

    res.json({
      success: true,
      message: `Bulk classification applied: ${successCount} updated successfully, ${errors.length} errors.`,
      successCount,
      errors,
    });
  } catch (error: any) {
    console.error("Bulk classification error:", error);
    res.status(500).json({ success: false, error: "Bulk classification failed" });
  }
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

// Direct blog, articles & survival guides URL redirection support
app.get(["/articles", "/blog", "/survival-guides", "/campus-survival-guides"], (req: Request, res: Response) => {
  res.redirect("/#/guides");
});

app.get([
  "/articles/:category/:slug",
  "/articles/:slug",
  "/blog/:category/:slug",
  "/blog/:slug",
  "/survival-guides/:slug",
  "/campus-survival-guides/:slug"
], (req: Request, res: Response) => {
  const slug = req.params.slug || req.params.category;
  res.redirect(`/#/guides/${slug}`);
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

// Dedicated routes for serving blastexams.html portal app
app.get(["/portal", "/app", "/blastexams", "/companion"], (req: Request, res: Response) => {
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.sendFile(path.join(publicDir, "index.html"), (err) => {
    if (err) {
      res.redirect("/");
    }
  });
});

// Classic 100L Past Exam Engine & Vault route
app.get(["/classic", "/cbt", "/exam-hall"], (req: Request, res: Response) => {
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.sendFile(path.join(publicDir, "classic.html"), (err) => {
    if (err) {
      res.redirect("/");
    }
  });
});

app.use((req: Request, res: Response) => {
  if (req.path.startsWith("/api/")) {
    return res.status(404).json({ success: false, error: "API endpoint not found" });
  }
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.sendFile(path.join(publicDir, "index.html"), (err) => {
    if (err) {
      res.status(404).send("BlastExams Web App - API is active at /api");
    }
  });
});

// Keep-alive cron / self-pinger to prevent Render spin-down
function initKeepAliveService() {
  const externalUrl = env.APP_URL || (env.NODE_ENV === "production" ? "https://blastexams.app" : "");
  if (!externalUrl) {
    return;
  }
  const pingUrl = `${externalUrl.replace(/\/$/, "")}/api/health`;
  const PING_INTERVAL_MS = 10 * 60 * 1000; // 10 minutes

  console.log(`[KeepAlive] Scheduled heartbeat ping every 10 mins to: ${pingUrl}`);
  setInterval(async () => {
    try {
      const res = await fetch(pingUrl);
      console.log(`[KeepAlive] Heartbeat ping status: ${res.status} at ${new Date().toISOString()}`);
    } catch (err: any) {
      console.warn(`[KeepAlive] Heartbeat ping notice: ${err?.message || err}`);
    }
  }, PING_INTERVAL_MS);
}

app.listen(PORT, () => {
  console.log(`BlastExams Backend API running on http://localhost:${PORT}`);
  initKeepAliveService();
  startComputingBot().catch((err) => {
    console.error("Telegram Bot failed to start:", err);
  });
});
