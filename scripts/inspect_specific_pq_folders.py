import os
import fitz

def to_win_long_path(p):
    abs_p = os.path.abspath(p)
    if os.name == 'nt' and not abs_p.startswith('\\\\?\\'):
        return '\\\\?\\' + abs_p
    return abs_p

folders_to_check = [
    r"Faculty of computing\FIRST SEMESTER -20260822T104743Z-1-001\FIRST SEMESTER_\COS 101\Past Questions",
    r"Faculty of computing\FIRST SEMESTER -20260822T104743Z-1-001\FIRST SEMESTER_\MTH 101\Past questions",
    r"Faculty of Art\First Semester -20260822T115223Z-1-001\First Semester_\BIO 101\Past questions_",
    r"Faculty of Art\First Semester -20260822T115223Z-1-001\First Semester_\CHM 101\Past questions_",
    r"Faculty of economics\New folder (4)\PAST QUESTIONS",
    r"Faculty of Law\Faculty of Law\First Semester_\C-CLL 103- Latin for Lawyers\Past Question_",
    r"Faculty of science and technology"
]

for folder in folders_to_check:
    print(f"\n==========================================")
    print(f"FOLDER: {folder}")
    print(f"==========================================")
    if not os.path.exists(to_win_long_path(folder)):
        print("Folder does not exist")
        continue
    files = []
    for root, dirs, fnames in os.walk(to_win_long_path(folder)):
        for f in fnames:
            if f.lower().endswith(('.pdf', '.docx', '.txt')):
                files.append(os.path.join(root, f))
    print(f"Total doc files in folder: {len(files)}")
    for fpath in files[:5]:
        clean_path = fpath.replace('\\\\?\\', '')
        print(f"\n* File: {os.path.basename(fpath)}")
        if fpath.lower().endswith('.pdf'):
            try:
                doc = fitz.open(to_win_long_path(fpath))
                print(f"  Pages: {len(doc)}")
                txt = doc[0].get_text() if len(doc) > 0 else ""
                lines = [l.strip() for l in txt.split("\n") if l.strip()]
                print(f"  Page 1 sample ({len(lines)} lines):")
                for l in lines[:8]:
                    print(f"    | {l[:100]}")
                doc.close()
            except Exception as e:
                print(f"  Error: {e}")
