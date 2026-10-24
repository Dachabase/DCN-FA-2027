import re

ingest_script_path = "/Users/daviditoya/Downloads/SBAI4FA27/scripts/ingest_guides.py"

with open(ingest_script_path, "r", encoding="utf-8") as f:
    content = f.read()

# Replace Education titles
content = content.replace(
    '"title": "Faculty of Education Freshers Guide — Part 1 of 3: The Educator\'s Mindset & Academic Reality"',
    '"title": "Faculty of Education: The Educator\'s Mindset & Academic Reality"'
)
content = content.replace(
    '"title": "Faculty of Education Freshers Guide — Part 2 of 3: Departmental Blueprints (Adult Ed, Guidance & Counselling, LARIS, Special Ed)"',
    '"title": "Faculty of Education: Adult Ed, Guidance & Counselling, LARIS, Special Ed"'
)
content = content.replace(
    '"title": "Faculty of Education Freshers Guide — Part 3 of 3: Departmental Blueprints & Beyond Teaching (ASE, ECEF, EM, STE)"',
    '"title": "Faculty of Education: Arts & Social Sciences, Educational Management, KHE, Science & Tech Ed"'
)

# Replace GGHT splits
old_gght_splits = """    gght_splits = [
        (0, 115, "Part 1 of 8: The Philosophy of Difficulty & Why Hard Things Matter", "Understanding why doing difficult things transforms intellect and setting the philosophical foundation for academic and personal mastery."),
        (115, 226, "Part 2 of 8: The Architecture of Deliberate Practice & Skill Acquisition", "How true expertise is developed through targeted, uncomfortable practice rather than mindless repetition."),
        (226, 336, "Part 3 of 8: Cognitive Load, Focus & Memory Systems", "Eliminating mental fragmentation, managing cognitive load, and constructing environments optimized for uninterrupted deep work."),
        (336, 476, "Part 4 of 8: The Friction of Resistance & Overcoming Mental Blocks", "Deconstructing procrastination, psychological resistance, and the mechanisms needed to initiate hard tasks effortlessly."),
        (476, 630, "Part 5 of 8: Compounding Knowledge & The Long Game", "How consistent intellectual investments compound exponentially over your university journey."),
        (630, 825, "Part 6 of 8: The High Performer's Daily Operating System", "The complete daily routine, energy management, and execution checklist for top-tier academic performers."),
        (825, 900, "Part 7 of 8: Deep Work, Sleep & Time Management Mastery (FAQ)", "Addressing critical questions on sleep schedules, lecture fatigue, focus blocks, and time management."),
        (900, len(gght_paras), "Part 8 of 8: Exam Recovery, Scale Group & Long-Term Mastery (FAQ)", "How to recover from bad exam scores, staying motivated throughout university, and building long-term career momentum.")
    ]"""

new_gght_splits = """    gght_splits = [
        (0, 115, "The Philosophy of Difficulty & Why Hard Things Matter", "Understanding why doing difficult things transforms intellect and setting the philosophical foundation for academic and personal mastery."),
        (115, 226, "The Architecture of Deliberate Practice & Skill Acquisition", "How true expertise is developed through targeted, uncomfortable practice rather than mindless repetition."),
        (226, 336, "Cognitive Load, Focus & Memory Systems", "Eliminating mental fragmentation, managing cognitive load, and constructing environments optimized for uninterrupted deep work."),
        (336, 476, "The Friction of Resistance & Overcoming Mental Blocks", "Deconstructing procrastination, psychological resistance, and the mechanisms needed to initiate hard tasks effortlessly."),
        (476, 630, "Compounding Knowledge & The Long Game", "How consistent intellectual investments compound exponentially over your university journey."),
        (630, 825, "The High Performer's Daily Operating System", "The complete daily routine, energy management, and execution checklist for top-tier academic performers."),
        (825, 900, "Deep Work, Sleep & Time Management Mastery (FAQ)", "Addressing critical questions on sleep schedules, lecture fatigue, focus blocks, and time management."),
        (900, len(gght_paras), "Exam Recovery, Scale Group & Long-Term Mastery (FAQ)", "How to recover from bad exam scores, staying motivated throughout university, and building long-term career momentum.")
    ]"""

content = content.replace(old_gght_splits, new_gght_splits)
content = content.replace('"title": f"Get Good at Hard Things — {p_title}"', '"title": f"Get Good at Hard Things: {p_title}"')

# Replace Business splits
old_biz_splits = """    biz_splits = [
        (0, 128, "Part 1 of 3: The Truth About Balance & The Hurricane Life", "Debunking 50/50 balance myths, conducting energy audits, and establishing boundaries between coursework and commerce."),
        (128, 260, "Part 2 of 3: The System — High-Yield Academics & Business Automation", "Applying 80/20 leverage to lectures, batching client orders, and setting up automated customer communication."),
        (260, len(biz_paras), "Part 3 of 3: The Implementation — Exam Season Protocols & Scaling Safely", "Navigating exam season lockdown, delegating tasks, managing stress, and sustaining both high CGPA and enterprise revenue.")
    ]"""

new_biz_splits = """    biz_splits = [
        (0, 128, "The Truth About Balance & The Hurricane Life", "Debunking 50/50 balance myths, conducting energy audits, and establishing boundaries between coursework and commerce."),
        (128, 260, "The System: High-Yield Academics & Business Automation", "Applying 80/20 leverage to lectures, batching client orders, and setting up automated customer communication."),
        (260, len(biz_paras), "The Implementation: Exam Season Protocols & Scaling Safely", "Navigating exam season lockdown, delegating tasks, managing stress, and sustaining both high CGPA and enterprise revenue.")
    ]"""

content = content.replace(old_biz_splits, new_biz_splits)
content = content.replace('"title": f"How to Balance Academics and Business — {title_part}"', '"title": f"How to Balance Academics and Business: {title_part}"')

# Replace Exam splits
old_exam_splits = """    exam_splits = [
        (0, 127, "Part 1 of 3: The Strategy — Study Smart, Not Just Hard", "The broken student syndrome, cognitive encoding, active recall methods, and avoiding passive revision traps."),
        (127, 181, "Part 2 of 3: The System — Energy, Spaced Repetition & Power Hours", "Structuring focused 60-minute power blocks, circadian rhythm alignment, and interleaving difficult subjects."),
        (181, len(exam_paras), "Part 3 of 3: The Execution — Past Questions, Marking Schemes & Exam Room Tactics", "Reverse-engineering examiner psychology, writing high-scoring answers, and managing time under exam hall pressure.")
    ]"""

new_exam_splits = """    exam_splits = [
        (0, 127, "Study Smart, Not Just Hard", "The broken student syndrome, cognitive encoding, active recall methods, and avoiding passive revision traps."),
        (127, 181, "Energy, Spaced Repetition & Power Hours", "Structuring focused 60-minute power blocks, circadian rhythm alignment, and interleaving difficult subjects."),
        (181, len(exam_paras), "Past Questions, Marking Schemes & Exam Room Tactics", "Reverse-engineering examiner psychology, writing high-scoring answers, and managing time under exam hall pressure.")
    ]"""

content = content.replace(old_exam_splits, new_exam_splits)
content = content.replace('"title": f"How to Pass Any Exam with High Scores — {title_part}"', '"title": f"How to Pass Any Exam with High Scores: {title_part}"')

# Replace ROL splits
old_rol_splits = """    rol_splits = [
        (0, 199, "Part 1 of 3: The Foundation — Curing the Illusion of Competence", "Why highlighting and re-reading fail, and how starting with target exam outcomes and past questions reshapes comprehension."),
        (199, 316, "Part 2 of 3: The System — Routine, Managing Distractions & True Balance", "Building an unshakeable daily study routine, taming digital distractions, and understanding rest as an academic weapon."),
        (316, len(rol_paras), "Part 3 of 3: The Implementation — The Result-Oriented System & Overcoming Setbacks", "The complete operational learning algorithm, recovery protocols when falling behind, and execution masterclass.")
    ]"""

new_rol_splits = """    rol_splits = [
        (0, 199, "Curing the Illusion of Competence", "Why highlighting and re-reading fail, and how starting with target exam outcomes and past questions reshapes comprehension."),
        (199, 316, "Routine, Managing Distractions & True Balance", "Building an unshakeable daily study routine, taming digital distractions, and understanding rest as an academic weapon."),
        (316, len(rol_paras), "The Result-Oriented System & Overcoming Setbacks", "The complete operational learning algorithm, recovery protocols when falling behind, and execution masterclass.")
    ]"""

content = content.replace(old_rol_splits, new_rol_splits)
content = content.replace('"title": f"Result-Oriented Learning — {title_part}"', '"title": f"Result-Oriented Learning: {title_part}"')

# Replace MMO splits
old_mmo_splits = """    mmo_splits = [
        (0, 143, "Part 1 of 3: Mindset & Digital Opportunities", "Real student financial success stories, shifting from consumer to creator, and choosing a monetization model."),
        (143, 188, "Part 2 of 3: The Roadmap — From Zero to First Income", "High-income skills (copywriting, design, tech support), client acquisition on campus and online, and packaging offerings."),
        (188, len(mmo_paras), "Part 3 of 3: The Fast Track — Growth, Automation & Mentorship", "Leveraging mentors, relentless practice, expanding capabilities, and scaling to consistent cash flow.")
    ]"""

new_mmo_splits = """    mmo_splits = [
        (0, 143, "Mindset & Digital Opportunities for Students", "Real student financial success stories, shifting from consumer to creator, and choosing a monetization model."),
        (143, 188, "From Zero to First Income (The Skill Roadmap)", "High-income skills (copywriting, design, tech support), client acquisition on campus and online, and packaging offerings."),
        (188, len(mmo_paras), "Growth, Automation & Scaling Mentorship", "Leveraging mentors, relentless practice, expanding capabilities, and scaling to consistent cash flow.")
    ]"""

content = content.replace(old_mmo_splits, new_mmo_splits)
content = content.replace('"title": f"The Easiest Ways to Make Money Online — {title_part}"', '"title": f"The Easiest Ways to Make Money Online: {title_part}"')

# Replace Productive Overthinker splits
old_po_splits = """    po_splits = [
        (0, 228, "Part 1 of 3: The Double-Edged Sword of the Active Mind", "Understanding the overactive mind, the traps of hyper-observation, and discovering the neurological roots of distraction."),
        (228, 356, "Part 2 of 3: The Architecture of Focus & Mental Systems", "Why systems trump willpower every time, designing an environmental focus bubble, and eliminating decision fatigue."),
        (356, len(po_paras), "Part 3 of 3: Directing the Energy & The Mind of an Architect", "Execution frameworks, channelizing mental depth into high-yield academic output, and mastering mental calmness.")
    ]"""

new_po_splits = """    po_splits = [
        (0, 228, "The Double-Edged Sword of the Active Mind", "Understanding the overactive mind, the traps of hyper-observation, and discovering the neurological roots of distraction."),
        (228, 356, "The Architecture of Focus & Mental Systems", "Why systems trump willpower every time, designing an environmental focus bubble, and eliminating decision fatigue."),
        (356, len(po_paras), "Directing the Energy & The Mind of an Architect", "Execution frameworks, channelizing mental depth into high-yield academic output, and mastering mental calmness.")
    ]"""

content = content.replace(old_po_splits, new_po_splits)
content = content.replace('"title": f"The Productive Overthinker — {title_part}"', '"title": f"The Productive Overthinker: {title_part}"')

with open(ingest_script_path, "w", encoding="utf-8") as f:
    f.write(content)

print("✅ Updated scripts/ingest_guides.py with clean, natural titles")
