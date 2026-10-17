import json
import re
import os
from collections import defaultdict, Counter

def load_db_courses():
    with open("scratch/db_courses.json", "r", encoding="utf-8") as f:
        courses = json.load(f)
    
    # Map code variants to canonical course object
    course_map = {}
    for c in courses:
        raw_code = c["code"]
        course_map[raw_code] = c
        # normalized without C-
        clean_code = re.sub(r'^C-', '', raw_code).strip()
        course_map[clean_code] = c
        # without space
        no_space = clean_code.replace(" ", "")
        course_map[no_space] = c
        
    return courses, course_map

# Known course titles and codes for 100-Level University of Ibadan
KNOWN_UI_100L_COURSES = {
    "COS 101": {"title": "Introduction to Computer Science & Computing", "faculty": "Computing", "units": 3, "semester": "1st"},
    "COS 102": {"title": "Problem Solving & Programming in Python", "faculty": "Computing", "units": 3, "semester": "2nd"},
    "COS 103": {"title": "Computer Hardware & Logic Systems", "faculty": "Computing", "units": 2, "semester": "1st"},
    "CSC 101": {"title": "Introduction to Computer Science", "faculty": "Computing", "units": 3, "semester": "1st"},
    "MTH 101": {"title": "Elementary Mathematics I (Algebra & Trigonometry)", "faculty": "Science", "units": 3, "semester": "1st"},
    "MTH 102": {"title": "Elementary Mathematics II (Calculus)", "faculty": "Science", "units": 3, "semester": "2nd"},
    "MTH 103": {"title": "Elementary Mathematics III (Vectors, Geometry & Dynamics)", "faculty": "Science", "units": 3, "semester": "1st"},
    "PHY 101": {"title": "General Physics I (Mechanics & Thermal Physics)", "faculty": "Science", "units": 3, "semester": "1st"},
    "PHY 102": {"title": "General Physics II (Electricity & Magnetism)", "faculty": "Science", "units": 3, "semester": "2nd"},
    "PHY 103": {"title": "General Physics III (Waves, Optics & Modern Physics)", "faculty": "Science", "units": 2, "semester": "1st"},
    "PHY 104": {"title": "Practical Physics Laboratory", "faculty": "Science", "units": 1, "semester": "2nd"},
    "CHM 101": {"title": "General Physical Chemistry", "faculty": "Science", "units": 3, "semester": "1st"},
    "CHM 102": {"title": "General Inorganic & Organic Chemistry", "faculty": "Science", "units": 3, "semester": "2nd"},
    "CHM 107": {"title": "General Practical Chemistry I", "faculty": "Science", "units": 1, "semester": "1st"},
    "CHM 108": {"title": "General Practical Chemistry II", "faculty": "Science", "units": 1, "semester": "2nd"},
    "BIO 101": {"title": "Cell Biology & Genetics", "faculty": "Science", "units": 3, "semester": "1st"},
    "BIO 102": {"title": "Organismal Biology (Botany & Zoology)", "faculty": "Science", "units": 3, "semester": "2nd"},
    "BIO 104": {"title": "General Biology Practical Laboratory", "faculty": "Science", "units": 1, "semester": "2nd"},
    "BIO 107": {"title": "Practical Biology I", "faculty": "Science", "units": 1, "semester": "1st"},
    "BIO 108": {"title": "Practical Biology II", "faculty": "Science", "units": 1, "semester": "2nd"},
    "BOT 101": {"title": "Introductory Botany", "faculty": "Science", "units": 3, "semester": "1st"},
    "ZOO 101": {"title": "Introductory Zoology", "faculty": "Science", "units": 3, "semester": "1st"},
    "ZOO 102": {"title": "Animal Ecology and Adaptation", "faculty": "Science", "units": 3, "semester": "2nd"},
    "STA 111": {"title": "Probability & Statistics I", "faculty": "Science", "units": 3, "semester": "1st"},
    "STA 112": {"title": "Probability & Statistics II", "faculty": "Science", "units": 3, "semester": "2nd"},
    "STA 115": {"title": "Introductory Applied Statistics", "faculty": "Science", "units": 3, "semester": "1st"},
    "STA 121": {"title": "Mathematics for Statistics", "faculty": "Science", "units": 2, "semester": "1st"},
    "GST 111": {"title": "Communication in English I", "faculty": "Arts", "units": 2, "semester": "1st"},
    "GST 112": {"title": "Nigerian Peoples and Culture", "faculty": "Arts", "units": 2, "semester": "2nd"},
    "GES 101": {"title": "Use of English & Communication Skills", "faculty": "Arts", "units": 3, "semester": "1st"},
    "GES 107": {"title": "Reproductive Health, Sexually Transmitted Infections and Human Rights", "faculty": "Arts", "units": 2, "semester": "1st"},
    "GES 108": {"title": "Introduction to French", "faculty": "Arts", "units": 2, "semester": "2nd"},
    "ECO 101": {"title": "Principles of Economics I (Microeconomics)", "faculty": "Economics & Management Sciences", "units": 3, "semester": "1st"},
    "ECO 102": {"title": "Principles of Economics II (Macroeconomics)", "faculty": "Economics & Management Sciences", "units": 3, "semester": "2nd"},
    "ECO 103": {"title": "Introductory Mathematics for Economists", "faculty": "Economics & Management Sciences", "units": 3, "semester": "1st"},
    "ACC 101": {"title": "Introduction to Financial Accounting I", "faculty": "Economics & Management Sciences", "units": 3, "semester": "1st"},
    "ACC 102": {"title": "Introduction to Financial Accounting II", "faculty": "Economics & Management Sciences", "units": 3, "semester": "2nd"},
    "BAF 103": {"title": "Introduction to Finance & Banking", "faculty": "Economics & Management Sciences", "units": 3, "semester": "1st"},
    "AMS 101": {"title": "Principles of Management", "faculty": "Economics & Management Sciences", "units": 3, "semester": "1st"},
    "AMS 102": {"title": "Basic Mathematics for Management", "faculty": "Economics & Management Sciences", "units": 3, "semester": "1st"},
    "AMS 103": {"title": "Introduction to Computing Science", "faculty": "Economics & Management Sciences", "units": 3, "semester": "1st"},
    "SOC 101": {"title": "Introduction to Sociology I", "faculty": "The Social Sciences", "units": 3, "semester": "1st"},
    "SOC 102": {"title": "Introduction to Sociology II", "faculty": "The Social Sciences", "units": 3, "semester": "2nd"},
    "SOC 105": {"title": "Elements of Social Structure & Organization", "faculty": "The Social Sciences", "units": 3, "semester": "1st"},
    "PSY 101": {"title": "Introduction to Psychology I", "faculty": "The Social Sciences", "units": 3, "semester": "1st"},
    "PSY 104": {"title": "Basic Concepts in Psychology", "faculty": "The Social Sciences", "units": 3, "semester": "2nd"},
    "POS 101": {"title": "Introduction to Political Science", "faculty": "The Social Sciences", "units": 3, "semester": "1st"},
    "POS 103": {"title": "The Organization of Government", "faculty": "The Social Sciences", "units": 3, "semester": "1st"},
    "POS 106": {"title": "Nigerian Constitutional Development", "faculty": "The Social Sciences", "units": 3, "semester": "2nd"},
    "GEO 101": {"title": "Introduction to Physical Geography", "faculty": "The Social Sciences", "units": 3, "semester": "1st"},
    "GEO 102": {"title": "Introduction to Human Geography", "faculty": "The Social Sciences", "units": 3, "semester": "2nd"},
    "PUL 101": {"title": "Introduction to Legal Method I", "faculty": "Law", "units": 3, "semester": "1st"},
    "PUL 102": {"title": "Introduction to Legal Method II", "faculty": "Law", "units": 3, "semester": "2nd"},
    "LAW 102": {"title": "Legal Logic & Reasoning", "faculty": "Law", "units": 2, "semester": "2nd"},
    "CLL 103": {"title": "Latin for Lawyers", "faculty": "Law", "units": 2, "semester": "1st"},
    "VMD 101": {"title": "Introductory Veterinary Medicine", "faculty": "Veterinary Medicine", "units": 2, "semester": "1st"},
    "VAN 101": {"title": "Veterinary Anatomy I", "faculty": "Veterinary Medicine", "units": 3, "semester": "1st"},
    "AGR 101": {"title": "Introductory Agriculture", "faculty": "Agriculture", "units": 2, "semester": "1st"},
    "AGG 102": {"title": "Basic Agricultural Concepts", "faculty": "Agriculture", "units": 2, "semester": "2nd"},
    "CPE 110": {"title": "Introduction to Agricultural Technology", "faculty": "Agriculture", "units": 2, "semester": "1st"},
    "CPE 111": {"title": "Farm Machinery & Mechanization", "faculty": "Agriculture", "units": 2, "semester": "1st"},
    "GET 102": {"title": "Applied Mechanics", "faculty": "Technology", "units": 3, "semester": "2nd"},
    "GET 103": {"title": "Engineering Graphics", "faculty": "Technology", "units": 2, "semester": "1st"},
    "RNR 101": {"title": "Introduction to Renewable Natural Resources", "faculty": "Renewable Natural Resources", "units": 2, "semester": "1st"},
    "FRM 101": {"title": "Forest Resources Management", "faculty": "Renewable Natural Resources", "units": 2, "semester": "1st"},
    "WLM 101": {"title": "Wildlife Management & Ecology", "faculty": "Renewable Natural Resources", "units": 2, "semester": "1st"},
    "AQF 101": {"title": "Introductory Aquaculture & Fisheries", "faculty": "Renewable Natural Resources", "units": 2, "semester": "1st"},
    "CLA 101": {"title": "Introduction to Communication Studies", "faculty": "Arts", "units": 3, "semester": "1st"},
    "LIN 105": {"title": "Languages of the World", "faculty": "Arts", "units": 3, "semester": "1st"},
    "PHL 101": {"title": "Introduction to Philosophy", "faculty": "Arts", "units": 3, "semester": "1st"},
    "PHL 102": {"title": "Arguments and Critical Thinking", "faculty": "Arts", "units": 3, "semester": "2nd"},
}

def refine_code(rel_path, filename, current_code, text_snippet):
    full_str = f"{rel_path} {filename}".replace("\\", "/")
    
    # 1. Reject invalid code captures like "ECO 100L", "100L", "100 LEVEL"
    if current_code in ["ECO 100L", "ECO 100", "100L", "100 LEVEL"]:
        current_code = None
        
    # 2. Check path segments from deepest (filename and immediate parent) up
    parts = full_str.split("/")
    # Check parts in reverse order
    for part in reversed(parts):
        # Specific check for course codes like "ECO 101", "ACC 101", "AMS 101", "BAF 103", etc.
        m = re.findall(r'\b([A-Z]{2,4}|C-[A-Z]{2,4})\s*([1-9][0-9]{2}[A-Z]?)\b', part, re.IGNORECASE)
        for cand in m:
            prefix = cand[0].upper().replace("C-", "")
            num = re.sub(r'\D', '', cand[1])
            if cand[1].upper() == "100L":
                continue # Skip "100L"
            if len(num) == 3 and num.startswith("1"):
                code = f"{prefix} {num}"
                if code in KNOWN_UI_100L_COURSES or f"C-{code}" in KNOWN_UI_100L_COURSES or len(prefix) >= 2:
                    return code

    # 3. If current_code is valid and not "ECO 100L", keep it
    if current_code and current_code not in ["ECO 100L", "100L"]:
        m = re.match(r'^([A-Z]{2,4})\s*(1\d{2}[A-Z]?)$', current_code.upper())
        if m:
            return f"{m.group(1)} {m.group(2)}"
            
    # 4. Check text snippet
    if text_snippet:
        m = re.findall(r'\b([A-Z]{2,4}|C-[A-Z]{2,4})\s*([1-9][0-9]{2}[A-Z]?)\b', text_snippet[:1500], re.IGNORECASE)
        for cand in m:
            prefix = cand[0].upper().replace("C-", "")
            num = re.sub(r'\D', '', cand[1])
            if cand[1].upper() == "100L":
                continue
            if len(num) == 3 and num.startswith("1"):
                code = f"{prefix} {num}"
                if code in KNOWN_UI_100L_COURSES:
                    return code
                    
    # 5. Check if it's general faculty material
    if "Faculty of computing" in rel_path:
        if "python" in full_str.lower():
            return "COS 102"
        if "data-science" in full_str.lower() or "data science" in full_str.lower():
            return "COS 101"
        if "information_systems" in full_str.lower():
            return "COS 101"
            
    if "Faculty of economics" in rel_path:
        if "general studies" in full_str.lower():
            return "GST 111"
        if "mankiw" in full_str.lower() or "micro" in full_str.lower() or "macro" in full_str.lower():
            return "ECO 101"
            
    return None

def refine():
    with open("data/master_materials_inventory.json", "r", encoding="utf-8") as f:
        inventory = json.load(f)
        
    refined_inventory = []
    course_counts = Counter()
    category_counts = Counter()
    
    for item in inventory:
        rel_path = item["rel_path"]
        fname = item["filename"]
        code = item["course_code"]
        text_snippet = item.get("text_snippet", "")
        
        new_code = refine_code(rel_path, fname, code, text_snippet)
        
        # Check course metadata
        meta = KNOWN_UI_100L_COURSES.get(new_code, {})
        title = meta.get("title", f"{new_code} Study Material" if new_code else "General 100-Level Study Resource")
        semester = item.get("semester") or meta.get("semester", "1st")
        
        category = item["category"]
        # If it's in a Past Questions folder or contains past question in path
        if "past questions" in rel_path.lower() or "past question" in rel_path.lower() or "pq" in fname.lower() or "test_" in rel_path.lower():
            category = "PAST_QUESTIONS"
            
        course_counts[new_code or "UNASSIGNED_OR_GENERAL"] += 1
        category_counts[category] += 1
        
        item["course_code"] = new_code
        item["course_title"] = title
        item["semester"] = semester
        item["category"] = category
        item["is_compulsory"] = True if meta else False
        item["units"] = meta.get("units", 2)
        
        refined_inventory.append(item)
        
    print(f"Total inventory items processed: {len(refined_inventory)}")
    print(f"Items with precise course code: {sum(1 for x in refined_inventory if x['course_code'])}")
    print(f"General or Multi-course items: {sum(1 for x in refined_inventory if not x['course_code'])}")
    
    print("\n--- Top Courses Mapped ---")
    for code, cnt in course_counts.most_common(35):
        print(f"  {code}: {cnt} items")
        
    print("\n--- Categories ---")
    for cat, cnt in category_counts.most_common():
        print(f"  {cat}: {cnt} items")
        
    with open("data/refined_materials_inventory.json", "w", encoding="utf-8") as f:
        json.dump(refined_inventory, f, indent=2, ensure_ascii=False)
        
    print("\nSaved refined inventory to data/refined_materials_inventory.json")

if __name__ == "__main__":
    refine()
