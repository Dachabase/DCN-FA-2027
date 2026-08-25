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

// Trust reverse proxies (Render, AWS ALB/CloudFront) for secure HTTPS cookies
app.set("trust proxy", 1);

app.use(cors({ origin: true, credentials: true }));
app.use(cookieParser());
app.use(express.json());

// Auth & Personalization Routes
app.use("/api/auth", authRouter);
app.use("/auth", authRouter);
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
    facultyId: "fac_computing",
    faculty: { id: "fac_computing", name: "Computing" },
    department: { id: "dept_csai", name: "Computer Science and AI" },
    source: "UI Academic Affairs Secretariat & Faculty of Computing Handbook",
    owner: "Office of the Dean, Faculty of Computing",
    verifiedDate: "2026-01-15T00:00:00.000Z",
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
    facultyId: "fac_computing",
    faculty: { id: "fac_computing", name: "Computing" },
    source: "UI Academic Regulations Handbook & Senate Bulletin",
    owner: "UI Academic Senate",
    verifiedDate: "2026-01-20T00:00:00.000Z",
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
    facultyId: "fac_computing",
    faculty: { id: "fac_computing", name: "Computing" },
    source: "UI Directorate of Physical Planning & Student Affairs",
    owner: "Directorate of Physical Planning",
    verifiedDate: "2026-02-01T00:00:00.000Z",
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
    verifiedDate: "2026-01-10T00:00:00.000Z",
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
    verifiedDate: "2026-01-18T00:00:00.000Z",
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
    verifiedDate: "2026-01-25T00:00:00.000Z",
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
    verifiedDate: "2026-02-05T00:00:00.000Z",
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
    verifiedDate: "2026-02-10T00:00:00.000Z",
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

// GET /api/faculties/:id/guides and /api/guides (Protected)
const getGuidesHandler = async (req: Request, res: Response) => {
  try {
    const facultyId = req.params.id ? String(req.params.id) : (req.query.facultyId ? String(req.query.facultyId) : "all");
    const category = req.query.category ? String(req.query.category) : null;
    
    const whereClause: any = { status: "PUBLISHED" };
    if (facultyId !== "all") {
      whereClause.OR = [{ facultyId }, { facultyId: null }];
    }
    if (category && category !== "ALL") {
      whereClause.category = category;
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
      const formatted = guides.map(g => ({
        ...g,
        body: g.content,
        verified: g.status === "PUBLISHED",
      }));
      return res.json({ success: true, data: formatted });
    }
  } catch (error) {
    console.warn("DB error, serving fallback guides.");
  }

  const facultyId = req.params.id ? String(req.params.id) : "all";
  let fallbackList = FALLBACK_GUIDES;
  if (facultyId !== "all") {
    fallbackList = FALLBACK_GUIDES.filter(g => !g.facultyId || g.facultyId === facultyId || g.faculty?.id === facultyId);
  }
  const formatted = fallbackList.map(g => ({
    ...g,
    body: g.content,
    verified: g.status === "PUBLISHED",
  }));
  res.json({ success: true, data: formatted });
};

app.get("/api/faculties/:id/guides", requireAuth, getGuidesHandler);
app.get("/api/guides", requireAuth, getGuidesHandler);

// GET /api/guides/:id (Protected)
app.get("/api/guides/:id", requireAuth, async (req: Request, res: Response) => {
  const guideId = String(req.params.id);
  try {
    const guide = await prisma.guide.findUnique({
      where: { id: guideId },
      include: {
        faculty: { select: { id: true, name: true, code: true } },
        department: { select: { id: true, name: true } },
      },
    });

    if (guide) {
      // Async interaction logging
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

      return res.json({
        success: true,
        data: {
          ...guide,
          body: guide.content,
          verified: guide.status === "PUBLISHED",
        }
      });
    }
  } catch (error) {
    console.warn("DB error fetching guide.");
  }

  const fallbackGuide = FALLBACK_GUIDES.find(g => g.id === guideId) || FALLBACK_GUIDES[0];
  res.json({
    success: true,
    data: {
      ...fallbackGuide,
      body: fallbackGuide.content,
      verified: fallbackGuide.status === "PUBLISHED",
    }
  });
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

// Keep-alive cron / self-pinger to prevent Render spin-down
function initKeepAliveService() {
  const externalUrl = process.env.RENDER_EXTERNAL_URL || process.env.APP_URL;
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
  console.log(`UI Freshers Companion Backend API running on http://localhost:${PORT}`);
  initKeepAliveService();
  startComputingBot().catch((err) => {
    console.error("Telegram Bot failed to start:", err);
  });
});
