import os
import zipfile
import xml.etree.ElementTree as ET
import re
import json

GUIDE_DIR = "/Users/daviditoya/Downloads/SBAI4FA27/guide raw"
OUTPUT_JSON = "/Users/daviditoya/Downloads/SBAI4FA27/src/data/guides.json"

FACULTY_MAP = {
    "Agriculture": "fac_agric",
    "Basic Medical Sciences": "fac_basic_med",
    "Computing": "fac_computing",
    "Economics & Management Sciences": "fac_econ_mgmt",
    "Education": "fac_education",
    "Environmental Design & Management": "fac_edm",
    "Law": "fac_law",
    "Nursing Science": "fac_nursing",
    "Clinical Sciences": "fac_clinical",
    "Pharmacy": "fac_pharmacy",
    "Public Health": "fac_public_health",
    "Renewable Natural Resources": "fac_nat_res",
    "Science": "fac_science",
    "The Social Sciences": "fac_social_sci",
    "Technology": "fac_tech",
    "Arts": "fac_arts"
}

def parse_docx(docx_path):
    with zipfile.ZipFile(docx_path) as z:
        xml_content = z.read('word/document.xml')
    
    root = ET.fromstring(xml_content)
    namespaces = {'w': 'http://schemas.openxmlformats.org/wordprocessingml/2006/main'}
    
    paragraphs = []
    for p in root.iter(f"{{{namespaces['w']}}}p"):
        p_style = None
        pPr = p.find(f"{{{namespaces['w']}}}pPr")
        if pPr is not None:
            pStyle = pPr.find(f"{{{namespaces['w']}}}pStyle")
            if pStyle is not None:
                p_style = pStyle.attrib.get(f"{{{namespaces['w']}}}val")
        
        runs = []
        for r in p.iter(f"{{{namespaces['w']}}}r"):
            rPr = r.find(f"{{{namespaces['w']}}}rPr")
            is_bold = rPr is not None and rPr.find(f"{{{namespaces['w']}}}b") is not None
            is_italic = rPr is not None and rPr.find(f"{{{namespaces['w']}}}i") is not None
            text = "".join([node.text for node in r.iter(f"{{{namespaces['w']}}}t") if node.text])
            if text:
                runs.append({
                    'text': text,
                    'bold': is_bold,
                    'italic': is_italic
                })
        
        full_text = "".join([r['text'] for r in runs]).strip()
        if full_text:
            paragraphs.append({
                'style': p_style,
                'text': full_text,
                'runs': runs
            })
            
    return paragraphs

def format_paragraph_to_markdown(para):
    text = para['text']
    style = para.get('style', '') or ''
    
    if 'Heading1' in style:
        return f"\n## {text}\n"
    elif 'Heading2' in style:
        return f"\n### {text}\n"
    elif 'Heading3' in style:
        return f"\n#### {text}\n"
    
    if re.match(r'^(CHAPTER\s+\d+|PART\s+\d+|PART\s+[I|V|X]+|SECTION\s+\d+|MODULE\s+\d+)', text, re.IGNORECASE):
        return f"\n## {text}\n"
    if re.match(r'^\d+\.\s+[A-Z]', text) and len(text) < 90:
        return f"\n### {text}\n"
    if re.match(r'^(Tip\s+\d+:|Step\s+\d+:|Phase\s+\d+:|Rule\s+\d+:)', text, re.IGNORECASE) and len(text) < 100:
        return f"\n### {text}\n"
    if text.isupper() and len(text) < 70 and not text.startswith("HTTP") and len(text) > 4:
        return f"\n### {text}\n"
    
    formatted_runs = []
    for r in para['runs']:
        t = r['text']
        if r['bold'] and r['italic']:
            formatted_runs.append(f"***{t.strip()}***" if t.strip() else t)
        elif r['bold']:
            formatted_runs.append(f"**{t.strip()}**" if t.strip() else t)
        elif r['italic']:
            formatted_runs.append(f"*{t.strip()}*" if t.strip() else t)
        else:
            formatted_runs.append(t)
            
    res = "".join(formatted_runs).strip()
    
    if re.match(r'^[•\-\*]\s+', res) or (style and 'List' in style):
        res = re.sub(r'^[•\-\*]\s*', '', res)
        return f"- {res}"
        
    return res

def convert_paras_to_markdown(paras):
    lines = []
    in_list = False
    for p in paras:
        formatted = format_paragraph_to_markdown(p)
        if formatted.startswith("- "):
            lines.append(formatted)
            in_list = True
        elif formatted.startswith("\n#"):
            lines.append(f"\n{formatted.strip()}\n")
            in_list = False
        else:
            if in_list:
                lines.append("")
                in_list = False
            lines.append(f"{formatted}\n")
    return "\n".join(lines).strip()

def build_guides():
    os.makedirs("/Users/daviditoya/Downloads/SBAI4FA27/src/data", exist_ok=True)
    all_guides = []
    
    # 1. Agriculture Freshers Survival Guide
    agric_paras = parse_docx(os.path.join(GUIDE_DIR, "Agriculture Freshers Survival Guide By DCN (1).docx"))
    all_guides.append({
        "id": "guide_fac_agric_survival",
        "title": "Faculty of Agriculture Freshers Survival Guide",
        "summary": "Essential survival manual for fresh Agriculture students at UI, covering faculty dynamics, departmental choices, farm practicals, and 100L core course mastery.",
        "content": convert_paras_to_markdown(agric_paras),
        "category": "Faculty Guides",
        "status": "PUBLISHED",
        "facultyId": FACULTY_MAP["Agriculture"],
        "faculty": {"id": FACULTY_MAP["Agriculture"], "name": "Agriculture", "code": "AGRIC"},
        "source": "Disciples Christian Network (DCN) UI Chapter",
        "owner": "UI Freshers Academic Directorate",
        "seriesId": None, "seriesTitle": None, "seriesOrder": None, "seriesTotal": None
    })

    # 2. Basic Medical Science
    bms_paras = parse_docx(os.path.join(GUIDE_DIR, "Basic Medical Science Freshers' Survival Guide_ UI Edition By DCN (1).docx"))
    all_guides.append({
        "id": "guide_fac_bms_survival",
        "title": "Faculty of Basic Medical Sciences Freshers Survival Guide",
        "summary": "Survival and excellence guide for BMS freshers at the University of Ibadan, covering Anatomy, Physiology, Biochemistry, labs, and pre-clinical grading.",
        "content": convert_paras_to_markdown(bms_paras),
        "category": "Faculty Guides",
        "status": "PUBLISHED",
        "facultyId": FACULTY_MAP["Basic Medical Sciences"],
        "faculty": {"id": FACULTY_MAP["Basic Medical Sciences"], "name": "Basic Medical Sciences", "code": "BASIC_MED"},
        "source": "Disciples Christian Network (DCN) UI Chapter",
        "owner": "UI Freshers Academic Directorate",
        "seriesId": None, "seriesTitle": None, "seriesOrder": None, "seriesTotal": None
    })

    # 3. Computing
    comp_paras = parse_docx(os.path.join(GUIDE_DIR, "Computing Freshers Survival Guide (What Coding School Is Really Like) By DCN.docx"))
    all_guides.append({
        "id": "guide_fac_comp_survival",
        "title": "Faculty of Computing Freshers Survival Guide (What Tech School Is Really Like)",
        "summary": "Insider blueprint for freshers in Computer Science, AI, Cybersecurity, IT, and Software Engineering on balancing coding labs, math rigors, and practical tech skills.",
        "content": convert_paras_to_markdown(comp_paras),
        "category": "Faculty Guides",
        "status": "PUBLISHED",
        "facultyId": FACULTY_MAP["Computing"],
        "faculty": {"id": FACULTY_MAP["Computing"], "name": "Computing", "code": "COMPUTING"},
        "source": "Disciples Christian Network (DCN) UI Chapter",
        "owner": "UI Freshers Academic Directorate",
        "seriesId": None, "seriesTitle": None, "seriesOrder": None, "seriesTotal": None
    })

    # 4. Economics & Management Sciences
    econ_paras = parse_docx(os.path.join(GUIDE_DIR, "Econs & Management Survival Guide for Freshmen By DCN.docx"))
    all_guides.append({
        "id": "guide_fac_econ_survival",
        "title": "Faculty of Economics & Management Sciences Freshers Survival Guide",
        "summary": "Strategic navigation guide for freshmen in Economics, Accounting, Banking & Finance, and Marketing at UI to master quantitative economics and commercial theory.",
        "content": convert_paras_to_markdown(econ_paras),
        "category": "Faculty Guides",
        "status": "PUBLISHED",
        "facultyId": FACULTY_MAP["Economics & Management Sciences"],
        "faculty": {"id": FACULTY_MAP["Economics & Management Sciences"], "name": "Economics & Management Sciences", "code": "ECON_MGMT"},
        "source": "Disciples Christian Network (DCN) UI Chapter",
        "owner": "UI Freshers Academic Directorate",
        "seriesId": None, "seriesTitle": None, "seriesOrder": None, "seriesTotal": None
    })

    # 5. Education (3 Parts)
    edu_paras = parse_docx(os.path.join(GUIDE_DIR, "Education Students Survival Guide (Beyond Just ‘Teaching’) by DCN.docx"))
    p2_idx = next(i for i, p in enumerate(edu_paras) if "1.Adult Education" in p['text'] or "1. Adult Education" in p['text'])
    p3_idx = next(i for i, p in enumerate(edu_paras) if "5.Arts and Social Sciences" in p['text'] or "5. Arts and Social Sciences" in p['text'])

    all_guides.append({
        "id": "guide_edu_series_part1",
        "title": "Faculty of Education Freshers Guide — Part 1 of 3: The Educator's Mindset & Academic Reality",
        "summary": "Dispelling the 'just teaching' myth, understanding the Faculty of Education structure, and mastering the foundation of academic excellence at UI.",
        "content": convert_paras_to_markdown(edu_paras[:p2_idx]),
        "category": "Faculty Guides",
        "status": "PUBLISHED",
        "facultyId": FACULTY_MAP["Education"],
        "faculty": {"id": FACULTY_MAP["Education"], "name": "Education", "code": "EDUCATION"},
        "source": "Disciples Christian Network (DCN) UI Chapter",
        "owner": "UI Freshers Academic Directorate",
        "seriesId": "series_education_guide", "seriesTitle": "Faculty of Education Freshers Survival Guide", "seriesOrder": 1, "seriesTotal": 3
    })
    all_guides.append({
        "id": "guide_edu_series_part2",
        "title": "Faculty of Education Freshers Guide — Part 2 of 3: Departmental Blueprints (Adult Ed, Guidance & Counselling, LARIS, Special Ed)",
        "summary": "Specialized course breakdowns, departmental dynamics, and scoring strategies for Adult Education, Guidance and Counselling, LARIS, and Special Education.",
        "content": convert_paras_to_markdown(edu_paras[p2_idx:p3_idx]),
        "category": "Faculty Guides",
        "status": "PUBLISHED",
        "facultyId": FACULTY_MAP["Education"],
        "faculty": {"id": FACULTY_MAP["Education"], "name": "Education", "code": "EDUCATION"},
        "source": "Disciples Christian Network (DCN) UI Chapter",
        "owner": "UI Freshers Academic Directorate",
        "seriesId": "series_education_guide", "seriesTitle": "Faculty of Education Freshers Survival Guide", "seriesOrder": 2, "seriesTotal": 3
    })
    all_guides.append({
        "id": "guide_edu_series_part3",
        "title": "Faculty of Education Freshers Guide — Part 3 of 3: Departmental Blueprints & Beyond Teaching (ASE, ECEF, EM, STE)",
        "summary": "Navigating Arts & Social Sciences Ed, Early Childhood, Educational Management, Science & Tech Ed, and positioning for high-impact educational careers.",
        "content": convert_paras_to_markdown(edu_paras[p3_idx:]),
        "category": "Faculty Guides",
        "status": "PUBLISHED",
        "facultyId": FACULTY_MAP["Education"],
        "faculty": {"id": FACULTY_MAP["Education"], "name": "Education", "code": "EDUCATION"},
        "source": "Disciples Christian Network (DCN) UI Chapter",
        "owner": "UI Freshers Academic Directorate",
        "seriesId": "series_education_guide", "seriesTitle": "Faculty of Education Freshers Survival Guide", "seriesOrder": 3, "seriesTotal": 3
    })

    # 6. Environmental Design
    edm_paras = parse_docx(os.path.join(GUIDE_DIR, "Environmental Design Survival Guide for Freshmen By DCN.docx"))
    all_guides.append({
        "id": "guide_fac_edm_survival",
        "title": "Faculty of Environmental Design & Management Freshers Survival Guide",
        "summary": "Essential guide for Architecture, Estate Management, Urban Planning, Quantity Surveying, and Building freshers at UI on studio culture and continuous assessments.",
        "content": convert_paras_to_markdown(edm_paras),
        "category": "Faculty Guides",
        "status": "PUBLISHED",
        "facultyId": FACULTY_MAP["Environmental Design & Management"],
        "faculty": {"id": FACULTY_MAP["Environmental Design & Management"], "name": "Environmental Design & Management", "code": "EDM"},
        "source": "Disciples Christian Network (DCN) UI Chapter",
        "owner": "UI Freshers Academic Directorate",
        "seriesId": None, "seriesTitle": None, "seriesOrder": None, "seriesTotal": None
    })

    # 7. Law
    law_paras = parse_docx(os.path.join(GUIDE_DIR, "Law Freshers Survival Guide (Read This Before First Semester Ends) By DCN.docx"))
    all_guides.append({
        "id": "guide_fac_law_survival",
        "title": "Faculty of Law Freshers Survival Guide (Read This Before First Semester Ends)",
        "summary": "Essential briefing for UI Law freshmen covering the legal method, case briefs, tutorial presentations, library etiquette, and avoiding 100L pitfalls.",
        "content": convert_paras_to_markdown(law_paras),
        "category": "Faculty Guides",
        "status": "PUBLISHED",
        "facultyId": FACULTY_MAP["Law"],
        "faculty": {"id": FACULTY_MAP["Law"], "name": "Law", "code": "LAW"},
        "source": "Disciples Christian Network (DCN) UI Chapter",
        "owner": "UI Freshers Academic Directorate",
        "seriesId": None, "seriesTitle": None, "seriesOrder": None, "seriesTotal": None
    })

    # 8. Nursing
    nursing_paras = parse_docx(os.path.join(GUIDE_DIR, "Nursing Freshers Survival Guide By DCN.docx"))
    all_guides.append({
        "id": "guide_fac_nursing_survival",
        "title": "Faculty of Nursing Science Freshers Survival Guide",
        "summary": "Clinical and pre-clinical survival guide for 100L Nursing students at UI, covering BIO 101, CHM 101, PHY 101, and preparation for clinical postings at UCH.",
        "content": convert_paras_to_markdown(nursing_paras),
        "category": "Faculty Guides",
        "status": "PUBLISHED",
        "facultyId": FACULTY_MAP["Nursing Science"],
        "faculty": {"id": FACULTY_MAP["Nursing Science"], "name": "Nursing Science", "code": "NURSING"},
        "source": "Disciples Christian Network (DCN) UI Chapter",
        "owner": "UI Freshers Academic Directorate",
        "seriesId": None, "seriesTitle": None, "seriesOrder": None, "seriesTotal": None
    })

    # 9. Pharmacy
    pharm_paras = parse_docx(os.path.join(GUIDE_DIR, "Pharmacy Freshers Survival Guide By DCN.docx"))
    all_guides.append({
        "id": "guide_fac_pharm_survival",
        "title": "Faculty of Pharmacy Freshers Survival Guide",
        "summary": "Comprehensive survival blueprint for fresh Pharmacy undergraduates at UI, navigating chemistry prerequisites, lab practicals, professional pharmacy ethics, and GPA preservation.",
        "content": convert_paras_to_markdown(pharm_paras),
        "category": "Faculty Guides",
        "status": "PUBLISHED",
        "facultyId": FACULTY_MAP["Pharmacy"],
        "faculty": {"id": FACULTY_MAP["Pharmacy"], "name": "Pharmacy", "code": "PHARMACY"},
        "source": "Disciples Christian Network (DCN) UI Chapter",
        "owner": "UI Freshers Academic Directorate",
        "seriesId": None, "seriesTitle": None, "seriesOrder": None, "seriesTotal": None
    })

    # 10. Public Health
    ph_paras = parse_docx(os.path.join(GUIDE_DIR, "Public Health Survival Guide for Freshmen.docx"))
    all_guides.append({
        "id": "guide_fac_ph_survival",
        "title": "Faculty of Public Health Freshers Survival Guide",
        "summary": "Core introduction and orientation guide for freshmen in Environmental Health, Epidemiology, and Health Policy at the Faculty of Public Health.",
        "content": convert_paras_to_markdown(ph_paras),
        "category": "Faculty Guides",
        "status": "PUBLISHED",
        "facultyId": FACULTY_MAP["Public Health"],
        "faculty": {"id": FACULTY_MAP["Public Health"], "name": "Public Health", "code": "PUBLIC_HEALTH"},
        "source": "Disciples Christian Network (DCN) UI Chapter",
        "owner": "UI Freshers Academic Directorate",
        "seriesId": None, "seriesTitle": None, "seriesOrder": None, "seriesTotal": None
    })

    # 11. Renewable Natural Resources
    rnr_paras = parse_docx(os.path.join(GUIDE_DIR, "Renewable Natural Resources Survival Guide By DCN.docx"))
    all_guides.append({
        "id": "guide_fac_rnr_survival",
        "title": "Faculty of Renewable Natural Resources Freshers Survival Guide",
        "summary": "Field and academic navigation guide for RNR freshers covering Forestry, Wildlife, Fisheries, laboratory practicals, and overcoming first-year reality shock.",
        "content": convert_paras_to_markdown(rnr_paras),
        "category": "Faculty Guides",
        "status": "PUBLISHED",
        "facultyId": FACULTY_MAP["Renewable Natural Resources"],
        "faculty": {"id": FACULTY_MAP["Renewable Natural Resources"], "name": "Renewable Natural Resources", "code": "NAT_RES"},
        "source": "Disciples Christian Network (DCN) UI Chapter",
        "owner": "UI Freshers Academic Directorate",
        "seriesId": None, "seriesTitle": None, "seriesOrder": None, "seriesTotal": None
    })

    # 12. Science
    sci_paras = parse_docx(os.path.join(GUIDE_DIR, "Science Freshers Survival Guide By DCN.docx"))
    all_guides.append({
        "id": "guide_fac_sci_survival",
        "title": "Faculty of Science Freshers Survival Guide",
        "summary": "Strategic guide for Faculty of Science undergraduates at UI, mastering heavy laboratory courses (PHY 107, CHM 107), departmental prerequisites, and the blurt study method.",
        "content": convert_paras_to_markdown(sci_paras),
        "category": "Faculty Guides",
        "status": "PUBLISHED",
        "facultyId": FACULTY_MAP["Science"],
        "faculty": {"id": FACULTY_MAP["Science"], "name": "Science", "code": "SCIENCE"},
        "source": "Disciples Christian Network (DCN) UI Chapter",
        "owner": "UI Freshers Academic Directorate",
        "seriesId": None, "seriesTitle": None, "seriesOrder": None, "seriesTotal": None
    })

    # 13. Social Sciences
    soc_paras = parse_docx(os.path.join(GUIDE_DIR, "Social Sciences Survival Guide for Freshmen By DCN.docx"))
    all_guides.append({
        "id": "guide_fac_soc_survival",
        "title": "Faculty of The Social Sciences Freshers Survival Guide",
        "summary": "Essential guide for freshmen in Political Science, Psychology, Sociology, and Geography on critical essay writing, statistical courses, and mastering the UI social sciences villa.",
        "content": convert_paras_to_markdown(soc_paras),
        "category": "Faculty Guides",
        "status": "PUBLISHED",
        "facultyId": FACULTY_MAP["The Social Sciences"],
        "faculty": {"id": FACULTY_MAP["The Social Sciences"], "name": "The Social Sciences", "code": "SOCIAL_SCI"},
        "source": "Disciples Christian Network (DCN) UI Chapter",
        "owner": "UI Freshers Academic Directorate",
        "seriesId": None, "seriesTitle": None, "seriesOrder": None, "seriesTotal": None
    })

    # 14. Technology
    tech_paras = parse_docx(os.path.join(GUIDE_DIR, "Technology Students Survival Guide By DCN.docx"))
    all_guides.append({
        "id": "guide_fac_tech_survival",
        "title": "Faculty of Technology Freshers Survival Guide",
        "summary": "Essential survival guide for engineering freshers in Mechanical, Electrical, Civil, and Agricultural Engineering at UI on handling intense technical drawings, calculus, and workshops.",
        "content": convert_paras_to_markdown(tech_paras),
        "category": "Faculty Guides",
        "status": "PUBLISHED",
        "facultyId": FACULTY_MAP["Technology"],
        "faculty": {"id": FACULTY_MAP["Technology"], "name": "Technology", "code": "TECH"},
        "source": "Disciples Christian Network (DCN) UI Chapter",
        "owner": "UI Freshers Academic Directorate",
        "seriesId": None, "seriesTitle": None, "seriesOrder": None, "seriesTotal": None
    })

    # 15. Arts
    arts_paras = parse_docx(os.path.join(GUIDE_DIR, "Why Many Art Students Underperform Academically by DCN.docx"))
    all_guides.append({
        "id": "guide_fac_arts_survival",
        "title": "Faculty of Arts Freshers Survival Guide: Why Many Art Students Underperform & How to Excel",
        "summary": "Strategic guide for Faculty of Arts undergraduates at UI covering elective selection, subjective essay grading, lecturer style adaptation, and maintaining a first-class GPA.",
        "content": convert_paras_to_markdown(arts_paras),
        "category": "Faculty Guides",
        "status": "PUBLISHED",
        "facultyId": FACULTY_MAP["Arts"],
        "faculty": {"id": FACULTY_MAP["Arts"], "name": "Arts", "code": "ARTS"},
        "source": "Disciples Christian Network (DCN) UI Chapter",
        "owner": "UI Freshers Academic Directorate",
        "seriesId": None, "seriesTitle": None, "seriesOrder": None, "seriesTotal": None
    })

    # 16. How to Score High in Any Exam at UI
    exam_ui_paras = parse_docx(os.path.join(GUIDE_DIR, "HOW TO SCORE HIGH IN ANY EXAM IN THE UNIVERSITY OF IBADAN.docx"))
    all_guides.append({
        "id": "guide_exam_blueprint_ui",
        "title": "How to Score High in Any Exam at the University of Ibadan (The UI Exam Blueprint)",
        "summary": "Tactical exam strategy specifically tailored for UI's marking style, Continuous Assessment (CA) weighting, past question patterns, and lecturer expectations.",
        "content": convert_paras_to_markdown(exam_ui_paras),
        "category": "Exam Preparation",
        "status": "PUBLISHED",
        "facultyId": None,
        "faculty": None,
        "source": "Disciples Christian Network (DCN)",
        "owner": "UI Freshers Academic Directorate",
        "seriesId": None, "seriesTitle": None, "seriesOrder": None, "seriesTotal": None
    })

    # 17. How to Pass Tough Courses
    tough_paras = parse_docx(os.path.join(GUIDE_DIR, "How to Pass Tough Courses Without Overworking Yourself.docx"))
    all_guides.append({
        "id": "guide_pass_tough_courses",
        "title": "How to Pass Tough Courses Without Overworking Yourself",
        "summary": "High-leverage learning framework to conquer difficult quantitative and theoretical university courses using front-loaded cognitive effort and minimum viable understanding.",
        "content": convert_paras_to_markdown(tough_paras),
        "category": "Study Strategy",
        "status": "PUBLISHED",
        "facultyId": None,
        "faculty": None,
        "source": "Disciples Christian Network (DCN)",
        "owner": "UI Freshers Academic Directorate",
        "seriesId": None, "seriesTitle": None, "seriesOrder": None, "seriesTotal": None
    })

    # 18. How to be BGS
    bgs_paras = parse_docx(os.path.join(GUIDE_DIR, "How to be BGS.docx"))
    all_guides.append({
        "id": "guide_how_to_be_bgs",
        "title": "How to Be Best Graduating Student (BGS): The Playbook, Mindset & Sacrifices",
        "summary": "Firsthand account and proven principles for graduating at the top of your class at the University of Ibadan, shifting from cramming to systemic academic mastery.",
        "content": convert_paras_to_markdown(bgs_paras),
        "category": "Academic Mastery",
        "status": "PUBLISHED",
        "facultyId": None,
        "faculty": None,
        "source": "David Itoya / DCN",
        "owner": "UI Freshers Academic Directorate",
        "seriesId": None, "seriesTitle": None, "seriesOrder": None, "seriesTotal": None
    })

    # 19. GET GOOD AT HARD THINGS by David Itoya (8-Part Series)
    gght_paras = parse_docx(os.path.join(GUIDE_DIR, "GET GOOD AT HARD THINGS by David Itoya.docx"))
    gght_splits = [
        (0, 115, "Part 1 of 8: The Philosophy of Difficulty & Why Hard Things Matter", "Understanding why doing difficult things transforms intellect and setting the philosophical foundation for academic and personal mastery."),
        (115, 226, "Part 2 of 8: The Architecture of Deliberate Practice & Skill Acquisition", "How true expertise is developed through targeted, uncomfortable practice rather than mindless repetition."),
        (226, 336, "Part 3 of 8: Cognitive Load, Focus & Memory Systems", "Eliminating mental fragmentation, managing cognitive load, and constructing environments optimized for uninterrupted deep work."),
        (336, 476, "Part 4 of 8: The Friction of Resistance & Overcoming Mental Blocks", "Deconstructing procrastination, psychological resistance, and the mechanisms needed to initiate hard tasks effortlessly."),
        (476, 630, "Part 5 of 8: Compounding Knowledge & The Long Game", "How consistent intellectual investments compound exponentially over your university journey."),
        (630, 825, "Part 6 of 8: The High Performer's Daily Operating System", "The complete daily routine, energy management, and execution checklist for top-tier academic performers."),
        (825, 900, "Part 7 of 8: Deep Work, Sleep & Time Management Mastery (FAQ)", "Addressing critical questions on sleep schedules, lecture fatigue, focus blocks, and time management."),
        (900, len(gght_paras), "Part 8 of 8: Exam Recovery, Scale Group & Long-Term Mastery (FAQ)", "How to recover from bad exam scores, staying motivated throughout university, and building long-term career momentum.")
    ]

    for part_num, (s_idx, e_idx, p_title, p_sum) in enumerate(gght_splits, 1):
        all_guides.append({
            "id": f"guide_gght_part_{part_num}",
            "title": f"Get Good at Hard Things — {p_title}",
            "summary": p_sum,
            "content": convert_paras_to_markdown(gght_paras[s_idx:e_idx]),
            "category": "Academic Mastery",
            "status": "PUBLISHED",
            "facultyId": None,
            "faculty": None,
            "source": "David Itoya / DCN",
            "owner": "UI Freshers Academic Directorate",
            "seriesId": "series_get_good_at_hard_things",
            "seriesTitle": "Get Good at Hard Things",
            "seriesOrder": part_num,
            "seriesTotal": 8
        })

    # 20. HOW TO BALANCE YOUR ACADEMICS AND YOUR BUSINESS (3-Part Series)
    biz_paras = parse_docx(os.path.join(GUIDE_DIR, "HOW TO BALANCE YOUR ACADEMICS AND YOUR BUSINESS.docx"))
    biz_splits = [
        (0, 128, "Part 1 of 3: The Truth About Balance & The Hurricane Life", "Debunking 50/50 balance myths, conducting energy audits, and establishing boundaries between coursework and commerce."),
        (128, 260, "Part 2 of 3: The System — High-Yield Academics & Business Automation", "Applying 80/20 leverage to lectures, batching client orders, and setting up automated customer communication."),
        (260, len(biz_paras), "Part 3 of 3: The Implementation — Exam Season Protocols & Scaling Safely", "Navigating exam season lockdown, delegating tasks, managing stress, and sustaining both high CGPA and enterprise revenue.")
    ]

    for idx, (s_idx, e_idx, title_part, summary_part) in enumerate(biz_splits, 1):
        all_guides.append({
            "id": f"guide_biz_part_{idx}",
            "title": f"How to Balance Academics and Business — {title_part}",
            "summary": summary_part,
            "content": convert_paras_to_markdown(biz_paras[s_idx:e_idx]),
            "category": "Student Life & Entrepreneurship",
            "status": "PUBLISHED",
            "facultyId": None,
            "faculty": None,
            "source": "Disciples Christian Network (DCN)",
            "owner": "UI Freshers Academic Directorate",
            "seriesId": "series_academics_business",
            "seriesTitle": "How to Balance Academics and Business",
            "seriesOrder": idx,
            "seriesTotal": 3
        })

    # 21. HOW TO PASS ANY EXAM WITH HIGH SCORES (3-Part Series)
    exam_paras = parse_docx(os.path.join(GUIDE_DIR, "HOW TO PASS ANY EXAM WITH HIGH SCORES.docx"))
    exam_splits = [
        (0, 127, "Part 1 of 3: The Strategy — Study Smart, Not Just Hard", "The broken student syndrome, cognitive encoding, active recall methods, and avoiding passive revision traps."),
        (127, 181, "Part 2 of 3: The System — Energy, Spaced Repetition & Power Hours", "Structuring focused 60-minute power blocks, circadian rhythm alignment, and interleaving difficult subjects."),
        (181, len(exam_paras), "Part 3 of 3: The Execution — Past Questions, Marking Schemes & Exam Room Tactics", "Reverse-engineering examiner psychology, writing high-scoring answers, and managing time under exam hall pressure.")
    ]

    for idx, (s_idx, e_idx, title_part, summary_part) in enumerate(exam_splits, 1):
        all_guides.append({
            "id": f"guide_pass_exam_part_{idx}",
            "title": f"How to Pass Any Exam with High Scores — {title_part}",
            "summary": summary_part,
            "content": convert_paras_to_markdown(exam_paras[s_idx:e_idx]),
            "category": "Exam Preparation",
            "status": "PUBLISHED",
            "facultyId": None,
            "faculty": None,
            "source": "Disciples Christian Network (DCN)",
            "owner": "UI Freshers Academic Directorate",
            "seriesId": "series_pass_any_exam",
            "seriesTitle": "How to Pass Any Exam with High Scores",
            "seriesOrder": idx,
            "seriesTotal": 3
        })

    # 22. RESULT-ORIENTED LEARNING (3-Part Series)
    rol_paras = parse_docx(os.path.join(GUIDE_DIR, "RESULT-ORIENTED LEARNING.docx"))
    rol_splits = [
        (0, 199, "Part 1 of 3: The Foundation — Curing the Illusion of Competence", "Why highlighting and re-reading fail, and how starting with target exam outcomes and past questions reshapes comprehension."),
        (199, 316, "Part 2 of 3: The System — Routine, Managing Distractions & True Balance", "Building an unshakeable daily study routine, taming digital distractions, and understanding rest as an academic weapon."),
        (316, len(rol_paras), "Part 3 of 3: The Implementation — The Result-Oriented System & Overcoming Setbacks", "The complete operational learning algorithm, recovery protocols when falling behind, and execution masterclass.")
    ]

    for idx, (s_idx, e_idx, title_part, summary_part) in enumerate(rol_splits, 1):
        all_guides.append({
            "id": f"guide_rol_part_{idx}",
            "title": f"Result-Oriented Learning — {title_part}",
            "summary": summary_part,
            "content": convert_paras_to_markdown(rol_paras[s_idx:e_idx]),
            "category": "Academic Mastery",
            "status": "PUBLISHED",
            "facultyId": None,
            "faculty": None,
            "source": "Disciples Christian Network (DCN)",
            "owner": "UI Freshers Academic Directorate",
            "seriesId": "series_result_oriented_learning",
            "seriesTitle": "Result-Oriented Learning",
            "seriesOrder": idx,
            "seriesTotal": 3
        })

    # 23. THE EASIEST WAYS TO MAKE MONEY ONLINE (3-Part Series)
    mmo_paras = parse_docx(os.path.join(GUIDE_DIR, "THE EASIEST WAYS TO MAKE MONEY ONLINE.docx"))
    mmo_splits = [
        (0, 143, "Part 1 of 3: Mindset & Digital Opportunities", "Real student financial success stories, shifting from consumer to creator, and choosing a monetization model."),
        (143, 188, "Part 2 of 3: The Roadmap — From Zero to First Income", "High-income skills (copywriting, design, tech support), client acquisition on campus and online, and packaging offerings."),
        (188, len(mmo_paras), "Part 3 of 3: The Fast Track — Growth, Automation & Mentorship", "Leveraging mentors, relentless practice, expanding capabilities, and scaling to consistent cash flow.")
    ]

    for idx, (s_idx, e_idx, title_part, summary_part) in enumerate(mmo_splits, 1):
        all_guides.append({
            "id": f"guide_mmo_part_{idx}",
            "title": f"The Easiest Ways to Make Money Online — {title_part}",
            "summary": summary_part,
            "content": convert_paras_to_markdown(mmo_paras[s_idx:e_idx]),
            "category": "Student Life & Entrepreneurship",
            "status": "PUBLISHED",
            "facultyId": None,
            "faculty": None,
            "source": "Disciples Christian Network (DCN)",
            "owner": "UI Freshers Academic Directorate",
            "seriesId": "series_money_online",
            "seriesTitle": "The Easiest Ways to Make Money Online",
            "seriesOrder": idx,
            "seriesTotal": 3
        })

    # 24. THE PRODUCTIVE OVERTHINKER (3-Part Series)
    po_paras = parse_docx(os.path.join(GUIDE_DIR, "THE PRODUCTIVE OVERTHINKER.docx"))
    po_splits = [
        (0, 228, "Part 1 of 3: The Double-Edged Sword of the Active Mind", "Understanding the overactive mind, the traps of hyper-observation, and discovering the neurological roots of distraction."),
        (228, 356, "Part 2 of 3: The Architecture of Focus & Mental Systems", "Why systems trump willpower every time, designing an environmental focus bubble, and eliminating decision fatigue."),
        (356, len(po_paras), "Part 3 of 3: Directing the Energy & The Mind of an Architect", "Execution frameworks, channelizing mental depth into high-yield academic output, and mastering mental calmness.")
    ]

    for idx, (s_idx, e_idx, title_part, summary_part) in enumerate(po_splits, 1):
        all_guides.append({
            "id": f"guide_po_part_{idx}",
            "title": f"The Productive Overthinker — {title_part}",
            "summary": summary_part,
            "content": convert_paras_to_markdown(po_paras[s_idx:e_idx]),
            "category": "Productivity & Mindset",
            "status": "PUBLISHED",
            "facultyId": None,
            "faculty": None,
            "source": "David Itoya / DCN",
            "owner": "UI Freshers Academic Directorate",
            "seriesId": "series_productive_overthinker",
            "seriesTitle": "The Productive Overthinker",
            "seriesOrder": idx,
            "seriesTotal": 3
        })

    print(f"Total Guides Processed: {len(all_guides)}")
    
    with open(OUTPUT_JSON, "w", encoding="utf-8") as f:
        json.dump(all_guides, f, indent=2, ensure_ascii=False)
        
    print(f"✅ Successfully written all {len(all_guides)} guides to {OUTPUT_JSON}")

if __name__ == "__main__":
    build_guides()
