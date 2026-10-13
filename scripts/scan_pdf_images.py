import os
import re
import fitz # PyMuPDF
from PIL import Image
import json

BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
PDF_DIR = os.path.join(BASE_DIR, "jambpq")
IMG_DIR = os.path.join(BASE_DIR, "public", "images", "questions")
os.makedirs(IMG_DIR, exist_ok=True)

PDF_MAP = {
    "BIO": "JAMB-Biology-Past-Questions-and-Answers.pdf",
    "PHY": "Physics-JAMB-Past-Questions.pdf",
    "MTH": "MATHEMATICS-JAMB-Past-Questions.pdf",
    "CHM": "CHEMISTRY-JAMB-Past-Questions.pdf",
    "ECO": "JAMB-Economics-Past-Questions-and-Answers.pdf",
    "GOV": "Government-JAMB-Past-Questions-And-Answers.pdf",
    "ACC": "Principles-of-Accounts-JAMB-Past-Questions.pdf",
    "COM": "COMMERCE-JAMB-Past-Questions.pdf",
    "CRK": "CRK-JAMB-Past-Questions.pdf",
    "LIT": "Literature-In-English-JAMB-Past-Questions-and-Answers.pdf",
    "ENG": "Use-of-English-JAMB-Past-Questions-And-Answers.pdf"
}

def analyze_pdfs():
    print("=== Scanning PDFs for Embedded Images ===")
    results = {}
    for code, fname in PDF_MAP.items():
        fpath = os.path.join(PDF_DIR, fname)
        if not os.path.exists(fpath):
            continue
        doc = fitz.open(fpath)
        img_pages = []
        total_imgs = 0
        for pno in range(len(doc)):
            page = doc[pno]
            imgs = page.get_images(full=True)
            if imgs:
                # Filter out tiny icon images (< 30x30)
                valid_imgs = []
                for img_info in imgs:
                    xref = img_info[0]
                    base = doc.extract_image(xref)
                    if base["width"] >= 40 and base["height"] >= 40:
                        valid_imgs.append((xref, base["width"], base["height"], base["ext"]))
                if valid_imgs:
                    total_imgs += len(valid_imgs)
                    img_pages.append((pno + 1, valid_imgs))
        results[code] = {
            "pdf": fname,
            "totalPages": len(doc),
            "imagePagesCount": len(img_pages),
            "totalImages": total_imgs,
            "samplePages": [p[0] for p in img_pages[:10]]
        }
        print(f"[{code}] {fname}: {total_imgs} valid diagram images across {len(img_pages)} pages (Total pages: {len(doc)})")
    
    with open(os.path.join(BASE_DIR, "scratch", "pdf_images_scan.json"), "w") as f:
        json.dump(results, f, indent=2)

if __name__ == "__main__":
    analyze_pdfs()
