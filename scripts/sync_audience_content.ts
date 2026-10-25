import "dotenv/config";
import { prisma } from "../src/database/prisma";

// Verified UTME specific guide IDs
const UTME_SPECIFIC_KEYWORDS = [
  "utme", "jamb", "post-utme", "cutoff", "cut-off", "subject combination",
  "rewriting jamb", "aspirant", "admission requirement"
];

// Verified 100L specific guide categories/keywords
const UI_100L_SPECIFIC_CATEGORIES = [
  "Course Registration", "Grading System", "Lecture Venues", "Faculty Guides", "Hostel & Housing", "Academic Policies"
];

const UI_100L_SPECIFIC_KEYWORDS = [
  "100l", "100 level", "cgpa", "grade point", "add and drop", "add/drop", "clearance",
  "faculty of", "fresher", "matriculation", "hall allocation", "direct entry", "probation"
];

export function determineAudience(guide: { title: string; summary?: string | null; category: string; content?: string }): { audience: string[]; isUncertain: boolean; rationale: string } {
  const title = (guide.title || "").toLowerCase();
  const summary = (guide.summary || "").toLowerCase();
  const cat = guide.category;

  // 1. Check for UTME-specific indicators
  const isUtmeMatch = UTME_SPECIFIC_KEYWORDS.some(k => title.includes(k) || summary.includes(k));
  if (isUtmeMatch && (title.includes("jamb") || title.includes("utme") || title.includes("rewriting-jamb") || title.includes("cut-off"))) {
    // If it's specifically about rewriting jamb vs university or jamb prep
    return {
      audience: ["UTME_STUDENT"],
      isUncertain: false,
      rationale: "Exclusively focuses on UTME/JAMB preparation or admission"
    };
  }

  // 2. Check for 100L-specific indicators
  const is100LMatch = UI_100L_SPECIFIC_CATEGORIES.includes(cat) ||
    UI_100L_SPECIFIC_KEYWORDS.some(k => title.includes(k) || summary.includes(k));
  
  if (is100LMatch && !isUtmeMatch) {
    return {
      audience: ["UI_100_LEVEL_STUDENT"],
      isUncertain: false,
      rationale: "Targeted at enrolled University of Ibadan 100-Level undergraduate life and academics"
    };
  }

  // 3. Shared Study Skills, Mental Health, Exam Techniques, Productivity, Finances
  const isGeneralStudy = [
    "Academics", "Study Strategy", "Academic Mastery", "Exam Preparation",
    "Mental Health", "Finances", "Work & School", "Productivity & Mindset"
  ].includes(cat);

  if (isGeneralStudy) {
    return {
      audience: ["UI_100_LEVEL_STUDENT", "UTME_STUDENT"],
      isUncertain: false,
      rationale: "Foundational learning skills, exam strategies, and mental health beneficial to both audiences"
    };
  }

  // 4. Default / Uncertain flagged for review
  return {
    audience: ["UI_100_LEVEL_STUDENT"],
    isUncertain: true,
    rationale: "Uncertain classification; defaulted to UI 100-Level and flagged for administrative review"
  };
}

async function syncAudience() {
  console.log("=== EXECUTING AUDIENCE CLASSIFICATION & CONTENT SYNC ===");

  // 1. Process all guides in DB
  const dbGuides = await prisma.guide.findMany();
  console.log(`Found ${dbGuides.length} guides in database.`);

  const faculties = await prisma.faculty.findMany({ select: { id: true } });
  const validFacultyIds = new Set(faculties.map(f => f.id));
  console.log(`Found ${faculties.length} faculties in database. Sample:`, faculties.slice(0, 3));

  let utmeGuideCount = 0;
  let ui100LGuideCount = 0;
  let sharedGuideCount = 0;
  let uncertainGuideCount = 0;

  for (const guide of dbGuides) {
    const { audience, isUncertain, rationale } = determineAudience(guide);
    if (audience.length === 1 && audience[0] === "UTME_STUDENT") utmeGuideCount++;
    else if (audience.length === 1 && audience[0] === "UI_100_LEVEL_STUDENT") ui100LGuideCount++;
    else if (audience.length > 1) sharedGuideCount++;
    if (isUncertain) uncertainGuideCount++;

    const currentAudienceStr = JSON.stringify(guide.audience || []);
    const targetAudienceStr = JSON.stringify(audience);
    if (currentAudienceStr !== targetAudienceStr) {
      await prisma.guide.update({
        where: { id: guide.id },
        data: { audience }
      });
    }
  }

  console.log("--- GUIDE CLASSIFICATION SUMMARY ---");
  console.log(`  UTME Only Guides: ${utmeGuideCount}`);
  console.log(`  UI 100-Level Only Guides: ${ui100LGuideCount}`);
  console.log(`  Shared Guides: ${sharedGuideCount}`);
  console.log(`  Uncertain / Flagged for Review: ${uncertainGuideCount}`);

  // 2. Seed & Classify Resources
  const GOOGLE_DRIVE_VAULT_URL = process.env.GOOGLE_DRIVE_RESOURCES_URL || "";

  const ALL_RESOURCES = [
    // 100L University Resources
    {
      id: "res_drive_master",
      title: "100L Complete Academic Resource Drive (All Folders)",
      description: "Central Google Drive folder containing all verified 100-Level lecture slides, textbooks, tutorial sheets, and past questions.",
      url: GOOGLE_DRIVE_VAULT_URL,
      type: "drive_folder",
      category: "Academic",
      tags: ["Google Drive", "100L", "All Materials"],
      audience: ["UI_100_LEVEL_STUDENT"],
      facultyId: "fac_computing",
      source: "UI Computing & DCN Academic Directorate",
      owner: "Academic Committee",
      status: "PUBLISHED"
    },
    {
      id: "res_csc101_drive",
      title: "CSC101: Introduction to Computer Science Slides & Handouts",
      description: "Binary arithmetic, logic circuits, operating system fundamentals, and introductory Python programming materials on Google Drive.",
      url: GOOGLE_DRIVE_VAULT_URL,
      type: "drive_folder",
      category: "Academic",
      tags: ["CSC101", "Computing", "Slides"],
      audience: ["UI_100_LEVEL_STUDENT"],
      facultyId: "fac_computing",
      source: "Department of Computer Science & AI",
      owner: "CSC101 Course Coordinator",
      status: "PUBLISHED"
    },
    {
      id: "res_mat111_drive",
      title: "MAT111: Algebra & Trigonometry Problem Sets & Solutions",
      description: "Step-by-step solved tutorial sheets covering polynomials, series, mathematical induction, and complex numbers.",
      url: GOOGLE_DRIVE_VAULT_URL,
      type: "drive_folder",
      category: "Academic",
      tags: ["MAT111", "Mathematics", "Tutorials"],
      audience: ["UI_100_LEVEL_STUDENT"],
      facultyId: "fac_computing",
      source: "Department of Mathematics",
      owner: "MAT111 Teaching Assistant Desk",
      status: "PUBLISHED"
    },
    {
      id: "res_gst101_drive",
      title: "GST101: Use of English & Communication Skills Compendium",
      description: "Grammar rules, sentence structure analysis, summary writing guides, and past examination questions.",
      url: GOOGLE_DRIVE_VAULT_URL,
      type: "drive_folder",
      category: "General Study",
      tags: ["GST101", "General Studies", "English"],
      audience: ["UI_100_LEVEL_STUDENT"],
      source: "Centre for General Studies (CGS)",
      owner: "GST101 Coordinator",
      status: "PUBLISHED"
    },
    {
      id: "res_ges107_drive",
      title: "GES107: Nigerian Peoples & Culture Comprehensive Study Notes",
      description: "Summarized study notes and test preparation material covering ancient Nigerian kingdoms, cultural evolution, and social structure.",
      url: GOOGLE_DRIVE_VAULT_URL,
      type: "drive_folder",
      category: "General Study",
      tags: ["GES107", "Culture", "CGS"],
      audience: ["UI_100_LEVEL_STUDENT"],
      source: "Centre for General Studies (CGS)",
      owner: "GES107 Coordinator",
      status: "PUBLISHED"
    },
    {
      id: "res_calendar",
      title: "UI Official Academic Calendar (2025/2026 Session)",
      description: "Official senate calendar with semester dates, registration deadlines, matriculation schedule, and exam periods.",
      url: GOOGLE_DRIVE_VAULT_URL,
      type: "pdf",
      category: "Administrative",
      tags: ["Calendar", "Important Dates", "Exams"],
      audience: ["UI_100_LEVEL_STUDENT"],
      source: "UI Senate Secretariat",
      owner: "Academic Planning Office",
      status: "PUBLISHED"
    },
    // UTME Specific Resources
    {
      id: "res_utme_syllabus_master",
      title: "JAMB Official UTME Unified Syllabus & Topic Guide (All Subjects)",
      description: "Detailed syllabus topics, recommended texts, and examination objectives for all 11 UTME examination subjects.",
      url: GOOGLE_DRIVE_VAULT_URL,
      type: "pdf",
      category: "UTME Syllabus",
      tags: ["UTME", "Syllabus", "JAMB 2026"],
      audience: ["UTME_STUDENT"],
      source: "Joint Admissions and Matriculation Board (JAMB)",
      owner: "National Academic Examination Secretariat",
      status: "PUBLISHED"
    },
    {
      id: "res_ui_brochure_guide",
      title: "University of Ibadan Official Admission Brochure & Cut-off Policy",
      description: "Official UI admissions requirements, mandatory O'Level credit combos, and UTME subject combinations for all faculties.",
      url: GOOGLE_DRIVE_VAULT_URL,
      type: "pdf",
      category: "Admission Brochure",
      tags: ["UI Admission", "Cut-Off", "Brochure"],
      audience: ["UTME_STUDENT"],
      source: "UI Admissions Office & Senate Committee",
      owner: "Undergraduate Admissions Officer",
      status: "PUBLISHED"
    },
    {
      id: "res_utme_english_vault",
      title: "UTME Use of English Lexis, Idioms & Oral Sound Patterns Compendium",
      description: "High-yield revision notes covering vowel sounds, consonant clusters, stress patterns, and cloze passage strategies.",
      url: GOOGLE_DRIVE_VAULT_URL,
      type: "pdf",
      category: "Exam Revision",
      tags: ["English", "Oral Forms", "UTME Prep"],
      audience: ["UTME_STUDENT"],
      source: "DCN UTME Directorate",
      owner: "Senior English Tutor",
      status: "PUBLISHED"
    },
    // Shared Foundational Resource
    {
      id: "res_active_recall_template",
      title: "Active Recall & Spaced Repetition Notion Study Planner Template",
      description: "Digital template to organize revision blocks, track question bank accuracy, and optimize memory retention before major exams.",
      url: "https://notion.so",
      type: "link",
      category: "Study Strategy",
      tags: ["Active Recall", "Template", "Study Skills"],
      audience: ["UI_100_LEVEL_STUDENT", "UTME_STUDENT"],
      source: "DCN Learning Science Desk",
      owner: "Academic Mentor",
      status: "PUBLISHED"
    }
  ];

  for (const res of ALL_RESOURCES) {
    const rawFacId = (res as any).facultyId;
    const safeFacId = rawFacId && validFacultyIds.has(rawFacId) ? rawFacId : null;

    await prisma.resource.upsert({
      where: { id: res.id },
      create: {
        id: res.id,
        title: res.title,
        description: res.description,
        url: res.url,
        type: res.type,
        category: res.category,
        tags: res.tags,
        audience: res.audience,
        facultyId: safeFacId,
        source: res.source,
        owner: res.owner,
        status: res.status,
      },
      update: {
        title: res.title,
        description: res.description,
        url: res.url,
        type: res.type,
        category: res.category,
        tags: res.tags,
        audience: res.audience,
        facultyId: safeFacId,
        source: res.source,
        owner: res.owner,
        status: res.status,
      }
    });
  }
  console.log(`Upserted ${ALL_RESOURCES.length} educational resources with audience tagging.`);

  // 3. Seed Opportunities
  const ALL_OPPORTUNITIES = [
    {
      id: "opp_nelfund",
      title: "Federal Government Student Loan Scheme (NELFUND)",
      description: "100% tuition fees coverage plus monthly upkeep allowance for enrolled Nigerian undergraduate students and qualified applicants.",
      organization: "Nigeria Education Loan Fund (NELFUND)",
      url: "https://nelf.gov.ng/",
      deadline: new Date("2026-06-30T00:00:00.000Z"),
      type: "Scholarship",
      category: "Financial Aid",
      tags: ["NELFUND", "Student Loan", "Federal Govt"],
      audience: ["UI_100_LEVEL_STUDENT", "UTME_STUDENT"],
      source: "NELFUND Official Portal",
      owner: "Student Affairs Financial Aid",
      status: "ACTIVE"
    },
    {
      id: "opp_totalenergies",
      title: "NNPC / TotalEnergies National Merit Scholarship",
      description: "Annual merit scholarship for 100-Level undergraduates and prospective higher education scholars across Nigeria.",
      organization: "TotalEnergies EP Nigeria",
      url: "https://scholarships.totalenergies.ng/",
      deadline: new Date("2026-04-30T00:00:00.000Z"),
      type: "Scholarship",
      category: "Financial Aid",
      tags: ["TotalEnergies", "NNPC", "Merit"],
      audience: ["UI_100_LEVEL_STUDENT", "UTME_STUDENT"],
      source: "TotalEnergies Scholarship Portal",
      owner: "Scholarship Committee",
      status: "ACTIVE"
    },
    {
      id: "opp_mtn",
      title: "MTN Foundation Science & Technology Scholarship 2026",
      description: "Annual ₦200,000 grant awarded to STEM students studying in Nigerian public universities.",
      organization: "MTN Nigeria Foundation",
      url: "https://www.mtn.ng/scholarships/",
      deadline: new Date("2026-05-30T00:00:00.000Z"),
      type: "Scholarship",
      category: "Financial Aid",
      tags: ["MTN", "Scholarship", "STEM"],
      audience: ["UI_100_LEVEL_STUDENT"],
      facultyId: "fac_computing",
      source: "MTN Foundation Official Portal",
      owner: "UI Financial Aid & Scholarship Desk",
      status: "ACTIVE"
    },
    {
      id: "opp_workstudy",
      title: "University of Ibadan Student Work-Study Program",
      description: "Earn up to ₦35,000 monthly working flexible hours (max 2 hours daily) in university libraries, ICT centers, or administrative offices.",
      organization: "UI Student Affairs Division",
      url: "https://ui.edu.ng/work-study",
      deadline: new Date("2026-04-10T00:00:00.000Z"),
      type: "Work-Study",
      category: "Campus Employment",
      tags: ["Work Study", "Jobs", "Campus"],
      audience: ["UI_100_LEVEL_STUDENT"],
      source: "UI Dean of Student Affairs Office",
      owner: "Work-Study Scheme Committee",
      status: "ACTIVE"
    }
  ];

  for (const opp of ALL_OPPORTUNITIES) {
    const rawFacId = (opp as any).facultyId;
    const safeFacId = rawFacId && validFacultyIds.has(rawFacId) ? rawFacId : null;

    await prisma.opportunity.upsert({
      where: { id: opp.id },
      create: {
        id: opp.id,
        title: opp.title,
        description: opp.description,
        organization: opp.organization,
        url: opp.url,
        deadline: opp.deadline,
        type: opp.type,
        category: opp.category,
        tags: opp.tags,
        audience: opp.audience,
        facultyId: safeFacId,
        source: opp.source,
        owner: opp.owner,
        status: opp.status,
      },
      update: {
        title: opp.title,
        description: opp.description,
        organization: opp.organization,
        url: opp.url,
        deadline: opp.deadline,
        type: opp.type,
        category: opp.category,
        tags: opp.tags,
        audience: opp.audience,
        facultyId: safeFacId,
        source: opp.source,
        owner: opp.owner,
        status: opp.status,
      }
    });
  }
  console.log(`Upserted ${ALL_OPPORTUNITIES.length} opportunities with audience tagging.`);

  // 4. Seed FAQs
  const ALL_FAQS = [
    {
      id: "faq_clearance",
      question: "How do I complete my physical departmental clearance at UI?",
      answer: "Physical clearance requires your JAMB Admission Letter, UI Acceptance Fee Receipt, O'Level Certificate/Statement of Result, Birth Certificate, and 4 passport photographs. Visit the Faculty Secretariat with original documents and photocopies.",
      category: "Admissions & Clearance",
      tags: ["Clearance", "Freshers", "Documents"],
      audience: ["UI_100_LEVEL_STUDENT"],
      source: "UI Admissions Officer Desk",
      owner: "Academic Affairs Officer",
      status: "PUBLISHED"
    },
    {
      id: "faq_utme_cutoffs",
      question: "How are UI departmental merit cut-off points calculated?",
      answer: "UI uses an aggregate formula combining your UTME score (50%) and Post-UTME screening score (50%), with strict compliance to faculty O'level subject requirements in no more than one sitting for competitive programs.",
      category: "UTME & Admission",
      tags: ["UTME", "Cut-Off", "Admissions"],
      audience: ["UTME_STUDENT"],
      source: "UI Admissions Committee",
      owner: "Undergraduate Admissions Officer",
      status: "PUBLISHED"
    },
    {
      id: "faq_adddrop",
      question: "What is the deadline for course add/drop for 100-Level students?",
      answer: "Course add/drop closes exactly 4 weeks after lecture commencement. You can modify registered courses via the student portal before your departmental adviser signs your final course form.",
      category: "Course Add/Drop",
      tags: ["Courses", "Portal", "Deadline"],
      audience: ["UI_100_LEVEL_STUDENT"],
      source: "UI Portal Administrator",
      owner: "ICT Infrastructure Unit",
      status: "PUBLISHED"
    },
    {
      id: "faq_study_strategy",
      question: "What is the most effective way to practice for CBT examinations?",
      answer: "Practice under strict timed conditions without checking answers until completion. Review incorrect answers thoroughly using detailed step-by-step explanations, and flag weak topics for targeted revision.",
      category: "Exam Strategy",
      tags: ["CBT", "Exam Prep", "Technique"],
      audience: ["UI_100_LEVEL_STUDENT", "UTME_STUDENT"],
      source: "DCN Academic Research Group",
      owner: "Lead Academic Mentor",
      status: "PUBLISHED"
    }
  ];

  for (const faq of ALL_FAQS) {
    await prisma.fAQ.upsert({
      where: { id: faq.id },
      create: faq,
      update: faq
    });
  }
  console.log(`Upserted ${ALL_FAQS.length} FAQs with audience tagging.`);

  console.log("=== AUDIENCE SYNC COMPLETE! ===");
  await prisma.$disconnect();
}

syncAudience().catch(err => {
  console.error("Sync error:", err);
  process.exit(1);
});
