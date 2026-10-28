import { prisma } from "../src/database/prisma";

export interface ValidationIssue {
  id: string;
  courseCode: string;
  issue: string;
  details: string;
}

export async function validateQuestionBank(): Promise<{
  totalChecked: number;
  validCount: number;
  invalidCount: number;
  issues: ValidationIssue[];
}> {
  console.log("================================================================================");
  console.log("🔍 RUNNING AUTOMATED QUESTION BANK VALIDATION SUITE");
  console.log("================================================================================");

  const questions = await prisma.question.findMany({
    select: {
      id: true,
      courseCode: true,
      questionText: true,
      options: true,
      correctAnswer: true,
      explanation: true,
      type: true,
    },
  });

  const issues: ValidationIssue[] = [];

  for (const q of questions) {
    const code = q.courseCode || "UNKNOWN";

    // 1. Stem completeness
    if (!q.questionText || q.questionText.trim().length < 3) {
      issues.push({
        id: q.id,
        courseCode: code,
        issue: "STEM_TOO_SHORT",
        details: `Stem length is ${q.questionText ? q.questionText.length : 0} chars.`,
      });
    }

    // 2. Options validation for MCQ
    if (q.type === "MCQ") {
      if (!Array.isArray(q.options) || q.options.length < 4) {
        issues.push({
          id: q.id,
          courseCode: code,
          issue: "INCOMPLETE_OPTIONS",
          details: `Found only ${Array.isArray(q.options) ? q.options.length : 0} options. Expected >= 4.`,
        });
      } else {
        // Verify unique options
        const unique = new Set(q.options.map((o) => o.trim().toLowerCase()));
        if (unique.size !== q.options.length) {
          issues.push({
            id: q.id,
            courseCode: code,
            issue: "DUPLICATE_OPTIONS",
            details: `Found duplicate option content: ${JSON.stringify(q.options)}`,
          });
        }

        // Verify prefixes: A., B., C., D.
        const letters = ["A", "B", "C", "D", "E"];
        for (let i = 0; i < Math.min(q.options.length, 5); i++) {
          const expected = `${letters[i]}.`;
          if (!q.options[i].startsWith(expected)) {
            issues.push({
              id: q.id,
              courseCode: code,
              issue: "INVALID_OPTION_PREFIX",
              details: `Option index ${i} ('${q.options[i].slice(0, 15)}') does not start with '${expected}'`,
            });
            break;
          }
        }
      }
    }

    // 3. Answer key validity
    if (!q.correctAnswer || !/^[A-E]$/i.test(q.correctAnswer.trim())) {
      issues.push({
        id: q.id,
        courseCode: code,
        issue: "INVALID_ANSWER_KEY",
        details: `Answer key '${q.correctAnswer}' is not a valid single letter A-E.`,
      });
    } else if (Array.isArray(q.options) && q.options.length > 0) {
      const availableLetters = q.options.map((o) => o.charAt(0).toUpperCase());
      if (!availableLetters.includes(q.correctAnswer.toUpperCase())) {
        issues.push({
          id: q.id,
          courseCode: code,
          issue: "ANSWER_NOT_IN_OPTIONS",
          details: `Correct answer '${q.correctAnswer}' not found among options: ${availableLetters.join(", ")}`,
        });
      }
    }

    // 4. Stray characters and Mojibake
    const textToCheck = `${q.questionText} ${Array.isArray(q.options) ? q.options.join(" ") : ""}`;
    if (/â€™|â€œ|â€|&#39;|&quot;|&amp;|&lt;|&gt;/.test(textToCheck)) {
      issues.push({
        id: q.id,
        courseCode: code,
        issue: "MOJIBAKE_OR_HTML_ENTITIES",
        details: `Detected unescaped entities or Mojibake in question content.`,
      });
    }

    if (/'[a-zA-Z0-9]'/.test(q.questionText) || q.questionText.includes("' '")) {
      issues.push({
        id: q.id,
        courseCode: code,
        issue: "STRAY_QUOTES",
        details: `Detected single-quote corruption in stem: '${q.questionText.slice(0, 60)}'`,
      });
    }
  }

  const validCount = questions.length - new Set(issues.map((i) => i.id)).size;
  const invalidCount = questions.length - validCount;

  console.log(`\n=== VALIDATION RESULTS ===`);
  console.log(`Total questions checked: ${questions.length}`);
  console.log(`✅ Fully valid questions: ${validCount} (${Math.round((validCount / questions.length) * 100)}%)`);
  console.log(`🚨 Issues detected: ${issues.length} across ${invalidCount} questions`);

  if (issues.length > 0) {
    console.log(`\nSample issues (first 10):`);
    for (const is of issues.slice(0, 10)) {
      console.log(`- [${is.courseCode}] (${is.id}): ${is.issue} -> ${is.details}`);
    }
  }

  return {
    totalChecked: questions.length,
    validCount,
    invalidCount,
    issues,
  };
}

if (require.main === module) {
  validateQuestionBank()
    .then((res) => {
      if (res.issues.length > 0) {
        process.exit(1);
      } else {
        console.log("All structural validation checks passed successfully! 🎉");
        process.exit(0);
      }
    })
    .catch((err) => {
      console.error(err);
      process.exit(1);
    })
    .finally(() => prisma.$disconnect());
}

