import os
import re
import json

TXT_PATH = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "data", "extracted_txt", "JAMB-Biology-Past-Questions-and-Answers.txt"))

with open(TXT_PATH, "r", encoding="utf-8") as f:
    text = f.read()

# Split by pages
pages = re.split(r"--- \[PAGE (\d+)\] ---", text)
print(f"Total page segments: {len(pages)}")

# Let's inspect pages where "UTME 20" or "ANSWER KEYS" occur
for i in range(1, len(pages), 2):
    pno = int(pages[i])
    ptxt = pages[i+1]
    if "UTME 20" in ptxt:
        print(f"Page {pno} has exam heading: {ptxt[:100].replace(chr(10), ' ')}")
    if "ANSWER KEYS" in ptxt or re.search(r"^\s*1[\.\)]\s+[A-E]\b", ptxt, re.MULTILINE):
        print(f"Page {pno} has answer keys!")
