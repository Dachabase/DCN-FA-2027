"""
Populates MongoDB with a representative starter dataset so the frontend has
real data to render against during development.

Run with:
    python -m app.seed.seed_data
"""

import asyncio
from datetime import datetime, timezone

from motor.motor_asyncio import AsyncIOMotorClient

from app.config import get_settings

settings = get_settings()

FACULTIES = [
    {"name": "Faculty of Agriculture", "slug": "agriculture", "category": "STEM & Computing",
     "description": "Agricultural economics, agronomy, animal science and rural development.",
     "icon": "sprout", "color": "#09C82C"},
    {"name": "Faculty of Arts", "slug": "arts", "category": "Arts & Social Sciences",
     "description": "Languages, literature, history and philosophy.",
     "icon": "book-open", "color": "#E66239"},
    {"name": "Faculty of Basic Medical Sciences", "slug": "basic-medical-sciences", "category": "Medical & Health",
     "description": "Anatomy, physiology, biochemistry and pharmacology.",
     "icon": "stethoscope", "color": "#00B8DB"},
    {"name": "Faculty of Clinical Sciences", "slug": "clinical-sciences", "category": "Medical & Health",
     "description": "Medicine & surgery, nursing, physiotherapy and radiography.",
     "icon": "heart-pulse", "color": "#FB2C36"},
    {"name": "Faculty of Computing & IT", "slug": "computing-and-it", "category": "STEM & Computing",
     "description": "Computer science, cybersecurity, IT and software engineering.",
     "icon": "cpu", "color": "#7C3AED"},
    {"name": "Faculty of Dentistry", "slug": "dentistry", "category": "Medical & Health",
     "description": "Dental sciences and oral health.",
     "icon": "smile", "color": "#00B8DB"},
    {"name": "Faculty of Engineering", "slug": "engineering", "category": "STEM & Computing",
     "description": "Civil, electrical, mechanical and computer engineering.",
     "icon": "cog", "color": "#09C82C"},
    {"name": "Faculty of Law", "slug": "law", "category": "Law & Education",
     "description": "Legal studies and jurisprudence.",
     "icon": "scale", "color": "#F0B100"},
    {"name": "Faculty of Science", "slug": "science", "category": "STEM & Computing",
     "description": "Mathematics, physics, chemistry and biology.",
     "icon": "flask-conical", "color": "#7C3AED"},
]

DEPARTMENTS = {
    "computing-and-it": [
        {"name": "Computer Science", "slug": "computer-science"},
        {"name": "Cybersecurity", "slug": "cybersecurity"},
        {"name": "Information Technology", "slug": "information-technology"},
        {"name": "Software Engineering", "slug": "software-engineering"},
    ],
    "arts": [
        {"name": "English Language & Literature", "slug": "english"},
        {"name": "History", "slug": "history"},
        {"name": "Philosophy", "slug": "philosophy"},
    ],
    "clinical-sciences": [
        {"name": "Medicine & Surgery (MBBS)", "slug": "mbbs"},
        {"name": "Nursing Science", "slug": "nursing-science"},
        {"name": "Physiotherapy", "slug": "physiotherapy"},
    ],
}

COURSES = {
    "computer-science": [
        {"code": "CSC101", "title": "Introduction to Computer Science", "units": 3, "semester": 1,
         "course_type": "compulsory", "has_cbt_practice": True,
         "description": "Binary arithmetic, logic circuits, operating system fundamentals, and introductory Python."},
        {"code": "MAT111", "title": "Algebra and Trigonometry", "units": 3, "semester": 1,
         "course_type": "compulsory", "has_cbt_practice": True,
         "description": "Quadratic equations, polynomials, mathematical induction, sequences, and trigonometry."},
        {"code": "GST101", "title": "Use of English I", "units": 2, "semester": 1,
         "course_type": "general_study", "has_cbt_practice": True,
         "description": "Sentence structure, grammar rules, vocabulary building, and reading comprehension."},
        {"code": "GES107", "title": "Nigerian Peoples and Culture", "units": 2, "semester": 1,
         "course_type": "general_study", "has_cbt_practice": True,
         "description": "Nok culture, Nigerian history, pre-colonial civilizations, and socio-cultural evolution."},
        {"code": "PHY101", "title": "General Physics I (Mechanics)", "units": 3, "semester": 1,
         "course_type": "faculty_core", "has_cbt_practice": True,
         "description": "Vectors, kinematics, Newton's laws of motion, work, energy, and gravitation."},
        {"code": "CHM101", "title": "General Chemistry I", "units": 3, "semester": 1,
         "course_type": "faculty_core", "has_cbt_practice": True,
         "description": "Atomic theory, electronic configurations, chemical bonding, and stoichiometry."},
    ],
}

GUIDES = [
    {"title": "UI Senate Examination Rules, Regulations & Malpractice Penalties",
     "slug": "ui-senate-examination-rules", "category": "Exam Prep",
     "summary": "Senate rules governing semester examinations, continuous assessments, the 75% attendance rule, and examination conduct.",
     "content": "Full guide content goes here.", "read_time_minutes": 4, "verified": True},
    {"title": "Kenneth Dike Library (KDL) Orientation & Digital Access Guide",
     "slug": "kdl-orientation-guide", "category": "Campus Navigation",
     "summary": "How to register your KDL library card, access physical books, use digital databases (JSTOR, ScienceDirect), and quiet study carrels.",
     "content": "Full guide content goes here.", "read_time_minutes": 6, "verified": True},
    {"title": "UI Add and Drop Policy & Portal Change of Course Procedure",
     "slug": "add-drop-policy", "category": "Course Registration",
     "summary": "Official rules, portal deadlines, and procedure for adding or dropping 100-Level courses without academic penalty.",
     "content": "Full guide content goes here.", "read_time_minutes": 5, "verified": True},
    {"title": "Understanding the UI 5.0 CGPA Grading System",
     "slug": "cgpa-grading-system", "category": "Grading System",
     "summary": "Comprehensive guide to grade points, semester GPA calculation, probation limits, and degree classification.",
     "content": "Full guide content goes here.", "read_time_minutes": 5, "verified": True},
]

RESOURCES = [
    {"title": "100L Complete Academic Resource Drive (All Folders)",
     "description": "Central Google Drive folder containing all verified 100-Level lecture slides, textbooks, tutorial sheets, and past questions.",
     "category": "Academic", "source_label": "Google Drive", "link": "https://drive.google.com/"},
    {"title": "CSC101: Introduction to Computer Science Slides & Handouts",
     "description": "Binary arithmetic, logic circuits, operating system fundamentals, and introductory Python programming materials.",
     "category": "Academic", "source_label": "Google Drive", "link": "https://drive.google.com/", "course_code": "CSC101"},
    {"title": "UI Official Academic Calendar (2025/2026 Session)",
     "description": "Official senate calendar with semester dates, registration deadlines, matriculation schedule, and exam periods.",
     "category": "Administrative", "source_label": "Google Drive", "link": "https://drive.google.com/"},
]

OPPORTUNITIES = [
    {"title": "Federal Government Student Loan Scheme (NELFUND)", "type": "Scholarship",
     "description": "100% tuition fees coverage plus monthly upkeep allowance for enrolled Nigerian undergraduate students.",
     "deadline": "2026-06-30", "link": "https://nelfund.gov.ng/"},
    {"title": "MTN Foundation Science & Technology Scholarship 2026", "type": "Scholarship",
     "description": "Annual ₦200,000 grant awarded to 200L+ high-performing students studying STEM courses in Nigerian public universities.",
     "deadline": "2026-05-30", "link": "https://mtnonline.com/"},
    {"title": "University of Ibadan Student Work-Study Program", "type": "Work-Study",
     "description": "Earn up to ₦35,000 monthly working flexible hours (max 2 hours daily) in university libraries, ICT centers, or administrative offices.",
     "deadline": "2026-04-10", "link": "https://ui.edu.ng/"},
]

FAQS = [
    {"question": "How do I complete my physical departmental clearance at UI?",
     "answer": "Visit your department with your acceptance fee receipt, JAMB result slip, and medical clearance file. Full checklist is in the Resources section.",
     "order": 1},
    {"question": "What is the deadline for course add/drop for the current semester?",
     "answer": "Typically the end of the third week of the semester. Always confirm the exact date on the UI portal.",
     "order": 2},
    {"question": "How is hostel accommodation allocated for 100 Level freshers?",
     "answer": "Allocation is done via the UI hostel portal after acceptance fee payment, on a first-come, first-served basis subject to availability.",
     "order": 3},
]


async def seed() -> None:
    client = AsyncIOMotorClient(settings.mongodb_uri)
    db = client[settings.mongodb_db_name]

    print("Seeding faculties...")
    faculty_slug_to_id = {}
    for faculty in FACULTIES:
        result = await db.faculties.update_one(
            {"slug": faculty["slug"]}, {"$set": faculty}, upsert=True
        )
        doc = await db.faculties.find_one({"slug": faculty["slug"]})
        faculty_slug_to_id[faculty["slug"]] = doc["_id"]

    print("Seeding departments...")
    department_slug_to_id = {}
    for faculty_slug, departments in DEPARTMENTS.items():
        faculty_id = faculty_slug_to_id[faculty_slug]
        for dept in departments:
            await db.departments.update_one(
                {"faculty_id": faculty_id, "slug": dept["slug"]},
                {"$set": {**dept, "faculty_id": faculty_id}},
                upsert=True,
            )
            doc = await db.departments.find_one({"faculty_id": faculty_id, "slug": dept["slug"]})
            department_slug_to_id[dept["slug"]] = doc["_id"]

    print("Seeding courses...")
    for department_slug, courses in COURSES.items():
        department_id = department_slug_to_id[department_slug]
        for course in courses:
            await db.courses.update_one(
                {"department_id": department_id, "code": course["code"]},
                {"$set": {**course, "department_id": department_id, "level": "100L"}},
                upsert=True,
            )

    print("Seeding guides...")
    now = datetime.now(timezone.utc)
    for guide in GUIDES:
        await db.guides.update_one(
            {"slug": guide["slug"]},
            {"$set": {**guide, "cover_image": None, "updated_at": now}, "$setOnInsert": {"created_at": now}},
            upsert=True,
        )

    print("Seeding resources...")
    for resource in RESOURCES:
        await db.resources.update_one(
            {"title": resource["title"]}, {"$set": resource}, upsert=True
        )

    print("Seeding opportunities...")
    for opp in OPPORTUNITIES:
        await db.opportunities.update_one(
            {"title": opp["title"]}, {"$set": opp}, upsert=True
        )

    print("Seeding FAQs...")
    for faq in FAQS:
        await db.faqs.update_one(
            {"question": faq["question"]}, {"$set": faq}, upsert=True
        )

    print("Done seeding.")
    client.close()


if __name__ == "__main__":
    asyncio.run(seed())
