import glob
import re
import json
import os
import sys

sys.stdout.reconfigure(encoding='utf-8')

FOUNDATIONAL_GUIDES = [
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

CATEGORY_MAP = {
    "academics": "Academics",
    "balancing-work-and-school": "Work & School",
    "finances": "Finances",
    "hostel-and-accommodation": "Hostel & Housing",
    "mental-health": "Mental Health"
}

def parse_frontmatter(fm_text):
    data = {}
    lines = fm_text.splitlines()
    i = 0
    while i < len(lines):
        line = lines[i]
        m = re.match(r'^([a-zA-Z0-9_-]+):\s*(.*)$', line)
        if m:
            key = m.group(1).strip()
            val = m.group(2).strip()
            
            if val == "":
                items = []
                current_item = None
                i += 1
                while i < len(lines):
                    subline = lines[i]
                    if subline.startswith("  - question:"):
                        if current_item:
                            items.append(current_item)
                        q_val = subline.replace("  - question:", "").strip().strip('"\'')
                        current_item = {"question": q_val, "answer": ""}
                    elif subline.startswith("    answer:") and current_item:
                        a_val = subline.replace("    answer:", "").strip().strip('"\'')
                        current_item["answer"] = a_val
                    elif subline.startswith("    ") and current_item and current_item.get("answer"):
                        current_item["answer"] += " " + subline.strip().strip('"\'')
                    elif re.match(r'^[a-zA-Z0-9_-]+:', subline):
                        i -= 1
                        break
                    i += 1
                if current_item:
                    items.append(current_item)
                data[key] = items
            else:
                if (val.startswith('"') and val.endswith('"')) or (val.startswith("'") and val.endswith("'")):
                    val = val[1:-1]
                data[key] = val
        i += 1
    return data

def main():
    print("🚀 Starting Systematic Ingestion of articles/ ...")
    
    # 1. Load existing guides from src/data/guides.json if exists
    existing_guides = []
    if os.path.exists("src/data/guides.json"):
        with open("src/data/guides.json", "r", encoding="utf-8") as f:
            existing_guides = json.load(f)
        print(f"📦 Loaded {len(existing_guides)} existing guides from src/data/guides.json")

    # Combine foundational guides with existing guides (avoiding duplicates)
    existing_dict = {}
    for g in FOUNDATIONAL_GUIDES + existing_guides:
        existing_dict[g["id"]] = g

    print(f"📦 Total existing base guides: {len(existing_dict)}")

    # 2. Ingest articles from articles/*.md
    article_files = sorted(glob.glob("articles/*.md"))
    print(f"🔍 Discovered {len(article_files)} markdown articles in articles/")

    new_articles = []
    category_counts = {}

    for fpath in article_files:
        with open(fpath, "r", encoding="utf-8") as fp:
            text = fp.read()

        m = re.match(r'^---\s*\n(.*?)\n---\s*\n(.*)$', text, re.DOTALL)
        if not m:
            print(f"⚠️ Warning: No frontmatter found in {fpath}")
            continue

        fm_raw = m.group(1)
        body = m.group(2).strip()

        parsed = parse_frontmatter(fm_raw)
        title = parsed.get("title", "").strip()
        slug = parsed.get("slug", "").strip()
        raw_cat = parsed.get("category", "academics").strip().lower()
        normalized_cat = CATEGORY_MAP.get(raw_cat, "Academics")
        summary = parsed.get("description", "").strip()
        author = parsed.get("author", "Itoya David").strip()
        author_role = parsed.get("author_role", "Academic Strategist & Founder").strip()
        date_pub = parsed.get("date_published", "2026-09-26").strip()
        read_time = parsed.get("read_time") or parsed.get("reading_time", "8 min read")
        featured_image = parsed.get("featured_image") or parsed.get("image", "")
        featured_image_alt = parsed.get("featured_image_alt", "")
        faqs = parsed.get("faq") or parsed.get("faqs") or []

        # Strip duplicate H1 from beginning of body if identical to title
        body_lines = body.splitlines()
        if body_lines and body_lines[0].startswith("# ") and body_lines[0][2:].strip().lower() == title.lower():
            body = "\n".join(body_lines[1:]).strip()

        guide_id = f"guide_{slug}"

        article_guide = {
            "id": guide_id,
            "title": title,
            "summary": summary,
            "content": body,
            "category": normalized_cat,
            "status": "PUBLISHED",
            "facultyId": None,
            "faculty": None,
            "departmentId": None,
            "department": None,
            "source": f"{author} ({author_role})",
            "owner": "DCN Academic Editorial Desk",
            "verifiedDate": f"{date_pub}T00:00:00.000Z",
            "seriesId": None,
            "seriesTitle": None,
            "seriesOrder": None,
            "seriesTotal": None,
            "slug": slug,
            "rawCategory": raw_cat,
            "author": author,
            "authorRole": author_role,
            "readTime": read_time,
            "featuredImage": featured_image,
            "featuredImageAlt": featured_image_alt,
            "faqs": faqs
        }

        category_counts[normalized_cat] = category_counts.get(normalized_cat, 0) + 1
        new_articles.append(article_guide)

    print("\n📊 Ingested Articles by Category:")
    for cat, count in sorted(category_counts.items()):
        print(f"  • {cat}: {count} articles")

    # Merge into complete guides dictionary
    for ag in new_articles:
        existing_dict[ag["id"]] = ag

    all_guides_list = list(existing_dict.values())
    print(f"\n✨ Total combined platform guides/articles: {len(all_guides_list)}")

    # 3. Write src/data/guides.json
    output_json_path = "src/data/guides.json"
    with open(output_json_path, "w", encoding="utf-8") as f:
        json.dump(all_guides_list, f, indent=2, ensure_ascii=False)
    print(f"✅ Saved full dataset to {output_json_path} ({os.path.getsize(output_json_path):,} bytes)")

    # 4. Write src/data/guides-data.ts
    output_ts_path = "src/data/guides-data.ts"
    ts_code = f"""// AUTO-GENERATED GUIDES & BLOG ARTICLES DATASET
// Contains {len(all_guides_list)} verified guides and published campus articles with full-text markdown.
// Generated systematically from foundational packages and articles/ repository.

export interface GuideFaq {{
  question: string;
  answer: string;
}}

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
  slug?: string;
  rawCategory?: string;
  author?: string;
  authorRole?: string;
  readTime?: string;
  featuredImage?: string;
  featuredImageAlt?: string;
  faqs?: GuideFaq[];
}}

export const ALL_GUIDES: GuideItem[] = {json.dumps(all_guides_list, indent=2, ensure_ascii=False)};
"""
    with open(output_ts_path, "w", encoding="utf-8") as f:
        f.write(ts_code)
    print(f"✅ Generated TypeScript dataset at {output_ts_path} ({os.path.getsize(output_ts_path):,} bytes)")

    # 5. Write incremental database seeding script
    seeder_ts_path = "scripts/seed_articles.ts"
    seeder_code = """import "dotenv/config";
import { prisma } from "../src/database/prisma";
import { ALL_GUIDES } from "../src/data/guides-data";

async function seedArticles() {
  console.log(`🌱 Seeding ${ALL_GUIDES.length} platform guides and blog articles into PostgreSQL...`);
  
  let createdCount = 0;
  let updatedCount = 0;

  for (const g of ALL_GUIDES) {
    try {
      const existing = await prisma.guide.findUnique({
        where: { id: g.id }
      });

      if (!existing) {
        await prisma.guide.create({
          data: {
            id: g.id,
            title: g.title,
            summary: g.summary,
            content: g.content,
            category: g.category,
            status: g.status || "PUBLISHED",
            facultyId: g.facultyId || null,
            departmentId: g.departmentId || null,
            seriesId: g.seriesId || null,
            seriesTitle: g.seriesTitle || null,
            seriesOrder: g.seriesOrder || null,
            seriesTotal: g.seriesTotal || null,
            source: g.source,
            owner: g.owner,
            verifiedDate: g.verifiedDate ? new Date(g.verifiedDate) : new Date(),
          }
        });
        createdCount++;
      } else {
        await prisma.guide.update({
          where: { id: g.id },
          data: {
            title: g.title,
            summary: g.summary,
            content: g.content,
            category: g.category,
            status: g.status || "PUBLISHED",
            source: g.source,
            owner: g.owner,
            verifiedDate: g.verifiedDate ? new Date(g.verifiedDate) : new Date(),
          }
        });
        updatedCount++;
      }
    } catch (err: any) {
      console.warn(`Warning upserting guide ${g.id}:`, err.message);
    }
  }

  const totalInDb = await prisma.guide.count();
  console.log(`✅ Database Seeding Complete!`);
  console.log(`   • Created: ${createdCount}`);
  console.log(`   • Updated: ${updatedCount}`);
  console.log(`   • Total Guides in Database: ${totalInDb}`);
}

seedArticles()
  .catch((e) => {
    console.error("❌ Seeding failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    process.exit(0);
  });
"""
    with open(seeder_ts_path, "w", encoding="utf-8") as f:
        f.write(seeder_code)
    print(f"✅ Generated Database Seeder at {seeder_ts_path}")

if __name__ == '__main__':
    main()
