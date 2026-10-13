import { prisma } from "../src/database/prisma";
import fs from "fs";
import path from "path";

const MANIFEST_PATH = path.resolve(__dirname, "..", "data", "english_groups_manifest.json");

function determineSkill(sectionType: string, qText: string): string {
  const ql = qText.toLowerCase();
  if (sectionType === "COMPREHENSION") {
    if (ql.includes("main idea") || ql.includes("suitable title") || ql.includes("primarily concerned") || ql.includes("title for")) {
      return "Main Idea & Theme";
    } else if (ql.includes("author observes") || ql.includes("author's attitude") || ql.includes("author argues") || ql.includes("opinion of the author")) {
      return "Author's Perspective & Tone";
    } else if (ql.includes("as used in") || ql.includes("means") || ql.includes("refers to") || ql.includes("synonymous with") || ql.includes("line ")) {
      return "Vocabulary in Context";
    } else if (ql.includes("implies") || ql.includes("inferred") || ql.includes("conclusion") || ql.includes("deduced") || ql.includes("suggests")) {
      return "Inference & Deduction";
    } else {
      return "Factual Detail & Direct Comprehension";
    }
  } else if (sectionType === "CLOZE") {
    return "Cloze & Contextual Word Choice";
  } else if (sectionType === "LEXIS_AND_STRUCTURE") {
    if (ql.includes("concord") || ql.includes("neither") || ql.includes("either") || ql.includes("each") || ql.includes("plural") || ql.includes("singular")) {
      return "Concord & Subject-Verb Agreement";
    } else if (ql.includes("yesterday") || ql.includes("since") || ql.includes("had ") || ql.includes("would have") || ql.includes("tense") || ql.includes("ago")) {
      return "Tense & Aspect";
    } else if (ql.includes("preposition") || ql.includes(" in ") || ql.includes(" on ") || ql.includes(" at ") || ql.includes(" into ") || ql.includes(" with ")) {
      return "Prepositional Usage";
    } else if (ql.includes("idiom") || ql.includes("rain cats") || ql.includes("spill the beans") || ql.includes("blow hot")) {
      return "Idiomatic Expressions";
    } else {
      return "Sentence Completion & Grammatical Structure";
    }
  } else if (sectionType === "SYNONYMS") {
    return "Synonyms & Nearest in Meaning";
  } else if (sectionType === "ANTONYMS") {
    return "Antonyms & Opposite in Meaning";
  } else if (sectionType === "ORAL_ENGLISH") {
    if (ql.includes("vowel") || ql.includes("diphthong")) {
      return "Vowel Sounds & Diphthongs";
    } else if (ql.includes("consonant")) {
      return "Consonant Sounds";
    } else if (ql.includes("stress") || ql.includes("syllable") || ql.includes("capital")) {
      return "Word Stress & Syllable Accent";
    } else if (ql.includes("rhyme")) {
      return "Rhyme Patterns";
    } else {
      return "Phonetics & Oral Pronunciation";
    }
  }
  return "General English Proficiency";
}

async function applyEnglishGroups() {
  console.log("=== Applying English Language Groups & Restoring Passages ===");

  if (!fs.existsSync(MANIFEST_PATH)) {
    throw new Error("English groups manifest not found at: " + MANIFEST_PATH);
  }

  const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, "utf-8"));
  console.log(`Loaded ${manifest.length} question groups from manifest.`);

  // Load all English questions from Database
  const engQuestions = await prisma.utmeQuestion.findMany({
    where: { subjectCode: "ENG" },
    orderBy: [{ examYear: "asc" }, { originalQuestionNumber: "asc" }],
  });
  console.log(`Found ${engQuestions.length} English questions in database.`);

  let groupsCreated = 0;
  let questionsLinked = 0;
  let passagesRestored = 0;

  for (const g of manifest) {
    // 1. Upsert UtmeQuestionGroup record
    const groupRecord = await prisma.utmeQuestionGroup.upsert({
      where: { id: g.id },
      update: {
        title: g.title,
        sectionName: g.sectionName,
        sectionType: g.sectionType,
        instructions: g.instructions,
        passage: g.passage || null,
        examYear: g.year,
        orderIndex: g.orderIndex,
        sourceDocument: "Use-of-English-JAMB-Past-Questions-And-Answers.pdf",
      },
      create: {
        id: g.id,
        subjectCode: "ENG",
        title: g.title,
        sectionName: g.sectionName,
        sectionType: g.sectionType,
        instructions: g.instructions,
        passage: g.passage || null,
        examYear: g.year,
        orderIndex: g.orderIndex,
        sourceDocument: "Use-of-English-JAMB-Past-Questions-And-Answers.pdf",
      },
    });
    groupsCreated++;

    // 2. Link relevant questions
    if (g.sectionType === "COMPREHENSION" && g.passage) {
      // Extract expected question numbers or texts from questionsTextSegment
      const qNumMatches = Array.from((g.questionsTextSegment || "").matchAll(/(?:^|\n)\s*(\d{1,2})\.\s+([^\n]+)/g));
      const targetQNums = qNumMatches.map((m: any) => parseInt(m[1], 10));

      // Find matching questions for this year
      const candidates = engQuestions.filter((q) => q.examYear === g.year && targetQNums.includes(q.originalQuestionNumber));

      let orderInGroup = 1;
      for (const q of candidates) {
        const skill = determineSkill(g.sectionType, q.questionText);
        await prisma.utmeQuestion.update({
          where: { id: q.id },
          data: {
            groupId: groupRecord.id,
            sectionName: g.sectionName,
            sectionType: g.sectionType,
            passage: g.passage,
            skillTag: skill,
            groupOrder: orderInGroup++,
            topic: g.sectionName,
            syllabusTopic: skill,
          },
        });
        questionsLinked++;
        passagesRestored++;
      }
    } else {
      // Structured skill group (Lexis, Synonyms, Antonyms, Oral)
      const yearQuestions = engQuestions.filter((q) => q.examYear === g.year && !q.groupId);
      for (const q of yearQuestions) {
        const ql = q.questionText.toLowerCase();
        let matchesGroup = false;

        if (g.sectionType === "SYNONYMS" && (ql.includes("nearest in meaning") || ql.includes("conveys the meaning") || ql.includes("underlined"))) {
          matchesGroup = true;
        } else if (g.sectionType === "ANTONYMS" && (ql.includes("opposite in meaning") || ql.includes("antonym"))) {
          matchesGroup = true;
        } else if (g.sectionType === "ORAL_ENGLISH" && (ql.includes("vowel") || ql.includes("consonant") || ql.includes("stress") || ql.includes("rhyme") || ql.includes("phonetic"))) {
          matchesGroup = true;
        } else if (g.sectionType === "LEXIS_AND_STRUCTURE" && !ql.includes("opposite in meaning") && !ql.includes("nearest in meaning") && !ql.includes("stress") && !ql.includes("vowel")) {
          matchesGroup = true;
        }

        if (matchesGroup) {
          const skill = determineSkill(g.sectionType, q.questionText);
          await prisma.utmeQuestion.update({
            where: { id: q.id },
            data: {
              groupId: groupRecord.id,
              sectionName: g.sectionName,
              sectionType: g.sectionType,
              skillTag: skill,
              topic: g.sectionName,
              syllabusTopic: skill,
            },
          });
          questionsLinked++;
        }
      }
    }
  }

  // Fallback for any unlinked English questions: assign Section & Skill tags
  const remainingUnlinked = await prisma.utmeQuestion.findMany({
    where: { subjectCode: "ENG", sectionName: null },
  });

  console.log(`Processing ${remainingUnlinked.length} remaining unlinked English questions...`);
  for (const q of remainingUnlinked) {
    const ql = q.questionText.toLowerCase();
    let secName = "Section B: Lexis and Structure";
    let secType = "LEXIS_AND_STRUCTURE";
    if (ql.includes("passage") || q.passage) {
      secName = "Section A: Comprehension";
      secType = "COMPREHENSION";
    } else if (ql.includes("nearest in meaning")) {
      secName = "Section B: Lexis (Synonyms)";
      secType = "SYNONYMS";
    } else if (ql.includes("opposite in meaning")) {
      secName = "Section B: Lexis (Antonyms)";
      secType = "ANTONYMS";
    } else if (ql.includes("vowel") || ql.includes("consonant") || ql.includes("stress") || ql.includes("rhyme")) {
      secName = "Section C: Oral English";
      secType = "ORAL_ENGLISH";
    }

    const skill = determineSkill(secType, q.questionText);
    await prisma.utmeQuestion.update({
      where: { id: q.id },
      data: {
        sectionName: secName,
        sectionType: secType,
        skillTag: skill,
        topic: secName,
        syllabusTopic: skill,
      },
    });
    questionsLinked++;
  }

  // Summary audit
  const totalWithPassage = await prisma.utmeQuestion.count({
    where: { subjectCode: "ENG", passage: { not: null } },
  });
  const totalWithSkill = await prisma.utmeQuestion.count({
    where: { subjectCode: "ENG", skillTag: { not: null } },
  });
  const totalGroupsInDb = await prisma.utmeQuestionGroup.count();

  console.log(`\n============================================================`);
  console.log(`ENGLISH LANGUAGE GROUPING RESTORATION SUMMARY`);
  console.log(`Total question groups in DB: ${totalGroupsInDb}`);
  console.log(`English questions with reading passage restored: ${totalWithPassage}`);
  console.log(`English questions with section & skill tags: ${totalWithSkill}`);
  console.log(`============================================================`);
}

applyEnglishGroups()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Failed:", err);
    process.exit(1);
  });
