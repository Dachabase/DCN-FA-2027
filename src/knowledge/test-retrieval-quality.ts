import "dotenv/config";

import {
  prisma,
} from "../database/prisma";

import {
  retrieveKnowledge,
  retrieveKnowledgeHybrid,
} from "./knowledge.retrieval";

import {
  retrievalTestSet,
} from "./retrieval-tests";

import type {
  RetrievedKnowledge,
} from "./knowledge.retrieval";

// =========================================================
// M5 — RETRIEVAL QUALITY TEST RUNNER
// =========================================================
//
// Runs every case in retrieval-tests.ts against BOTH
// keyword-only retrieval and hybrid retrieval, and reports
// whether the expected source showed up in the top 6 results
// for each.
//
// Running both matters right now specifically because the
// embedding backfill is blocked on API quota — until that
// completes, hybrid results will be identical to keyword
// results (semantic search silently contributes nothing when
// no chunks have embeddings yet). Re-running this exact same
// script after the backfill finishes will show the hybrid
// column improve without any script changes, giving a real
// before/after comparison instead of no baseline at all.
//
// USAGE
//
//   npx tsx src/knowledge/test-retrieval-quality.ts
//

const TOP_K = 6;

function findHitRank(
  results: RetrievedKnowledge[],
  expectedSubstrings: string[]
): number | null {
  const needles =
    expectedSubstrings.map(
      (s) => s.toLowerCase()
    );

  for (
    let i = 0;
    i < results.length;
    i++
  ) {
    const result =
      results[i]!;

    const haystack = (
      (result.source
        .fileName ??
        "") +
      " " +
      result.source.title
    ).toLowerCase();

    if (
      needles.some(
        (needle) =>
          haystack.includes(
            needle
          )
      )
    ) {
      return i + 1; // 1-indexed rank
    }
  }

  return null;
}

async function main() {
  if (
    retrievalTestSet.length ===
    0
  ) {
    console.log(
      "No test cases yet — add some to retrieval-tests.ts and re-run."
    );
    return;
  }

  const faculty =
    await prisma.faculty.findUnique(
      {
        where: {
          name: "Computing",
        },
      }
    );

  if (!faculty) {
    throw new Error(
      "Computing faculty not found."
    );
  }

  console.log(
    "========================================"
  );
  console.log(
    `[TEST] Running ${retrievalTestSet.length} retrieval test case(s), top ${TOP_K}`
  );
  console.log(
    "========================================"
  );

  let keywordHits = 0;
  let hybridHits = 0;

  for (const testCase of retrievalTestSet) {
    const [
      keywordResults,
      hybridResults,
    ] = await Promise.all([
      retrieveKnowledge({
        query:
          testCase.question,
        facultyId: faculty.id,
        limit: TOP_K,
      }),
      retrieveKnowledgeHybrid(
        {
          query:
            testCase.question,
          facultyId:
            faculty.id,
          limit: TOP_K,
        }
      ),
    ]);

    const keywordRank =
      findHitRank(
        keywordResults,
        testCase.expectedFileNameContains
      );

    const hybridRank =
      findHitRank(
        hybridResults,
        testCase.expectedFileNameContains
      );

    if (keywordRank !== null)
      keywordHits++;
    if (hybridRank !== null)
      hybridHits++;

    console.log(
      `\n[${testCase.id}] "${testCase.question}"`
    );
    console.log(
      `  keyword: ${keywordRank ? `HIT (rank ${keywordRank})` : "MISS"}`
    );
    console.log(
      `  hybrid:  ${hybridRank ? `HIT (rank ${hybridRank})` : "MISS"}`
    );

    if (
      keywordRank === null &&
      hybridRank === null
    ) {
      console.log(
        `  top result was: ${keywordResults[0]?.source.fileName ?? keywordResults[0]?.source.title ?? "(no results at all)"}`
      );
    }
  }

  const total =
    retrievalTestSet.length;

  console.log(
    "\n========================================"
  );
  console.log(
    "[TEST] SUMMARY"
  );
  console.log(
    "========================================"
  );
  console.log(
    `Keyword: ${keywordHits}/${total} (${Math.round((keywordHits / total) * 100)}%)`
  );
  console.log(
    `Hybrid:  ${hybridHits}/${total} (${Math.round((hybridHits / total) * 100)}%)`
  );
  console.log(
    "========================================"
  );
}

main()
  .catch((error) => {
    console.error(
      "[TEST] Fatal error:",
      error
    );
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });