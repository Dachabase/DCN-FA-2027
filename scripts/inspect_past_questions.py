import json
from collections import Counter

def inspect_pqs():
    with open("data/refined_materials_inventory.json", "r", encoding="utf-8") as f:
        inv = json.load(f)
        
    pqs = [x for x in inv if x["category"] == "PAST_QUESTIONS" or x.get("has_questions")]
    print(f"Total Past Questions / Test Documents: {len(pqs)}")
    
    courses_with_pq = Counter()
    scanned_pq = 0
    digital_pq = 0
    exts = Counter()
    
    for item in pqs:
        code = item.get("course_code") or "GENERAL_OR_MULTI"
        courses_with_pq[code] += 1
        if item.get("is_scanned"):
            scanned_pq += 1
        else:
            digital_pq += 1
        exts[item["ext"]] += 1
        
    print(f"Digital text PQ documents: {digital_pq}")
    print(f"Scanned image PQ documents: {scanned_pq}")
    print("\nFormats of PQ docs:")
    for ext, cnt in exts.most_common():
        print(f"  {ext}: {cnt}")
        
    print(f"\nTotal distinct courses with PQ docs: {len(courses_with_pq)}")
    print("\nTop 25 Courses with PQ documents:")
    for code, cnt in courses_with_pq.most_common(25):
        print(f"  {code}: {cnt} documents")

if __name__ == "__main__":
    inspect_pqs()
