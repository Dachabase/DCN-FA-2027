import re
import os
import json

# Comprehensive emoji regex pattern
EMOJI_PATTERN = re.compile(
    "["
    "\U0001F600-\U0001F64F"  # emoticons
    "\U0001F300-\U0001F5FF"  # symbols & pictographs
    "\U0001F680-\U0001F6FF"  # transport & map symbols
    "\U0001F700-\U0001F77F"  # alchemical symbols
    "\U0001F780-\U0001F7FF"  # Geometric Shapes Extended
    "\U0001F800-\U0001F8FF"  # Supplemental Arrows-C
    "\U0001F900-\U0001F9FF"  # Supplemental Symbols and Pictographs
    "\U0001FA00-\U0001FA6F"  # Chess Symbols
    "\U0001FA70-\U0001FAFF"  # Symbols and Pictographs Extended-A
    "\U00002600-\U000026FF"  # Misc symbols (sun, umbrella, warning, etc.)
    "\U00002700-\U000027BF"  # Dingbats (scissors, checkmark, cross, etc.)
    "\U00002B50"              # star
    "\U0000231A-\U0000231B"  # watch, hourglass
    "\U000023E9-\U000023EC"  # fast forward, rewind
    "\U000023F0-\U000023F3"  # alarm clock, hourglass
    "\U000025AA-\U000025AB"  # small squares
    "\U000025B6"              # play
    "\U000025C0"              # reverse
    "\U000025FB-\U000025FE"  # medium squares
    "]+",
    flags=re.UNICODE
)

TARGET_DIRS = ["public", "src"]
EXCLUDE_DIRS = ["node_modules", "dist", "generated"]

TARGET_FILES = []
for d in TARGET_DIRS:
    for root, dirs, files in os.walk(d):
        dirs[:] = [x for x in dirs if x not in EXCLUDE_DIRS]
        for f in files:
            if f.endswith((".html", ".js", ".ts", ".css")):
                TARGET_FILES.append(os.path.join(root, f))

inventory = []

for file_rel in TARGET_FILES:
    file_path = os.path.join(os.getcwd(), file_rel)
    if not os.path.exists(file_path):
        continue
    
    with open(file_path, "r", encoding="utf-8", errors="ignore") as f:
        lines = f.readlines()
        
    for line_idx, line in enumerate(lines, 1):
        matches = list(EMOJI_PATTERN.finditer(line))
        for m in matches:
            emoji = m.group(0)
            start, end = m.span()
            # extract snippet
            snippet_start = max(0, start - 30)
            snippet_end = min(len(line), end + 30)
            snippet = line[snippet_start:snippet_end].strip()
            
            inventory.append({
                "file": file_rel,
                "line": line_idx,
                "emoji": emoji,
                "snippet": snippet,
                "char_codes": [f"U+{ord(c):04X}" for c in emoji]
            })

print(f"Total emoji occurrences found across UI files: {len(inventory)}")

summary_by_file = {}
for item in inventory:
    f = item["file"]
    summary_by_file[f] = summary_by_file.get(f, 0) + 1

for f, count in summary_by_file.items():
    print(f"- {f}: {count} occurrences")

# Save detailed inventory JSON
with open("data/emoji_audit_inventory.json", "w", encoding="utf-8") as f:
    json.dump(inventory, f, indent=2, ensure_ascii=False)

print("Saved detailed inventory to data/emoji_audit_inventory.json")
