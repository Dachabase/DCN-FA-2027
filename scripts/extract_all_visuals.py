import os
import re
import fitz # PyMuPDF
import json

BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
PDF_DIR = os.path.join(BASE_DIR, "jambpq")
IMG_OUT_DIR = os.path.join(BASE_DIR, "public", "images", "questions")
os.makedirs(IMG_OUT_DIR, exist_ok=True)

PDF_MAP = {
    "BIO": "JAMB-Biology-Past-Questions-and-Answers.pdf",
    "PHY": "Physics-JAMB-Past-Questions.pdf",
    "CHM": "CHEMISTRY-JAMB-Past-Questions.pdf",
    "ECO": "JAMB-Economics-Past-Questions-and-Answers.pdf",
    "MTH": "MATHEMATICS-JAMB-Past-Questions.pdf"
}

def extract_subject_visuals():
    manifest = []
    total_saved = 0

    for subject, pdf_name in PDF_MAP.items():
        pdf_path = os.path.join(PDF_DIR, pdf_name)
        if not os.path.exists(pdf_path):
            print(f"Skipping {subject}: {pdf_name} not found")
            continue

        doc = fitz.open(pdf_path)
        print(f"\nProcessing [{subject}] ({len(doc)} pages)...")

        current_year = 2010
        for pno in range(len(doc)):
            page_num = pno + 1
            page = doc[pno]
            ptxt = page.get_text()

            # Detect year
            yr_m = re.findall(r"\b(19\d\d|20\d\d)\b", ptxt)
            if yr_m:
                for y in yr_m:
                    y_int = int(y)
                    if 1978 <= y_int <= 2024:
                        current_year = y_int
                        break

            # 1. Check embedded raster images
            img_list = page.get_images(full=True)
            saved_for_page = []

            for idx, img_info in enumerate(img_list):
                xref = img_info[0]
                base_img = doc.extract_image(xref)
                w, h = base_img["width"], base_img["height"]

                # Exclude trivial tiny images (icons, bullet points)
                if w < 40 or h < 40:
                    continue

                try:
                    pix = fitz.Pixmap(doc, xref)
                    if pix.colorspace is None or pix.colorspace.name not in ("DeviceRGB", "DeviceGray") or pix.n >= 5:
                        pix = fitz.Pixmap(fitz.csRGB, pix)

                    filename = f"{subject.lower()}_{current_year}_p{page_num}_img{idx}.png"
                    filepath = os.path.join(IMG_OUT_DIR, filename)
                    pix.save(filepath)
                    total_saved += 1

                    saved_for_page.append({
                        "filename": filename,
                        "url": f"/images/questions/{filename}",
                        "width": w,
                        "height": h,
                        "type": "raster",
                        "xref": xref
                    })
                except Exception as ex:
                    print(f"Warning: Failed to extract image xref {xref} on page {page_num}: {ex}")

            # 2. If Mathematics or no raster images but page has vector drawings and mentions diagram
            if subject == "MTH" or (len(saved_for_page) == 0 and any(k in ptxt.lower() for k in ["diagram", "figure", "graph", "chart", "rhombus", "triangle", "circle", "table below"])):
                drawings = page.get_drawings()
                if drawings and len(drawings) >= 5:
                    # Filter drawings to find meaningful diagrams
                    rects = [d["rect"] for d in drawings if d["rect"].width > 30 and d["rect"].height > 20]
                    if rects:
                        # Cluster rects that are vertically close
                        clusters = []
                        for r in rects:
                            added = False
                            for c in clusters:
                                # If overlaps or is vertically within 40 points
                                if abs(c.y0 - r.y0) < 60 or abs(c.y1 - r.y1) < 60 or (r.y0 <= c.y1 and r.y1 >= c.y0):
                                    c |= r
                                    added = True
                                    break
                            if not added:
                                clusters.append(fitz.Rect(r))

                        for c_idx, c_rect in enumerate(clusters[:4]):
                            # Add padding
                            padded = fitz.Rect(max(0, c_rect.x0 - 10), max(0, c_rect.y0 - 10), min(page.rect.width, c_rect.x1 + 10), min(page.rect.height, c_rect.y1 + 10))
                            if padded.width > 40 and padded.height > 30:
                                filename = f"{subject.lower()}_{current_year}_p{page_num}_vec{c_idx}.png"
                                filepath = os.path.join(IMG_OUT_DIR, filename)
                                pix = page.get_pixmap(clip=padded, dpi=150)
                                pix.save(filepath)
                                total_saved += 1
                                saved_for_page.append({
                                    "filename": filename,
                                    "url": f"/images/questions/{filename}",
                                    "width": pix.width,
                                    "height": pix.height,
                                    "type": "vector",
                                    "rect": [padded.x0, padded.y0, padded.x1, padded.y1]
                                })

            if saved_for_page:
                manifest.append({
                    "subjectCode": subject,
                    "examYear": current_year,
                    "sourcePage": page_num,
                    "images": saved_for_page,
                    "pageTextSnippet": ptxt[:500]
                })

        print(f"[{subject}] Extracted diagrams for {len([m for m in manifest if m['subjectCode'] == subject])} pages.")

    out_manifest_path = os.path.join(BASE_DIR, "data", "extracted_images_manifest.json")
    with open(out_manifest_path, "w", encoding="utf-8") as f:
        json.dump(manifest, f, indent=2)

    print(f"\nExtraction complete! Total {total_saved} visual assets extracted and saved to public/images/questions/.")
    print(f"Manifest written to: {out_manifest_path}")

if __name__ == "__main__":
    extract_subject_visuals()
