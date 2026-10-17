import os
import sys
import re
import json
import pymupdf as fitz
from collections import defaultdict, Counter

def to_win_long_path(p):
    abs_p = os.path.abspath(p)
    if os.name == 'nt' and not abs_p.startswith('\\\\?\\'):
        return '\\\\?\\' + abs_p
    return abs_p

COURSE_TITLES = {
    "COS 101": "Introduction to Computer Science & Computing",
    "COS 102": "Problem Solving & Programming in Python",
    "CSC 101": "Introduction to Computer Science",
    "MTH 101": "Elementary Mathematics I (Algebra & Trigonometry)",
    "MTH 102": "Elementary Mathematics II (Calculus)",
    "MTH 103": "Elementary Mathematics III (Vectors, Geometry & Dynamics)",
    "MAT 111": "Algebra & Trigonometry (Special)",
    "PHY 101": "General Physics I (Mechanics)",
    "PHY 102": "General Physics II (Electricity & Magnetism)",
    "PHY 103": "General Physics III (Waves, Optics & Modern Physics)",
    "PHY 104": "Practical Physics Laboratory I",
    "CHM 101": "General Physical Chemistry",
    "CHM 102": "General Inorganic & Organic Chemistry",
    "BIO 101": "Cell Biology & Genetics",
    "BIO 102": "Organismal Biology",
    "STA 111": "Probability & Statistics I",
    "STA 114": "General Statistics & Data Sources",
    "STA 115": "Introductory Applied Statistics",
    "GST 111": "Communication in English I",
    "GST 112": "Nigerian Peoples and Culture",
    "GES 101": "Use of English & Communication Skills",
    "GES 107": "Reproductive Health, STIs and Human Rights",
    "GES 108": "Introduction to French",
    "ECO 101": "Principles of Economics I (Microeconomics)",
    "ECO 102": "Principles of Economics II (Macroeconomics)",
    "ACC 101": "Introduction to Financial Accounting I",
    "SOC 101": "Introduction to Sociology I",
    "SOC 105": "Elements of Social Structure & Organization",
    "PSY 101": "Introduction to Psychology I",
    "POS 103": "The Organization of Government",
    "PUL 101": "Introduction to Legal Method I",
    "CLL 103": "Latin for Lawyers",
}

# High-yield canonical concept flashcards grounded in UI 100L lecture notes
CANONICAL_HIGH_YIELD_CARDS = [
    # COS 101 / CSC 101
    {
        "courseCode": "COS 101",
        "topic": "Computer Architecture & Hardware",
        "front": "What is the difference between a Bit, a Byte, and a Nibble?",
        "back": "A Bit is a single binary digit (0 or 1). A Nibble consists of 4 bits. A Byte consists of 8 bits.",
        "explanation": "Fundamental digital unit of storage. Computer memories address information at byte and word boundaries.",
        "difficulty": "EASY"
    },
    {
        "courseCode": "COS 101",
        "topic": "CPU Components",
        "front": "What does the Memory Address Register (MAR) do?",
        "back": "The MAR holds the memory address of data or instructions that the CPU needs to access in RAM during a read or write operation.",
        "explanation": "MAR works closely with the Memory Data Register (MDR) in the CPU's Von Neumann fetch-execute cycle.",
        "difficulty": "MEDIUM"
    },
    {
        "courseCode": "COS 101",
        "topic": "Number Systems",
        "front": "Convert decimal number 25 to binary.",
        "back": "11001₂ (16 + 8 + 1 = 25).",
        "explanation": "Divide 25 successively by 2: 25/2=12 R1, 12/2=6 R0, 6/2=3 R0, 3/2=1 R1, 1/2=0 R1. Reading remainders bottom-up gives 11001.",
        "difficulty": "MEDIUM"
    },
    {
        "courseCode": "COS 101",
        "topic": "Operating Systems",
        "front": "What is the primary role of an Operating System (OS)?",
        "back": "An OS manages computer hardware and software resources (CPU scheduling, memory allocation, I/O devices, file system) and provides a user interface.",
        "explanation": "Acts as an intermediary between the user/applications and the raw computer hardware.",
        "difficulty": "EASY"
    },
    # COS 102 / Python Programming
    {
        "courseCode": "COS 102",
        "topic": "Python Data Structures",
        "front": "What is the key difference between a Python List and a Python Tuple?",
        "back": "Lists are mutable (can be changed in-place: appended, modified), while Tuples are immutable (cannot be changed after creation).",
        "explanation": "Lists use square brackets `[]`, while tuples use parentheses `()`. Tuples are hashable and faster for fixed data.",
        "difficulty": "EASY"
    },
    {
        "courseCode": "COS 102",
        "topic": "Control Structures",
        "front": "What does Python's `range(1, 10, 2)` generate?",
        "back": "Values: 1, 3, 5, 7, 9 (starts at 1, stops before 10, step size of 2).",
        "explanation": "Range in Python follows `range(start, stop, step)` where `stop` is strictly exclusive.",
        "difficulty": "EASY"
    },
    # MTH 101 / MAT 111
    {
        "courseCode": "MTH 101",
        "topic": "Algebra - Mathematical Induction",
        "front": "What are the two fundamental steps of Mathematical Induction?",
        "back": "1. Base Step (Basis): Prove statement P(n) is true for initial value n = 1.\n2. Inductive Step: Assume P(k) is true (inductive hypothesis), and prove that P(k + 1) is necessarily true.",
        "explanation": "Once both steps are verified, P(n) holds for all positive integers n by the Principle of Mathematical Induction.",
        "difficulty": "MEDIUM"
    },
    {
        "courseCode": "MTH 101",
        "topic": "Complex Numbers",
        "front": "State De Moivre's Theorem for complex numbers.",
        "back": "(cos θ + i sin θ)ⁿ = cos(nθ) + i sin(nθ) for any integer or rational n.",
        "explanation": "Essential for calculating powers and finding the n-th roots of complex numbers.",
        "difficulty": "MEDIUM"
    },
    {
        "courseCode": "MTH 101",
        "topic": "Sequences & Series",
        "front": "What is the formula for the sum of an infinite convergent Geometric Progression (GP)?",
        "back": "S∞ = a / (1 - r), where |r| < 1, 'a' is the first term, and 'r' is the common ratio.",
        "explanation": "If |r| ≥ 1, the geometric series diverges and does not have a finite sum.",
        "difficulty": "MEDIUM"
    },
    # MTH 102 (Calculus)
    {
        "courseCode": "MTH 102",
        "topic": "Differential Calculus",
        "front": "State the Product Rule for differentiation.",
        "back": "d/dx [u · v] = u(dv/dx) + v(du/dx).",
        "explanation": "The derivative of a product of two differentiable functions is the first times derivative of second plus second times derivative of first.",
        "difficulty": "EASY"
    },
    {
        "courseCode": "MTH 102",
        "topic": "Integral Calculus",
        "front": "State the Integration by Parts formula.",
        "back": "∫ u dv = u·v - ∫ v du.",
        "explanation": "Derived directly from the product rule of differentiation, used when integrating products of algebraic and transcendental functions.",
        "difficulty": "MEDIUM"
    },
    # PHY 101 (Mechanics)
    {
        "courseCode": "PHY 101",
        "topic": "Newton's Laws of Motion",
        "front": "State Newton's Second Law of Motion in mathematical terms.",
        "back": "F_net = dp/dt = m·a (Force equals rate of change of momentum, or mass times acceleration for constant mass).",
        "explanation": "SI unit of force is the Newton (N = kg·m/s²).",
        "difficulty": "EASY"
    },
    {
        "courseCode": "PHY 101",
        "topic": "Work & Energy",
        "front": "State the Work-Energy Theorem.",
        "back": "W_net = ΔK = (1/2)mv_f² - (1/2)mv_i² (Net work done on an object equals its change in kinetic energy).",
        "explanation": "Work is a scalar quantity given by W = F · d · cos(θ).",
        "difficulty": "MEDIUM"
    },
    # PHY 102 (Electricity & Magnetism)
    {
        "courseCode": "PHY 102",
        "topic": "Electrostatics",
        "front": "State Coulomb's Law for electrostatic force.",
        "back": "F = (1 / 4πε₀) · (|q₁·q₂| / r²), where ε₀ is permittivity of free space (8.854 × 10⁻¹² F/m).",
        "explanation": "Electrostatic force is directly proportional to product of charges and inversely proportional to square of distance.",
        "difficulty": "MEDIUM"
    },
    {
        "courseCode": "PHY 102",
        "topic": "Circuit Theory",
        "front": "State Kirchhoff's Current Law (KCL) and Voltage Law (KVL).",
        "back": "KCL: Sum of currents entering a node equals sum of currents leaving (Conservation of Charge).\nKVL: Sum of potential differences around any closed loop is zero (Conservation of Energy).",
        "explanation": "Fundamental laws for analyzing multi-loop DC and AC electrical circuits.",
        "difficulty": "MEDIUM"
    },
    # CHM 101 (Physical Chemistry)
    {
        "courseCode": "CHM 101",
        "topic": "Chemical Thermodynamics",
        "front": "What is the Gibbs Free Energy equation and what does ΔG < 0 signify?",
        "back": "ΔG = ΔH - TΔS. When ΔG < 0, the reaction or process is spontaneous at constant temperature and pressure.",
        "explanation": "If ΔG = 0, the system is at chemical equilibrium. If ΔG > 0, the reaction is non-spontaneous.",
        "difficulty": "MEDIUM"
    },
    {
        "courseCode": "CHM 101",
        "topic": "Gas Laws",
        "front": "State the Ideal Gas Equation and identify each variable.",
        "back": "PV = nRT. P = Pressure (atm/Pa), V = Volume (L/m³), n = moles, R = Gas constant (0.0821 L·atm/(mol·K)), T = Absolute temperature (K).",
        "explanation": "Combines Boyle's Law, Charles's Law, and Avogadro's Law for ideal gas behavior.",
        "difficulty": "EASY"
    },
    # CHM 102 (Organic & Inorganic Chemistry)
    {
        "courseCode": "CHM 102",
        "topic": "Organic Chemistry - Hybridization",
        "front": "What are the hybridizations and bond angles of Carbon in Alkanes, Alkenes, and Alkynes?",
        "back": "Alkanes (single bonds): sp³, 109.5° (tetrahedral).\nAlkenes (double bond): sp², 120° (trigonal planar).\nAlkynes (triple bond): sp, 180° (linear).",
        "explanation": "Directly explains the spatial geometry and reactivity of hydrocarbon functional groups.",
        "difficulty": "MEDIUM"
    },
    # BIO 101 (Cell Biology & Genetics)
    {
        "courseCode": "BIO 101",
        "topic": "Cell Structure",
        "front": "What are the four primary structural differences between Plant and Animal cells?",
        "back": "Plant cells have: 1. Rigid Cellulose Cell Wall, 2. Chloroplasts for photosynthesis, 3. Large Central Vacuole, 4. Plasmodesmata. Animal cells have centrioles/centrosomes and lack cell walls and chloroplasts.",
        "explanation": "Plant cells maintain turgor pressure due to cell wall and central vacuole.",
        "difficulty": "EASY"
    },
    {
        "courseCode": "BIO 101",
        "topic": "Mendelian Genetics",
        "front": "State Mendel's First Law (Law of Segregation).",
        "back": "During gamete formation, the two alleles for each gene segregate from each other so that each gamete carries only one allele for each gene.",
        "explanation": "Demonstrated by the 3:1 phenotypic ratio in monohybrid F2 offspring.",
        "difficulty": "MEDIUM"
    },
    # STA 111 (Statistics)
    {
        "courseCode": "STA 111",
        "topic": "Measurement Scales",
        "front": "List the four measurement scales of data in order of mathematical sophistication.",
        "back": "1. Nominal (categories without order, e.g. blood group).\n2. Ordinal (ordered categories with unequal intervals, e.g. class rank).\n3. Interval (ordered, equal intervals, no true zero, e.g. Celsius temperature).\n4. Ratio (ordered, equal intervals, true absolute zero, e.g. height, weight).",
        "explanation": "Ratio scale permits all mathematical operations including multiplication and division.",
        "difficulty": "MEDIUM"
    },
    {
        "courseCode": "STA 111",
        "topic": "Probability Rules",
        "front": "State the Addition Rule for two mutually exclusive events A and B.",
        "back": "P(A ∪ B) = P(A) + P(B). (Since mutually exclusive means A ∩ B = ∅, so P(A ∩ B) = 0).",
        "explanation": "For non-mutually exclusive events, P(A ∪ B) = P(A) + P(B) - P(A ∩ B).",
        "difficulty": "EASY"
    },
    # ECO 101 (Microeconomics)
    {
        "courseCode": "ECO 101",
        "topic": "Supply & Demand",
        "front": "What is the Law of Demand, and what does 'Ceteris Paribus' mean?",
        "back": "The Law of Demand states that as price increases, quantity demanded decreases, and vice versa. 'Ceteris Paribus' means 'all other factors held constant'.",
        "explanation": "Results in a downward-sloping demand curve from left to right.",
        "difficulty": "EASY"
    },
    {
        "courseCode": "ECO 101",
        "topic": "Elasticity",
        "front": "How is Price Elasticity of Demand (PED) calculated, and when is demand classified as elastic?",
        "back": "PED = (% Change in Quantity Demanded) / (% Change in Price). Demand is Elastic when |PED| > 1.",
        "explanation": "If |PED| = 1, unitary elastic. If |PED| < 1, inelastic (quantity demanded responds relatively little to price changes).",
        "difficulty": "MEDIUM"
    },
    # GES 107 (Reproductive Health)
    {
        "courseCode": "GES 107",
        "topic": "Reproductive Health & HIV/AIDS",
        "front": "What are the four primary routes of HIV transmission?",
        "back": "1. Unprotected sexual intercourse with an infected person.\n2. Contact with infected blood/blood products (transfusion, shared sharp objects).\n3. Mother-to-child transmission (during pregnancy, labor, or breastfeeding).\n4. Organ or tissue transplantation from an infected donor.",
        "explanation": "HIV cannot be transmitted through casual contact, sweat, mosquito bites, or sharing utensils.",
        "difficulty": "EASY"
    },
    {
        "courseCode": "GES 107",
        "topic": "Sexuality & Adolescence",
        "front": "What is the comprehensive definition of Sexuality Education?",
        "back": "A planned educational process providing accurate information, values, and decision-making skills to enable individuals to adopt healthy and safe sexual practices.",
        "explanation": "Key objective of GES 107 curriculum at University of Ibadan.",
        "difficulty": "EASY"
    },
    # GST 111 / GES 101 (Communication in English)
    {
        "courseCode": "GST 111",
        "topic": "Sentence Structure & Syntax",
        "front": "What is a Compound-Complex sentence?",
        "back": "A sentence containing at least two independent clauses joined by a coordinating conjunction or semicolon, and at least one dependent (subordinate) clause.",
        "explanation": "Example: 'Although it rained heavily (dependent), the students attended the lecture (independent), and they completed their test (independent).'",
        "difficulty": "MEDIUM"
    },
    # LAW / PUL 101
    {
        "courseCode": "PUL 101",
        "topic": "Sources of Nigerian Law",
        "front": "What are the primary sources of Nigerian Law?",
        "back": "1. The Constitution of the Federal Republic of Nigeria (Supreme law).\n2. Legislation (Acts of National Assembly, Laws of State Houses of Assembly).\n3. Judicial Precedents (Case law/Common law principles).\n4. Customary Law and Islamic Law.\n5. Received English Law (Common law, Doctrines of Equity, Statutes of General Application as at 1900).",
        "explanation": "Section 1(1) of CFRN 1999 establishes constitutional supremacy over all other laws.",
        "difficulty": "MEDIUM"
    },
    {
        "courseCode": "CLL 103",
        "topic": "Latin Legal Maxims",
        "front": "Translate and explain the legal maxim 'Audi alteram partem'.",
        "back": "'Hear the other side' (or 'listen to the second party'). It embodies the fundamental rule of natural justice that no person shall be condemned unheard.",
        "explanation": "Twin pillar of natural justice alongside 'Nemo judex in causa sua' (no one should be a judge in their own cause).",
        "difficulty": "EASY"
    }
]

def generate_flashcards():
    print("Generating comprehensive 100-Level Course Flashcard Decks...")
    all_cards = list(CANONICAL_HIGH_YIELD_CARDS)

    # In addition to the canonical high-yield cards, generate concept cards
    # from the verified past questions that have clear educational explanations
    try:
        with open("data/extracted_100l_questions.json", "r", encoding="utf-8") as f:
            questions = json.load(f)
            
        # Select best 5 questions per course to convert to active recall flashcards
        by_course = defaultdict(list)
        for q in questions:
            if q.get("verificationStatus") == "VERIFIED" and len(q.get("options", [])) >= 2:
                by_course[q["courseCode"]].append(q)
                
        for course_code, q_list in by_course.items():
            for q in q_list[:8]: # 8 cards per course from past questions
                correct_opt = q.get("correctAnswer", "A")
                opt_text = ""
                for opt in q.get("options", []):
                    if opt.startswith(correct_opt):
                        opt_text = opt
                        break
                if not opt_text and q.get("options"):
                    opt_text = q["options"][0]
                    
                all_cards.append({
                    "courseCode": course_code,
                    "topic": q.get("topic") or "Past Question Concept",
                    "front": f"Concept Check: {q['questionText']}",
                    "back": opt_text,
                    "explanation": q.get("explanation") or f"Official University of Ibadan past examination question ({q.get('examYear')}).",
                    "sourceDocument": q.get("sourceDocument"),
                    "sourcePage": q.get("sourcePage"),
                    "verificationStatus": "VERIFIED",
                    "difficulty": "MEDIUM"
                })
    except Exception as e:
        print(f"Notice during question-to-flashcard generation: {e}")

    print(f"Total flashcards generated: {len(all_cards)}")
    by_c = Counter(c["courseCode"] for c in all_cards)
    print("Flashcards by course:")
    for c, cnt in by_c.most_common(20):
        print(f"  {c}: {cnt} cards")

    out_file = "data/generated_100l_flashcards.json"
    with open(out_file, "w", encoding="utf-8") as f:
        json.dump(all_cards, f, indent=2, ensure_ascii=False)
    print(f"Saved flashcards to {out_file}")

if __name__ == "__main__":
    generate_flashcards()
