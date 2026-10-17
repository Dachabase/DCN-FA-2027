import json
import re
from collections import defaultdict

def analyze_courses():
    with open("data/master_materials_inventory.json", "r", encoding="utf-8") as f:
        inventory = json.load(f)
        
    print(f"Total inventory items: {len(inventory)}")
    
    # Analyze by faculty directory
    fac_courses = defaultdict(set)
    fac_categories = defaultdict(lambda: defaultdict(int))
    course_materials = defaultdict(list)
    pq_by_course = defaultdict(list)
    unassigned_files = []
    
    for item in inventory:
        fac = item["faculty_dir"]
        code = item["course_code"]
        cat = item["category"]
        
        fac_categories[fac][cat] += 1
        
        if code:
            fac_courses[fac].add(code)
            course_materials[code].append(item)
            if cat == "PAST_QUESTIONS" or item.get("has_questions"):
                pq_by_course[code].append(item)
        else:
            unassigned_files.append(item)
            
    print("\n--- Summary by Faculty Directory ---")
    for fac, cats in sorted(fac_categories.items()):
        total = sum(cats.values())
        print(f"\n{fac}: {total} files, {len(fac_courses[fac])} courses identified")
        for cat, cnt in sorted(cats.items(), key=lambda x: -x[1]):
            print(f"   {cat}: {cnt}")
            
    print(f"\nTotal files with identifiable course codes: {len(inventory) - len(unassigned_files)}")
    print(f"Files requiring finer course code classification: {len(unassigned_files)}")
    
    print("\n--- Top Courses with Materials & Past Questions ---")
    sorted_courses = sorted(course_materials.items(), key=lambda x: -len(x[1]))
    for code, items in sorted_courses[:35]:
        pqs = len(pq_by_course[code])
        print(f"  {code}: {len(items)} materials ({pqs} past question/test docs)")

if __name__ == "__main__":
    analyze_courses()
