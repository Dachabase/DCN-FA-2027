import os
import re
import json

TXT_PATH = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "data", "extracted_txt", "Use-of-English-JAMB-Past-Questions-And-Answers.txt"))
OUT_JSON = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "data", "english_groups_manifest.json"))

with open(TXT_PATH, "r", encoding="utf-8") as f:
    full_text = f.read()

pages_raw = re.split(r"--- \[PAGE (\d+)\] ---", full_text)

# Build a continuous page list
pages = {}
for i in range(1, len(pages_raw), 2):
    pno = int(pages_raw[i])
    ptxt = pages_raw[i+1]
    # Clean standard footer/header spam
    ptxt = re.sub(r"Download MySchoolGist.*", "", ptxt, flags=re.IGNORECASE)
    ptxt = re.sub(r"www\.myschoolgist\.com.*", "", ptxt, flags=re.IGNORECASE)
    pages[pno] = ptxt

print(f"Loaded {len(pages)} pages of English text.")

# Group pages into Years
year_ranges = [
    (1978, 1, 18),
    (1979, 19, 37),
    (1980, 38, 56),
    (1981, 57, 75),
    (1982, 76, 94),
    (1983, 95, 113),
    (1984, 114, 132),
    (1985, 133, 150),
    (1986, 151, 168),
    (1987, 169, 182),
    (1988, 183, 199),
    (1989, 200, 215),
    (1990, 216, 231),
    (1991, 232, 248),
    (1992, 249, 264),
    (1993, 265, 280),
    (1994, 281, 296),
    (1995, 297, 313),
    (1997, 314, 329),
    (1998, 330, 345),
    (1999, 346, 360),
    (2000, 361, 375),
    (2001, 376, 389),
    (2002, 390, 406),
    (2003, 407, 422),
    (2004, 423, 438),
    (2005, 439, 455),
    (2007, 456, 473),
    (2008, 474, 488),
    (2009, 489, 504),
    (2010, 505, 520)
]

def determine_skill(section_type, q_text):
    ql = q_text.lower()
    if section_type == "COMPREHENSION":
        if any(w in ql for w in ["main idea", "suitable title", "title for the passage", "passage is primarily concerned"]):
            return "Main Idea & Theme"
        elif any(w in ql for w in ["author observes", "author's attitude", "author argues", "opinion of the author"]):
            return "Author's Perspective & Tone"
        elif any(w in ql for w in ["as used in the passage", "means", "refers to", "synonymous with", "definition of"]):
            return "Vocabulary in Context"
        elif any(w in ql for w in ["implies", "inferred", "conclusion", "deduced", "suggests"]):
            return "Inference & Deduction"
        else:
            return "Factual Detail & Direct Comprehension"
    elif section_type == "CLOZE":
        return "Cloze & Contextual Word Choice"
    elif section_type == "LEXIS_AND_STRUCTURE":
        if any(w in ql for w in ["concord", "neither", "either", "each", "plural", "singular"]):
            return "Concord & Subject-Verb Agreement"
        elif any(w in ql for w in ["yesterday", "since", "had", "would have", "tense", "ago"]):
            return "Tense & Aspect"
        elif any(w in ql for w in ["in", "on", "at", "by", "with", "into", "onto", "preposition"]):
            return "Prepositional Usage"
        elif any(w in ql for w in ["idiom", "rain cats", "blow hot", "spill the beans"]):
            return "Idiomatic Expressions"
        else:
            return "Sentence Completion & Grammatical Structure"
    elif section_type == "SYNONYMS":
        return "Synonyms & Nearest in Meaning"
    elif section_type == "ANTONYMS":
        return "Antonyms & Opposite in Meaning"
    elif section_type == "ORAL_ENGLISH":
        if "vowel" in ql:
            return "Vowel Sounds & Diphthongs"
        elif "consonant" in ql:
            return "Consonant Sounds"
        elif "stress" in ql:
            return "Word Stress & Syllable Accent"
        elif "rhyme" in ql:
            return "Rhyme Patterns"
        else:
            return "Phonetics & Oral Pronunciation"
    return "General English Proficiency"

all_groups = []

for year, start_p, end_p in year_ranges:
    # Concatenate year text
    year_text = "\n".join(pages.get(p, "") for p in range(start_p, end_p + 1))
    
    # 1. Extract Comprehension Passages
    # Matches: PASSAGE A, PASSAGE B, PASSAGE 1, etc.
    p_splits = re.split(r"(?:^|\n)\s*(PASSAGE\s+[A-Z0-9]+|PASSAGE\s+I|PASSAGE\s+II|PASSAGE\s+III|PASSAGE\s+IV|PASSAGE\s+V)", year_text, flags=re.IGNORECASE)
    
    comp_groups = []
    if len(p_splits) > 1:
        for k in range(1, len(p_splits), 2):
            pass_title = p_splits[k].strip().upper()
            pass_body = p_splits[k+1]
            
            # Find where question 1 or question N starts
            # E.g. \n1. or \n6. or \n11.
            q_start_m = re.search(r"(?:^|\n)\s*(\d{1,2})\.\s+", pass_body)
            if q_start_m:
                pass_text = pass_body[:q_start_m.start()].strip()
                # Clean multiple whitespaces
                pass_text = " ".join(pass_text.split())
                
                # Check minimum passage length
                if len(pass_text) > 120:
                    group_id = f"GRP-ENG-{year}-COMP-{pass_title.replace(' ', '_')}"
                    comp_groups.append({
                        "id": group_id,
                        "year": year,
                        "title": f"UTME {year} {pass_title}",
                        "sectionName": f"Section A: Comprehension ({pass_title})",
                        "sectionType": "COMPREHENSION",
                        "instructions": "Read the passage carefully and answer the questions that follow it.",
                        "passage": pass_text,
                        "orderIndex": len(comp_groups) + 1,
                        "questionsTextSegment": pass_body[q_start_m.start():q_start_m.start() + 4000]
                    })
    
    # 2. Extract Instruction-based sections:
    # Lexis & Structure, Synonyms, Antonyms, Oral
    section_patterns = [
        ("SYNONYMS", r"(?:nearest in meaning|best conveys the meaning of the underlined|conveys the same meaning)", "Section B: Lexis (Synonyms)", "In each of questions, choose the option nearest in meaning to the word or phrase in bold or underlined."),
        ("ANTONYMS", r"(?:opposite in meaning)", "Section B: Lexis (Antonyms)", "In each of questions, choose the option opposite in meaning to the word or phrase in bold or underlined."),
        ("LEXIS_AND_STRUCTURE", r"(?:best completes each of the following sentences|most suitably fills the space|fill the blank|appropriate option to complete)", "Section B: Lexis and Structure", "Choose the option that best completes the sentence."),
        ("ORAL_ENGLISH", r"(?:same vowel sound|same consonant sound|stress|rhyme with|phonetic)", "Section C: Oral English", "Choose the option that represents the appropriate phonetic sound, stress pattern, or rhyme.")
    ]
    
    other_groups = []
    for s_type, s_pat, s_name, s_inst in section_patterns:
        m = re.search(s_pat, year_text, re.IGNORECASE)
        if m:
            group_id = f"GRP-ENG-{year}-{s_type}"
            other_groups.append({
                "id": group_id,
                "year": year,
                "title": f"UTME {year} {s_name}",
                "sectionName": s_name,
                "sectionType": s_type,
                "instructions": s_inst,
                "passage": None,
                "orderIndex": len(comp_groups) + len(other_groups) + 1,
                "questionsTextSegment": None
            })
            
    all_groups.extend(comp_groups)
    all_groups.extend(other_groups)
    print(f"Year {year}: Found {len(comp_groups)} Comprehension Passages, {len(other_groups)} Structured Skill Groups.")

print(f"\nTotal English question groups created: {len(all_groups)}")
with open(OUT_JSON, "w", encoding="utf-8") as f:
    json.dump(all_groups, f, indent=2)
print(f"Manifest written to: {OUT_JSON}")
