import os
import pymupdf
import json

JAMBPQ_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "jambpq"))
TXT_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "data", "extracted_txt"))
os.makedirs(TXT_DIR, exist_ok=True)

files = sorted(os.listdir(JAMBPQ_DIR))

extraction_report = []

for fname in files:
    if not fname.endswith(".pdf"):
        continue
    fpath = os.path.join(JAMBPQ_DIR, fname)
    doc = pymupdf.open(fpath)
    base_name = os.path.splitext(fname)[0]
    out_txt_path = os.path.join(TXT_DIR, f"{base_name}.txt")
    
    total_pages = len(doc)
    total_chars = 0
    pages_data = []
    
    with open(out_txt_path, "w", encoding="utf-8") as txt_out:
        txt_out.write(f"================================================================================\n")
        txt_out.write(f"SOURCE DOCUMENT: {fname}\n")
        txt_out.write(f"TOTAL PAGES: {total_pages}\n")
        txt_out.write(f"================================================================================\n\n")
        
        for pno in range(total_pages):
            page = doc[pno]
            page_text = page.get_text()
            total_chars += len(page_text)
            
            txt_out.write(f"\n--- [PAGE {pno + 1}] ---\n")
            txt_out.write(page_text)
            txt_out.write("\n")
            
    doc.close()
    
    report_entry = {
        "filename": fname,
        "txtPath": out_txt_path,
        "totalPages": total_pages,
        "totalChars": total_chars,
        "status": "extracted",
    }
    extraction_report.append(report_entry)
    print(f"Extracted {fname}: {total_pages} pages, {total_chars:,} chars -> {os.path.basename(out_txt_path)}")

report_json_path = os.path.join(TXT_DIR, "extraction_report.json")
with open(report_json_path, "w", encoding="utf-8") as r_out:
    json.dump(extraction_report, r_out, indent=2)

print("\nAll 12 PDFs extracted to data/extracted_txt/ successfully!")
