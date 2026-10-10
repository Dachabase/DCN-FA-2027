import os
import pymupdf
import re

JAMBPQ_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "jambpq"))

files = [
    "CHEMISTRY-JAMB-Past-Questions.pdf",
    "COMMERCE-JAMB-Past-Questions.pdf",
    "CRK-JAMB-Past-Questions.pdf",
    "Government-JAMB-Past-Questions-And-Answers.pdf",
    "JAMB-Biology-Past-Questions-and-Answers.pdf",
    "JAMB-Economics-Past-Questions-and-Answers.pdf",
    "Literature-In-English-JAMB-Past-Questions-and-Answers.pdf",
    "MATHEMATICS-JAMB-Past-Questions.pdf",
    "Physics-JAMB-Past-Questions.pdf",
    "Principles-of-Accounts-JAMB-Past-Questions.pdf",
    "Use-of-English-JAMB-Past-Questions-And-Answers.pdf",
]

for fname in files:
    fpath = os.path.join(JAMBPQ_DIR, fname)
    if not os.path.exists(fpath):
        continue
    doc = pymupdf.open(fpath)
    print("="*60)
    print(f"FILE: {fname} (Pages: {len(doc)})")
    print("="*60)
    
    # Check first 3 pages
    text_p1 = doc[0].get_text() if len(doc) > 0 else ""
    text_p2 = doc[1].get_text() if len(doc) > 1 else ""
    text_p3 = doc[2].get_text() if len(doc) > 2 else ""
    
    # Check last 3 pages (often contains answer keys!)
    last_p = doc[-1].get_text() if len(doc) > 0 else ""
    prev_last_p = doc[-2].get_text() if len(doc) > 1 else ""

    print("--- SAMPLE PAGE 1 & 2 ---")
    print((text_p1 + "\n" + text_p2)[:700])
    
    # Search for answer patterns
    has_answer_keys = False
    answer_samples = []
    for pno in range(len(doc)):
        ptxt = doc[pno].get_text()
        if re.search(r"\bANSWER[S]?\b|\bANS\b|\bANSWER KEY\b|\bSOLUTION[S]?\b", ptxt, re.IGNORECASE):
            matches = re.findall(r"([0-9]{1,3}\s*[\.:\-]?\s*[A-E]\b|[0-9]{1,3}\s*[A-E]\b)", ptxt)
            if len(matches) > 5:
                has_answer_keys = True
                answer_samples.append((pno+1, ptxt[:300]))
                if len(answer_samples) >= 2:
                    break

    print(f"Detected Answer Keys: {has_answer_keys}")
    if answer_samples:
        for pno, samp in answer_samples:
            print(f"Answer Key on Page {pno}:")
            print(samp[:200])

    doc.close()
