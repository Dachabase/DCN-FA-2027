import os
import re

TXT_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "data", "extracted_txt"))

files = sorted(os.listdir(TXT_DIR))

for fname in files:
    if not fname.endswith(".txt") or fname == "extraction_report.json":
        continue
    fpath = os.path.join(TXT_DIR, fname)
    with open(fpath, "r", encoding="utf-8") as f:
        text = f.read()
    
    pages = re.split(r"--- \[PAGE (\d+)\] ---", text)
    year_headings = []
    ans_pages = []
    for i in range(1, len(pages), 2):
        pno = int(pages[i])
        ptxt = pages[i+1]
        matches = re.findall(r"(?:UTME|JAMB)?\s*(20\d\d|19\d\d)\s+(?:[A-Z\s\-]+)?(?:QUESTIONS|EXAMINATION)", ptxt)
        if matches:
            year_headings.extend(matches)
        if re.search(r"ANSWER\s*KEYS?|ANSWERS?:", ptxt, re.IGNORECASE):
            ans_pages.append(pno)
            
    print(f"{fname}:")
    print(f"  Pages: {len(pages)//2}, Years detected: {sorted(list(set(year_headings)))[:6]}, Ans pages: {ans_pages[:6]}")
