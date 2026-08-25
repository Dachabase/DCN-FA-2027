import json
import os

GUIDES_JSON = "/Users/daviditoya/Downloads/SBAI4FA27/src/data/guides.json"
OUTPUT_TS = "/Users/daviditoya/Downloads/SBAI4FA27/src/data/guides-data.ts"

with open(GUIDES_JSON, "r", encoding="utf-8") as f:
    ingested_guides = json.load(f)

# Foundational registration/campus guides
foundational_guides = [
    {
        "id": "guide_100l_reg",
        "title": "100L Course Registration & Subject Combination Guide",
        "summary": "Step-by-step walkthrough for registering 100L compulsory and elective courses at UI, credit load limits, and course adviser validation.",
        "content": """## 1. Overview of 100-Level Course Registration

Welcome to the University of Ibadan! Course registration is the foundational academic activity for every fresh undergraduate. Completing your registration correctly ensures your Continuous Assessment (CA) scores, attendance records, and examination clearance are properly captured on the Senate portal.

---

## 2. University General Courses (Compulsory Block)

All 100-Level undergraduates across all 18 faculties are required to register and pass the following General Studies (GST/GES) courses:

- **GST 111 (Use of English I)** — 2 Units (1st Semester): Communication in English, academic reading, essay writing, comprehension, and library reference skills.
- **GST 112 (Use of English II)** — 2 Units (2nd Semester): Logical composition, argumentation, scientific and technical writing conventions.
- **GES 107 (Philosophy and Logic)** — 2 Units (1st Semester): Fundamental principles of symbolic logic, deduction, fallacies, and philosophical reasoning.
- **GST 113 (Nigerian Peoples and Culture)** — 2 Units: History, sociopolitical structure, and cultural heritage of Nigerian ethnic groups.

---

## 3. Step-by-Step Portal Workflow

Follow these exact steps on the UI Undergraduate Portal:

1. **Log in to Portal:** Navigate to `https://portal.ui.edu.ng` using your Matriculation Number or JAMB Registration Number and password.
2. **Fee Verification:** Ensure your Acceptance Fee and Session School Fees are marked as **PAID** with receipt status verified.
3. **Course Selection:** Select your faculty and department. Check all compulsory 100L departmental courses and university-wide GST courses.
4. **Credit Unit Validation:** Ensure your total semester units fall strictly between **15 units (minimum)** and **24 units (maximum)**.
5. **Submit for Vetting:** Click "Submit for Departmental Approval". Do not leave your courses in "Draft" state.
6. **Course Adviser Endorsement:** Meet your Level Adviser at your department with your course slip draft for physical endorsement.
7. **Final Printout:** Once approved, print **four (4) copies of Form 01 (Course Registration Form)**.

---

## 4. Form 01 Distribution Checklist

- Copy 1: Faculty Officer / Sub-Dean's Office
- Copy 2: Departmental Head / Level Adviser
- Copy 3: Academic Affairs Secretariat
- Copy 4: Student Personal File (Keep safely for final graduation clearance!)

> [!IMPORTANT]
> **Deadline Notice:** Late course registration carries a mandatory penalty fee. Unregistered students will NOT be issued examination dockets or permitted into CBT exam venues.""",
        "category": "Course Registration",
        "status": "PUBLISHED",
        "facultyId": None,
        "faculty": None,
        "source": "UI Academic Affairs Secretariat & Faculty Handbook",
        "owner": "UI Academic Secretariat",
        "seriesId": None,
        "seriesTitle": None,
        "seriesOrder": None,
        "seriesTotal": None
    },
    {
        "id": "guide_cgpa",
        "title": "Understanding the UI 5.0 CGPA Grading System & Academic Standing",
        "summary": "Comprehensive guide to grade points, semester GPA calculation, probation limits, and degree classifications on UI's 5.0 scale.",
        "content": """## 1. The University of Ibadan 5.0 CGPA Scale

The University of Ibadan calculates academic standing using the 5-point Cumulative Grade Point Average (CGPA) system. Understanding how your grade points are computed is essential for academic strategy.

---

## 2. Official UI Grade Point Table

| Score Range (%) | Letter Grade | Grade Point (GP) | Rating |
| :--- | :--- | :--- | :--- |
| **70% – 100%** | **A** | **5.0** | Excellent |
| **60% – 69%** | **B** | **4.0** | Very Good |
| **50% – 59%** | **C** | **3.0** | Good |
| **45% – 49%** | **D** | **2.0** | Fair / Pass |
| **40% – 44%** | **E** | **1.0** | Bare Pass |
| **0% – 39%** | **F** | **0.0** | Fail |

---

## 3. How GPA & CGPA are Calculated

- **Grade Point Equivalent (GPE):** Course Units × Grade Point earned.
  *Example:* An **A (5.0)** in a 3-unit course (CSC 101) gives **3 × 5.0 = 15.0 GPE**.
- **Grade Point Average (GPA):** Total GPE divided by Total Registered Units in that semester.
- **Cumulative GPA (CGPA):** Total Cumulative GPE earned across all semesters divided by Total Cumulative Units registered.

---

## 4. Degree Classification Benchmarks

- **4.50 – 5.00** : First Class Honours
- **3.50 – 4.49** : Second Class Honours (Upper Division)
- **2.40 – 3.49** : Second Class Honours (Lower Division)
- **1.50 – 2.39** : Third Class Honours
- **1.00 – 1.49** : Pass Degree

> [!TIP]
> **Strategic Freshers Tip:** Your 100-Level courses represent the highest volume of fundamental units. Securing an A/B grade foundation in 100L creates a resilient buffer that protects your CGPA throughout 200L to 400L.""",
        "category": "Grading System",
        "status": "PUBLISHED",
        "facultyId": None,
        "faculty": None,
        "source": "UI Academic Regulations Handbook & Senate Bulletin",
        "owner": "UI Academic Senate",
        "seriesId": None,
        "seriesTitle": None,
        "seriesOrder": None,
        "seriesTotal": None
    },
    {
        "id": "guide_venues",
        "title": "Lecture Venues & Campus Navigation Map",
        "summary": "Locate Large Lecture Theatres (LLT), ICT Center, Science Lecture Theater, Faculty labs, and campus complexes.",
        "content": """## 1. Campus Geography & Key Lecture Venues

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
  - SUB to Tech Quadrangle: ~8 minutes walk""",
        "category": "Lecture Venues",
        "status": "PUBLISHED",
        "facultyId": None,
        "faculty": None,
        "source": "UI Physical Planning & Campus Security Directorate",
        "owner": "UI Students Affairs Division",
        "seriesId": None,
        "seriesTitle": None,
        "seriesOrder": None,
        "seriesTotal": None
    }
]

all_guides = foundational_guides + ingested_guides

ts_content = f"""// AUTO-GENERATED GUIDES DATASET
// Contains {len(all_guides)} complete in-app guides with full-text content and series linking.

export interface GuideItem {{
  id: string;
  title: string;
  summary: string;
  content: string;
  category: string;
  status: string;
  facultyId?: string | null;
  faculty?: {{ id: string; name: string; code?: string }} | null;
  departmentId?: string | null;
  department?: {{ id: string; name: string }} | null;
  source: string;
  owner: string;
  verifiedDate?: string;
  seriesId?: string | null;
  seriesTitle?: string | null;
  seriesOrder?: number | null;
  seriesTotal?: number | null;
}}

export const ALL_GUIDES: GuideItem[] = {json.dumps(all_guides, indent=2, ensure_ascii=False)};
"""

with open(OUTPUT_TS, "w", encoding="utf-8") as f:
    f.write(ts_content)

print(f"✅ Generated {OUTPUT_TS} with {len(all_guides)} guides.")
