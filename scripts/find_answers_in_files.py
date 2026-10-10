import os
import re

TXT_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "data", "extracted_txt"))

target_files = [
    "CHEMISTRY-JAMB-Past-Questions.txt",
    "MATHEMATICS-JAMB-Past-Questions.txt",
    "Physics-JAMB-Past-Questions.txt",
    "COMMERCE-JAMB-Past-Questions.txt",
    "CRK-JAMB-Past-Questions.txt",
    "Principles-of-Accounts-JAMB-Past-Questions.txt",
    "Use-of-English-JAMB-Past-Questions-And-Answers.txt",
    "Government-JAMB-Past-Questions-And-Answers.txt",
]

for fname in target_files:
    fpath = os.path.join(TXT_DIR, fname)
    with open(fpath, "r", encoding="utf-8") as f:
        lines = f.readlines()
    
    matches = []
    for idx, l in enumerate(lines):
        if re.search(r"\bANSWER[S]?\b|\bANS\b|\bKEY[S]?\b", l, re.IGNORECASE):
            matches.append((idx + 1, l.strip()[:60]))
            
    print(f"=== {fname} ({len(matches)} matches) ===")
    for line_num, text in matches[:10]:
        print(f"  Line {line_num}: {text}")
