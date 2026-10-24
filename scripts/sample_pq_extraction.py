import json
import os
import re
import fitz

def to_win_long_path(p):
    abs_p = os.path.abspath(p)
    if os.name == 'nt' and not abs_p.startswith('\\\\?\\'):
        return '\\\\?\\' + abs_p
    return abs_p

def sample_extract():
    with open("data/refined_materials_inventory.json", "r", encoding="utf-8") as f:
        inv = json.load(f)

    target_courses = ["COS 101", "MAT 111", "MTH 101", "CHM 101", "BIO 101", "ECO 101", "GES 101", "GES 107", "STA 111"]
    
    for course in target_courses:
        course_pqs = [x for x in inv if x.get("course_code") == course and (x.get("category") == "PAST_QUESTIONS" or x.get("has_questions")) and x["ext"] == ".pdf" and not x.get("is_scanned")]
        print(f"\n==========================================")
        print(f"COURSE: {course} ({len(course_pqs)} digital PDF PQ docs)")
        print(f"==========================================")
        
        for doc_item in course_pqs[:2]:
            path = doc_item["rel_path"]
            fname = doc_item["filename"]
            print(f"\n--- File: {fname} (path: {path}) ---")
            try:
                doc = fitz.open(to_win_long_path(path))
                print(f"Pages: {len(doc)}")
                for p_idx in range(min(2, len(doc))):
                    txt = doc[p_idx].get_text()
                    lines = [l.strip() for l in txt.split("\n") if l.strip()]
                    print(f"Page {p_idx+1} preview ({len(lines)} lines):")
                    for l in lines[:12]:
                        print("  >", l[:120])
                doc.close()
            except Exception as e:
                print(f"Error opening {path}: {e}")

if __name__ == "__main__":
    sample_extract()
