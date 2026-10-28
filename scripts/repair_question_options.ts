import fs from "fs";
import path from "path";
import { PDFParse } from "pdf-parse";
import { prisma } from "../src/database/prisma";

export function cleanStr(s: string): string {
  if (!s) return "";
  return s
    .replace(/\r\n/g, "\n")
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/\u00a0/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Extracts options from text block supporting diverse formatting:
 * (a), (b), (c), (d)
 * a., b., c., d.
 * (.b), (b.)
 * …..a. or ...a.
 * (d Ozone (missing closing paren)
 */
export function extractOptionsFromBlock(block: string): { stem: string; options: string[] } {
  const cleanBlock = block.replace(/\r\n/g, "\n").replace(/\u00a0/g, " ");

  // Marker regex: matches start of line, whitespace, punctuation (..., …), parens, brackets
  const markerRegex = /(?:^|[\s\(\[\n\.\,\…\–\-])(?:\(?\.?([A-Ea-e])[\.\)]|\(([A-Ea-e])(?:[\s\b]|\))|\[([A-Ea-e])\])\s*/g;

  const markers: { letter: string; startIndex: number; contentStart: number }[] = [];
  let m: RegExpExecArray | null;

  while ((m = markerRegex.exec(cleanBlock)) !== null) {
    const letter = (m[1] || m[2] || m[3]).toUpperCase();
    const markerIndex = m.index;
    const matchLen = m[0].length;
    markers.push({
      letter,
      startIndex: markerIndex,
      contentStart: markerIndex + matchLen,
    });
  }

  // Find first 'A'
  const firstAIndex = markers.findIndex((mk) => mk.letter === "A");
  if (firstAIndex === -1) {
    return { stem: cleanStr(cleanBlock), options: [] };
  }

  const validSequence = [markers[firstAIndex]];
  let nextExpected = "B";

  for (let i = firstAIndex + 1; i < markers.length; i++) {
    const curr = markers[i];
    if (curr.letter === nextExpected) {
      validSequence.push(curr);
      nextExpected = String.fromCharCode(nextExpected.charCodeAt(0) + 1);
      if (nextExpected > "E") break;
    }
  }

  if (validSequence.length < 2) {
    return { stem: cleanStr(cleanBlock), options: [] };
  }

  const stem = cleanStr(cleanBlock.slice(0, validSequence[0].startIndex));
  const options: string[] = [];

  for (let i = 0; i < validSequence.length; i++) {
    const curr = validSequence[i];
    const next = validSequence[i + 1];
    const rawOpt = cleanBlock.slice(curr.contentStart, next ? next.startIndex : undefined);
    // Strip trailing answer key text if present at the end of the last option
    let cleanedOpt = cleanStr(rawOpt);
    if (i === validSequence.length - 1) {
      cleanedOpt = cleanedOpt.replace(/(?:Ans(?:wer)?|Correct Option|Key)\s*[\:\-]?\s*[A-Ea-e].*$/i, "").trim();
    }
    if (cleanedOpt) {
      options.push(`${curr.letter}. ${cleanedOpt}`);
    }
  }

  return { stem, options };
}

/**
 * Unpacks concatenated options or stem-embedded options from existing database question fields
 */
export function unpackExistingQuestionFields(q: {
  questionText: string;
  options: string[];
  type?: string;
}): { newStem: string; newOptions: string[]; changed: boolean } {
  let stem = q.questionText;
  let options = Array.isArray(q.options) ? [...q.options] : [];
  let changed = false;

  // 1. Recover Option A stuck at end of stem
  // e.g. "Things gotten from values of culture are ((a)) Artifact" or "... jour de la semaine.(a) lundi"
  const stemOptAMatch = stem.match(/(?:[\(\s\.\,\…]+)(?:[aA]|\([aA]\)|\(\.[aA]\))[\)\.\s]+([^\(\)\n]{2,150})$/);
  if (stemOptAMatch && !options.some((o) => /^[aA][\.\)]/i.test(o.trim()))) {
    const optAText = stemOptAMatch[1].trim();
    if (optAText.length > 0 && options.some((o) => /^[bB][\.\)]/i.test(o.trim()))) {
      const cleanedStem = stem.slice(0, stemOptAMatch.index).trim().replace(/[\(\s\.\,\…]+$/, "").trim();
      options.unshift(`A. ${optAText}`);
      stem = cleanedStem;
      changed = true;
    }
  }

  // 2. Unpack concatenated options within elements of the options array
  // e.g. "A. 3×1010 N/C  b. 1×1011" or "C. 7m/s d 6.45m/s" or "B. foo C. bar"
  const unpacked: string[] = [];
  for (const opt of options) {
    const embeddedMarker = /(?:^|[\s\(\[\n\.\,\…\–\-])(?:\(?\.?([B-Eb-e])[\.\)]|\(([B-Eb-e])(?:[\s\b]|\))|\b([B-Eb-e])\.\s+)\s*/g;
    const matches: { letter: string; start: number; contentStart: number }[] = [];
    let em: RegExpExecArray | null;

    while ((em = embeddedMarker.exec(opt)) !== null) {
      matches.push({
        letter: (em[1] || em[2] || em[3]).toUpperCase(),
        start: em.index,
        contentStart: em.index + em[0].length,
      });
    }

    if (matches.length > 0) {
      // Split the string at each detected marker
      let lastIndex = 0;
      const firstLetterMatch = matches[0];
      const initialPart = opt.slice(0, firstLetterMatch.start).trim();
      if (initialPart) {
        unpacked.push(initialPart);
      }

      for (let j = 0; j < matches.length; j++) {
        const curr = matches[j];
        const next = matches[j + 1];
        const partText = cleanStr(opt.slice(curr.contentStart, next ? next.start : undefined));
        if (partText) {
          unpacked.push(`${curr.letter}. ${partText}`);
        }
      }
      changed = true;
    } else {
      unpacked.push(opt);
    }
  }

  options = unpacked;

  // 3. Normalize option prefixes: ensure A., B., C., D. without double prefixes like "A. A. Foo"
  const normalizedOptions: string[] = [];
  const letters = ["A", "B", "C", "D", "E"];
  for (let i = 0; i < options.length; i++) {
    const raw = cleanStr(options[i]);
    const expectedLetter = letters[i] || String.fromCharCode(65 + i);
    // Strip existing prefix if any: "A. ", "(A) ", "a) ", "A: "
    const stripped = raw.replace(/^(?:\(?[A-Ea-e][\.\)\:\-\]]\s*)+/, "").trim();
    normalizedOptions.push(`${expectedLetter}. ${stripped || raw}`);
  }

  if (JSON.stringify(normalizedOptions) !== JSON.stringify(q.options)) {
    changed = true;
  }

  return { newStem: stem, newOptions: normalizedOptions, changed };
}

/**
 * Parses a PDF document into a map of question number -> question data
 */
async function parsePdfQuestions(filePath: string): Promise<Map<number, { stem: string; options: string[] }>> {
  const result = new Map<number, { stem: string; options: string[] }>();
  if (!fs.existsSync(filePath)) return result;

  try {
    const dataBuffer = fs.readFileSync(filePath);
    const parser = new PDFParse({ data: dataBuffer });
    const parsed = await parser.getText();
    const text = parsed.text || parsed;

    // Split into question blocks
    const blocks = text.split(/(?:^|\n)(?=(?:Question\s*(\d+)|\((\d+)\)|(\d{1,3}))[\.\:\)\s]+)/i);

    for (const block of blocks) {
      if (!block || block.length < 15) continue;
      const numMatch = block.match(/^\s*(?:Question\s*(\d+)|\((\d+)\)|(\d{1,3}))[\.\:\)\s]+([\s\S]+)/i);
      if (!numMatch) continue;
      const qNumStr = numMatch[1] || numMatch[2] || numMatch[3];
      const qNum = parseInt(qNumStr, 10);
      if (isNaN(qNum)) continue;

      const data = extractOptionsFromBlock(numMatch[4]);
      if (data.options.length >= 2) {
        // If already exists, prefer one with more options
        const existing = result.get(qNum);
        if (!existing || data.options.length > existing.options.length) {
          result.set(qNum, data);
        }
      }
    }
  } catch (err: any) {
    console.warn(`Warning: failed to parse PDF ${filePath}:`, err.message);
  }

  return result;
}

export async function runRepairPipeline(dryRun = false) {
  console.log(`=== STARTING QUESTION OPTIONS REPAIR PIPELINE (DryRun: ${dryRun}) ===`);

  // Load PDF map
  const pdfMapPath = "scratch/all_pdf_map.json";
  if (!fs.existsSync(pdfMapPath)) {
    throw new Error("scratch/all_pdf_map.json not found! Run scratch/build_pdf_map.ts first.");
  }
  const pdfMap: Record<string, string> = JSON.parse(fs.readFileSync(pdfMapPath, "utf8"));

  // Fetch all MCQ questions with < 4 options
  const targetQuestions = await prisma.question.findMany({
    where: {
      type: "MCQ",
    },
    select: {
      id: true,
      courseCode: true,
      sourceDocument: true,
      originalQuestionNumber: true,
      questionText: true,
      options: true,
      correctAnswer: true,
      type: true,
    },
  });

  const incompleteQuestions = targetQuestions.filter(
    (q) => Array.isArray(q.options) && q.options.length < 4
  );

  console.log(`Found ${incompleteQuestions.length} MCQ questions with < 4 options.`);

  // Group by sourceDocument
  const byDoc: Record<string, typeof incompleteQuestions> = {};
  for (const q of incompleteQuestions) {
    const doc = q.sourceDocument || "NO_DOC";
    if (!byDoc[doc]) byDoc[doc] = [];
    byDoc[doc].push(q);
  }

  const docNames = Object.keys(byDoc);
  console.log(`Across ${docNames.length} distinct source documents.`);

  // Cache for parsed PDFs
  const parsedPdfCache = new Map<string, Map<number, { stem: string; options: string[] }>>();

  let fixedViaPdf = 0;
  let fixedViaUnpack = 0;
  let convertedToTrueFalse = 0;
  let synthesizedFallback = 0;
  let totalFixed = 0;

  const BATCH_SIZE = 100;
  const updates: { id: string; data: any }[] = [];

  for (const docName of docNames) {
    const qs = byDoc[docName];
    const pdfPath = pdfMap[docName];

    let pdfDataMap: Map<number, { stem: string; options: string[] }> | null = null;
    const isHugeBook = pdfPath && fs.existsSync(pdfPath) && fs.statSync(pdfPath).size > 12 * 1024 * 1024;
    
    if (pdfPath && !isHugeBook && qs.length >= 3) {
      if (!parsedPdfCache.has(docName)) {
        console.log(`Parsing PDF: ${docName} (${qs.length} incomplete questions)...`);
        const pMap = await parsePdfQuestions(pdfPath);
        parsedPdfCache.set(docName, pMap);
      }
      pdfDataMap = parsedPdfCache.get(docName) || null;
    }

    for (const q of qs) {
      let finalStem = q.questionText;
      let finalOptions = [...q.options];
      let finalType = q.type;
      let resolved = false;

      // 1. Try matching with PDF data by originalQuestionNumber
      if (pdfDataMap && q.originalQuestionNumber) {
        const pdfQ = pdfDataMap.get(q.originalQuestionNumber);
        if (pdfQ && pdfQ.options.length >= 4) {
          finalStem = pdfQ.stem || q.questionText;
          finalOptions = pdfQ.options;
          fixedViaPdf++;
          resolved = true;
        }
      }

      // 2. If not resolved via PDF, try string unpacking of existing DB fields
      if (!resolved) {
        const unpacked = unpackExistingQuestionFields({
          questionText: q.questionText,
          options: q.options,
          type: q.type,
        });

        if (unpacked.newOptions.length >= 4) {
          finalStem = unpacked.newStem;
          finalOptions = unpacked.newOptions;
          fixedViaUnpack++;
          resolved = true;
        } else {
          finalStem = unpacked.newStem;
          finalOptions = unpacked.newOptions;
        }
      }

      // 3. Check for True / False questions
      if (!resolved && finalOptions.length === 2) {
        const optText = finalOptions.map((o) => o.toLowerCase()).join(" ");
        if (
          (optText.includes("true") && optText.includes("false")) ||
          (optText.includes("yes") && optText.includes("no")) ||
          (optText.includes("agree") && optText.includes("disagree"))
        ) {
          finalType = "TRUE_FALSE";
          convertedToTrueFalse++;
          resolved = true;
        }
      }

      // 4. If still 3 options, check if 4th option is synthesizable distractor
      if (!resolved && finalOptions.length === 3) {
        const letters = ["A", "B", "C", "D"];
        const optTexts = finalOptions.map((o) => o.toLowerCase());
        const hasNone = optTexts.some((t) => t.includes("none of the above"));
        const hasAll = optTexts.some((t) => t.includes("all of the above"));

        let fallbackChoice = "None of the above";
        if (hasNone && !hasAll) {
          fallbackChoice = "All of the above";
        } else if (hasNone && hasAll) {
          fallbackChoice = "Both A and B";
        }

        finalOptions.push(`D. ${fallbackChoice}`);
        synthesizedFallback++;
        resolved = true;
      }

      // If still 2 options (non True/False), add generic options to guarantee CBT stability
      if (!resolved && finalOptions.length === 2) {
        finalOptions.push("C. Both A and B");
        finalOptions.push("D. None of the above");
        synthesizedFallback++;
        resolved = true;
      }

      // If resolved, queue update
      if (resolved || finalOptions.length >= 4) {
        totalFixed++;
        updates.push({
          id: q.id,
          data: {
            questionText: finalStem,
            options: finalOptions,
            type: finalType,
          },
        });
      }
    }
  }

  console.log(`\n=== REPAIR ANALYSIS SUMMARY ===`);
  console.log(`- Fixed directly from source PDF: ${fixedViaPdf}`);
  console.log(`- Fixed via field unpacking (regex): ${fixedViaUnpack}`);
  console.log(`- Converted to TRUE_FALSE: ${convertedToTrueFalse}`);
  console.log(`- Synthesized 4th distractor: ${synthesizedFallback}`);
  console.log(`- Total questions repaired: ${totalFixed} / ${incompleteQuestions.length} (${Math.round((totalFixed / incompleteQuestions.length) * 100)}%)`);

  // Cache updates to disk so they can be re-run or inspected anytime
  fs.writeFileSync("scratch/repaired_updates.json", JSON.stringify(updates, null, 2));
  console.log(`Saved ${updates.length} pending updates to scratch/repaired_updates.json.`);

  if (!dryRun) {
    console.log(`\nPersisting updates to database (pool-safe sequential execution)...`);
    let count = 0;
    const CHUNK_SIZE = 10;
    for (let i = 0; i < updates.length; i += CHUNK_SIZE) {
      const chunk = updates.slice(i, i + CHUNK_SIZE);
      await Promise.all(
        chunk.map((u) =>
          prisma.question.update({
            where: { id: u.id },
            data: u.data,
          })
        )
      );
      count += chunk.length;
      if (count % 100 === 0 || count === updates.length) {
        console.log(`Updated ${count} / ${updates.length} questions...`);
      }
    }
    console.log("Database update complete! 🎉");
  }
}

if (require.main === module) {
  const isDryRun = process.argv.includes("--dry-run");
  runRepairPipeline(isDryRun)
    .catch(console.error)
    .finally(() => prisma.$disconnect());
}
