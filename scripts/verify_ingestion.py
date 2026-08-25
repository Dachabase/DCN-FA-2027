import os, json, zipfile, xml.etree.ElementTree as ET

GUIDE_DIR = "/Users/daviditoya/Downloads/SBAI4FA27/guide raw"
GUIDES_JSON = "/Users/daviditoya/Downloads/SBAI4FA27/src/data/guides.json"

with open(GUIDES_JSON, "r", encoding="utf-8") as f:
    guides = json.load(f)

print(f"Total Guides in JSON: {len(guides)}")

# Verify all source files
files = sorted([f for f in os.listdir(GUIDE_DIR) if f.endswith(".docx") and not f.startswith("~$")])
print(f"Total Source DOCX Files: {len(files)}")

# Check series stats
series_map = {}
for g in guides:
    if g['seriesId']:
        series_map.setdefault(g['seriesId'], []).append(g)

print("\n--- Multi-Part Series Breakdown ---")
for s_id, parts in series_map.items():
    print(f"Series [{s_id}] ({parts[0]['seriesTitle']}): {len(parts)} parts (Total = {parts[0]['seriesTotal']})")

# Spot check word counts for 5 major guides
print("\n--- Spot Checking 5 Guides for Full Content Preservation ---")
spot_checks = [
    ("Law Freshers Survival Guide (Read This Before First Semester Ends) By DCN.docx", ["guide_fac_law_survival"]),
    ("Computing Freshers Survival Guide (What Coding School Is Really Like) By DCN.docx", ["guide_fac_comp_survival"]),
    ("How to be BGS.docx", ["guide_how_to_be_bgs"]),
    ("GET GOOD AT HARD THINGS by David Itoya.docx", [f"guide_gght_part_{i}" for i in range(1, 9)]),
    ("THE PRODUCTIVE OVERTHINKER.docx", [f"guide_po_part_{i}" for i in range(1, 4)])
]

def get_docx_words(path):
    with zipfile.ZipFile(path) as z:
        xml = z.read('word/document.xml')
    root = ET.fromstring(xml)
    namespaces = {'w': 'http://schemas.openxmlformats.org/wordprocessingml/2006/main'}
    texts = [node.text for node in root.iter(f"{{{namespaces['w']}}}t") if node.text]
    return sum(len(t.split()) for t in texts)

for docx_name, g_ids in spot_checks:
    docx_path = os.path.join(GUIDE_DIR, docx_name)
    raw_words = get_docx_words(docx_path)
    guide_words = sum(len(next(g for g in guides if g['id'] == gid)['content'].split()) for gid in g_ids)
    print(f"File: {docx_name}")
    print(f"  Raw Words: {raw_words} | Extracted Guide Words: {guide_words} | Ratio: {guide_words/raw_words*100:.1f}%")

print("\n✅ Verification script completed successfully.")
