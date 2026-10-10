import os
import pymupdf
import re
import json

JAMBPQ_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "jambpq"))

files = sorted(os.listdir(JAMBPQ_DIR))

results = []

for fname in files:
    if not fname.endswith(".pdf"):
        continue
    fpath = os.path.join(JAMBPQ_DIR, fname)
    doc = pymupdf.open(fpath)
    total_pages = len(doc)
    
    # Check for answer keys across all pages
    answer_key_pages = []
    question_pages = []
    year_headings = set()
    
    for pno in range(total_pages):
        txt = doc[pno].get_text()
        
        # Check years
        years_found = re.findall(r"(?:UTME|JAMB|Examination|Questions)?\s*(197\d|198\d|199\d|200\d|201\d|202\d)", txt)
        for y in years_found:
            year_headings.add(y)
            
        # Check answer keys
        if re.search(r"\bANSWER\s*KEYS?\b|\bANSWERS?\b|\bKEYS?\b", txt, re.IGNORECASE):
            # Verify if it has entries like 1. A or 1 A
            if len(re.findall(r"\b\d{1,2}\.?\s+[A-E]\b", txt)) >= 5:
                answer_key_pages.append(pno + 1)
                
        # Check questions
        if re.search(r"^\s*1[\.\)]\s+", txt, re.MULTILINE) or re.search(r"\b1\.\s+[A-Z]", txt):
            question_pages.append(pno + 1)

    doc.close()
    
    has_answers = len(answer_key_pages) > 0
    results.append({
        "file": fname,
        "pages": total_pages,
        "has_answer_keys": has_answers,
        "answer_key_pages_count": len(answer_key_pages),
        "answer_key_pages_sample": answer_key_pages[:5],
        "question_pages_count": len(question_pages),
        "years": sorted(list(year_headings)),
    })

print(json.dumps(results, indent=2))
