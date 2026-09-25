// =========================================================
// M5 — RETRIEVAL QUALITY TEST SET
// =========================================================
//
// Each entry is a realistic question a fresher might actually
// type into the bot, paired with what SHOULD show up in the
// results if retrieval is working.
//
// HOW TO FILL THIS IN:
//
// - "question": type it the way a student actually would —
//   casual, maybe misspelled, not textbook-phrased. That's
//   the real test. "how do i find the derivative of xsquared"
//   is a better test than "Explain differentiation rules."
//
// - "expectedFileNameContains": an array of substrings (case
//   -insensitive). If a result's fileName OR title contains
//   ANY of these, it counts as a hit. Use short, distinctive
//   fragments of the ACTUAL filename from knowledge-materials
//   — not the whole name. e.g. for
//   "PHY 102 DYNAMICS OF ROTATING RIGID BODY.pdf" you could
//   use ["ROTATING RIGID BODY"].
//   List more than one substring if several different files
//   would all be a legitimate correct answer to the question
//   (common with past questions — several PQ compilations
//   might all satisfy the same question equally well).
//
// - "notes": optional, just for your own reference later.
//
// Aim for a good spread: some easy/obvious questions (exact
// keyword matches), some paraphrased/conceptual ones (these
// are where semantic search should eventually help once the
// embedding backfill completes), and a couple of edge cases
// (very short questions, slightly misspelled course codes).
//
// You don't need courseCode here — the bot doesn't filter by
// course, it searches the whole faculty and should surface
// the right thing based on the question alone, same as a real
// student message would.
//

export interface RetrievalTestCase {
  id: string;

  question: string;

  expectedFileNameContains: string[];

  notes?: string;
}

export const retrievalTestSet: RetrievalTestCase[] =
  [
    // -----------------------------------------------------
    // EXAMPLES — replace these with your own, keep the shape
    // -----------------------------------------------------

    {
      id: "example-1",

      question:
        "what is faraday's law of induction",

      expectedFileNameContains:
        [
          "PHY104 Lectures 1 - 3 Electric Charge 080124.pdf",
        ],

      notes:
        "Example only — easy keyword match, replace me.",
    },

    {
      id: "example-2",

      question:
        "how do i work out standard deviation from a frequency table",

      expectedFileNameContains:
        [
          "Sampling Distribution",
          "Statistical Tables",
        ],

      notes:
        "Example only — paraphrased/conceptual, replace me. This is the kind of question where keyword search might miss but semantic search (once backfilled) should catch.",
    },

    // -----------------------------------------------------
    // YOUR TEST CASES GO HERE
    // -----------------------------------------------------
  ];