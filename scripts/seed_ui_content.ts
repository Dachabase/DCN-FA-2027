import { prisma } from "../src/database/prisma";
import { importContentPayload } from "../src/modules/content/content.service";

async function main() {
  console.log("🌱 Starting UI Sample Content Ingestion...");

  // 1. Ensure Faculties exist
  const computingFac = await prisma.faculty.upsert({
    where: { code: "COMPUTING" },
    update: {},
    create: {
      name: "Faculty of Computing",
      code: "COMPUTING",
    },
  });

  const scienceFac = await prisma.faculty.upsert({
    where: { code: "SCIENCE" },
    update: {},
    create: {
      name: "Faculty of Science",
      code: "SCIENCE",
    },
  });

  // 2. Seed GES 107 (University-Wide UI CBT Course)
  console.log("📦 Ingesting GES 107 (Reproductive Health & STIs)...");
  await importContentPayload({
    courseCode: "GES 107",
    courseTitle: "Reproductive Health, Sexually Transmitted Infections and Human Sexuality",
    level: 100,
    semester: "1st",
    isUniversityWide: true,
    examPaper: {
      title: "GES 107 2023/2024 CBT Examination",
      sessionYear: "2023/2024",
      durationMin: 45,
      totalMarks: 40,
      sourceType: "GES_CBT_TEST",
    },
    questions: [
      {
        courseCode: "GES 107",
        topicName: "Reproductive Anatomy & Physiology",
        format: "SBA",
        stem: "In human reproductive physiology, fertilization of the ovum typically occurs in which specific region of the female reproductive tract?",
        options: [
          "A) Ampulla of the fallopian tube",
          "B) Isthmus of the fallopian tube",
          "C) Endometrial cavity",
          "D) Cervical canal",
        ],
        correctAnswer: "A",
        explanation: "The ampulla is the widest and longest portion of the fallopian tube (uterine tube) and represents the normal physiological site of fertilization.",
        distractorNotes: {
          "B": "The isthmus is narrower and closer to the uterine wall; sperm capacitation finishes earlier.",
          "C": "The endometrial cavity is the site of blastocyst implantation, not initial fertilization.",
          "D": "The cervical canal serves as a sperm reservoir and barrier, not the fertilization site.",
        },
        referenceSource: "UI GES 107 Course Monograph (2023 ed.), Module 1, p. 14",
        difficulty: "MEDIUM",
        academicSession: "2023/2024",
      },
      {
        courseCode: "GES 107",
        topicName: "Contraception & Family Planning",
        format: "SBA",
        stem: "Which of the following family planning methods offers the dual advantage of pregnancy prevention AND protection against Sexually Transmitted Infections (STIs)?",
        options: [
          "A) Combined Oral Contraceptive Pills",
          "B) Intrauterine Contraceptive Device (IUCD)",
          "C) Male and Female Latex Condoms",
          "D) Bilateral Tubal Ligation",
        ],
        correctAnswer: "C",
        explanation: "Condoms (male and female) are barrier methods that physically block fluid exchange, providing dual protection against both unintended pregnancy and transmission of viral/bacterial STIs.",
        distractorNotes: {
          "A": "Oral contraceptive pills regulate hormones to inhibit ovulation but offer zero physical barrier against microbial pathogen transmission.",
          "B": "IUCD prevents implantation in the uterus but does not protect the vaginal epithelium or cervix from STI exposure.",
          "D": "Tubal ligation is a permanent surgical sterilization method that has no barrier effect against infectious discharge.",
        },
        referenceSource: "UI GES 107 Course Monograph, Module 3, p. 38",
        difficulty: "EASY",
        academicSession: "2023/2024",
      },
      {
        courseCode: "GES 107",
        topicName: "Sexually Transmitted Infections & HIV/AIDS",
        format: "MCQ_TF",
        stem: "Regarding the Human Immunodeficiency Virus (HIV) transmission modes, determine whether each statement is True (T) or False (F):",
        options: [
          "i) Transmission occurs through sharing toilet facilities with an infected person.",
          "ii) Unprotected heterosexual and homosexual intercourse is a primary transmission route.",
          "iii) Mosquito bites can transmit viable HIV particles between humans.",
          "iv) Mother-to-child transmission can be significantly reduced using Antiretroviral Therapy (ART).",
        ],
        correctAnswer: "F, T, F, T",
        explanation: "HIV requires direct contact with infected blood, genital secretions, or breast milk. It cannot survive in vector insects or casual contact surfaces.",
        limbRationales: {
          "i": "False: HIV is fragile outside the body and cannot survive or be transmitted via inanimate toilet seats.",
          "ii": "True: Unprotected sexual exposure to infected mucosal membranes remains the predominant route of transmission worldwide.",
          "iii": "False: Mosquitoes digest ingested blood; HIV does not replicate inside insects and salivary glands do not transmit it.",
          "iv": "True: PMTCT protocols with antiretroviral regimens drop vertical transmission rates below 2-5%.",
        },
        referenceSource: "UI GES 107 Lecture Series: HIV/AIDS Epidemiology & Prevention",
        difficulty: "MEDIUM",
        academicSession: "2023/2024",
      },
      {
        courseCode: "GES 107",
        topicName: "Gender-Based Violence & Campus Safety",
        format: "SBA",
        stem: "Under University of Ibadan Gender Policy and Student Code of Conduct, what is the mandatory requirement regarding consent in sexual relations?",
        options: [
          "A) Consent is presumed unless physical resistance is actively demonstrated",
          "B) Consent must be informed, freely given, ongoing, and can be withdrawn at any time",
          "C) Prior romantic association implies irrevocable consent",
          "D) Intoxication legally substitutes for affirmative consent",
        ],
        correctAnswer: "B",
        explanation: "The UI Policy on Sexual Harassment and Gender-Based Violence states unequivocally that consent must be voluntary, conscious, mutual, and revocable at any moment.",
        distractorNotes: {
          "A": "Absence of physical resistance does not constitute consent; silence or paralysis under duress is non-consent.",
          "C": "Past consent or relationship status does not entitle any party to future sexual acts.",
          "D": "An incapacitated or intoxicated individual cannot give legal or informed consent.",
        },
        referenceSource: "University of Ibadan Gender Policy Handbook, Section 4",
        difficulty: "EASY",
        academicSession: "2023/2024",
      },
    ],
  });

  // 3. Seed MAT 111 (Algebra and Trigonometry)
  console.log("📦 Ingesting MAT 111 (Algebra & Trigonometry)...");
  await importContentPayload({
    courseCode: "MAT 111",
    courseTitle: "Algebra and Trigonometry",
    facultyCode: "SCIENCE",
    level: 100,
    semester: "1st",
    isUniversityWide: false,
    examPaper: {
      title: "MAT 111 2023/2024 Semester Examination",
      sessionYear: "2023/2024",
      durationMin: 90,
      totalMarks: 70,
      sourceType: "SEMESTER_EXAM",
    },
    questions: [
      {
        courseCode: "MAT 111",
        topicName: "Quadratic Equations and Inequalities",
        format: "SBA",
        stem: "If alpha and beta are the roots of the quadratic equation 2x^2 - 5x + 3 = 0, find the value of (alpha^2 + beta^2).",
        options: [
          "A) 13/4",
          "B) 19/4",
          "C) 25/4",
          "D) 7/4",
        ],
        correctAnswer: "A",
        explanation: "By Vieta's formulas: alpha + beta = -b/a = 5/2, and alpha * beta = c/a = 3/2. Using the algebraic identity alpha^2 + beta^2 = (alpha + beta)^2 - 2*alpha*beta: (5/2)^2 - 2*(3/2) = 25/4 - 3 = 25/4 - 12/4 = 13/4.",
        distractorNotes: {
          "B": "Arises from an arithmetic slip in subtraction (25/4 - 6/4).",
          "C": "Forgets to subtract the cross-term 2*alpha*beta.",
          "D": "Inverts the signs of the roots.",
        },
        referenceSource: "Stroud & Booth Engineering Mathematics, 7th ed., Chapter 3",
        difficulty: "MEDIUM",
        academicSession: "2023/2024",
      },
      {
        courseCode: "MAT 111",
        topicName: "Mathematical Induction & Binomial Theorem",
        format: "SBA",
        stem: "In the expansion of (x + 2/x)^8, what is the term independent of x (the constant term)?",
        options: [
          "A) 1120",
          "B) 1792",
          "C) 256",
          "D) 70",
        ],
        correctAnswer: "A",
        explanation: "The general term is T_(r+1) = C(8, r) * (x)^(8-r) * (2/x)^r = C(8, r) * 2^r * x^(8-2r). For the term independent of x, 8 - 2r = 0 => r = 4. Hence, T_5 = C(8, 4) * 2^4 = 70 * 16 = 1120.",
        distractorNotes: {
          "B": "Computed using r = 5 instead of r = 4.",
          "C": "Calculated 2^8 instead of isolating the constant power index.",
          "D": "Calculated C(8, 4) = 70 but forgot to multiply by the factor 2^4.",
        },
        referenceSource: "Backhouse Pure Mathematics 1, Binomial Expansions",
        difficulty: "HARD",
        academicSession: "2023/2024",
      },
      {
        courseCode: "MAT 111",
        topicName: "Matrices and Determinants",
        format: "SBA",
        stem: "A 2x2 matrix A has determinant det(A) = 4. If B = 3A, what is the determinant of matrix B?",
        options: [
          "A) 12",
          "B) 36",
          "C) 24",
          "D) 4",
        ],
        correctAnswer: "B",
        explanation: "For an n x n matrix, det(k * A) = k^n * det(A). For a 2x2 matrix (n = 2) with k = 3: det(3A) = 3^2 * det(A) = 9 * 4 = 36.",
        distractorNotes: {
          "A": "Common misconception multiplying directly by scalar: 3 * 4 = 12 (ignores dimensionality k^n).",
          "C": "Assumes n = 3 dimension: 27 or 2 * 12.",
          "D": "Assumes scalar multiplication does not alter the determinant.",
        },
        referenceSource: "Seymour Lipschutz, Schaum's Linear Algebra, Chapter 4",
        difficulty: "MEDIUM",
        academicSession: "2023/2024",
      },
    ],
  });

  // 4. Seed CSC 101 (Introduction to Computer Science)
  console.log("📦 Ingesting CSC 101 (Intro to Computer Science)...");
  await importContentPayload({
    courseCode: "CSC 101",
    courseTitle: "Introduction to Computer Science and Problem Solving",
    facultyCode: "COMPUTING",
    level: 100,
    semester: "1st",
    isUniversityWide: false,
    examPaper: {
      title: "CSC 101 2023/2024 Semester Examination",
      sessionYear: "2023/2024",
      durationMin: 60,
      totalMarks: 50,
      sourceType: "SEMESTER_EXAM",
    },
    questions: [
      {
        courseCode: "CSC 101",
        topicName: "Number Systems & Binary Arithmetic",
        format: "SBA",
        stem: "What is the two's complement 8-bit binary representation of the decimal integer -19?",
        options: [
          "A) 11101101",
          "B) 11101100",
          "C) 00010011",
          "D) 10010011",
        ],
        correctAnswer: "A",
        explanation: "1) Binary for +19 in 8 bits is 00010011. 2) Invert the bits (one's complement) gives 11101100. 3) Add 1 gives 11101101.",
        distractorNotes: {
          "B": "This is the one's complement before adding the final bit 1.",
          "C": "This is the positive integer representation (+19).",
          "D": "This is sign-and-magnitude representation, not two's complement.",
        },
        referenceSource: "Patterson & Hennessy, Computer Organization and Design, Appendix A",
        difficulty: "MEDIUM",
        academicSession: "2023/2024",
      },
      {
        courseCode: "CSC 101",
        topicName: "Computer Hardware & Von Neumann Architecture",
        format: "SBA",
        stem: "In the Von Neumann CPU execution cycle, which special-purpose CPU register holds the memory address of the NEXT instruction to be fetched?",
        options: [
          "A) Program Counter (PC)",
          "B) Memory Data Register (MDR)",
          "C) Instruction Register (IR)",
          "D) Accumulator (ACC)",
        ],
        correctAnswer: "A",
        explanation: "The Program Counter (PC) stores the address of the subsequent instruction to be executed from main memory, and auto-increments after each fetch cycle.",
        distractorNotes: {
          "B": "The MDR (Memory Data Register) holds data currently being transferred to or from memory.",
          "C": "The IR (Instruction Register) stores the current instruction while it is being decoded and executed.",
          "D": "The Accumulator stores arithmetic and logic results from the ALU.",
        },
        referenceSource: "Tanenbaum, Structured Computer Organization, 6th ed., Chapter 2",
        difficulty: "EASY",
        academicSession: "2023/2024",
      },
      {
        courseCode: "CSC 101",
        topicName: "Algorithms & Flowcharts",
        format: "SBA",
        stem: "In standard ANSI flowchart convention, what standard geometric symbol is used to represent a conditional branch / decision point?",
        options: [
          "A) Diamond (Rhombus)",
          "B) Rectangle",
          "C) Parallelogram",
          "D) Oval / Rounded rectangle",
        ],
        correctAnswer: "A",
        explanation: "The diamond symbol represents a decision/conditional test with two or more exiting flowlines (e.g. Yes/No, True/False).",
        distractorNotes: {
          "B": "A rectangle represents a processing step or calculation.",
          "C": "A parallelogram represents Input / Output operations.",
          "D": "An oval represents the Terminal point (Start / End).",
        },
        referenceSource: "Cormen et al., Introduction to Algorithms, Section 1.2",
        difficulty: "EASY",
        academicSession: "2023/2024",
      },
    ],
  });

  console.log("✅ UI Sample Content Ingestion Completed Successfully!");
}

main()
  .catch((e) => {
    console.error("❌ Seed error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
