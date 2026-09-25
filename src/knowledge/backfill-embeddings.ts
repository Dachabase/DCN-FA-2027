import "dotenv/config";

import {
  prisma,
} from "../database/prisma";

import {
  embedTexts,
} from "./embedding.service";

// =========================================================
// M4 — BACKFILL EMBEDDINGS
// =========================================================
//
// Embeds every existing KnowledgeChunk that doesn't have one
// yet (empty embedding array). Chunks created going forward
// get embedded automatically at ingest time in
// knowledge.ingest.ts — this script is only needed once, to
// catch up the corpus ingested before M4 existed.
//
// Processes in batches: fetches a page of un-embedded chunks,
// embeds them via one batched Gemini call, writes the
// vectors back, then moves to the next page. Safe to
// interrupt and re-run — already-embedded chunks are
// automatically skipped.
//
// USAGE
//
//   npx tsx src/knowledge/backfill-embeddings.ts
//

const PAGE_SIZE = 100;

async function main() {
  console.log(
    "========================================"
  );
  console.log(
    "[BACKFILL] Starting embedding backfill"
  );
  console.log(
    "========================================"
  );

  let totalEmbedded = 0;
  let totalFailed = 0;

  while (true) {
    const chunks =
      await prisma.knowledgeChunk.findMany({
        where: {
          embedding: {
            isEmpty: true,
          },
        },
        select: {
          id: true,
          content: true,
        },
        take: PAGE_SIZE,
      });

    if (
      chunks.length === 0
    ) {
      break;
    }

    console.log(
      `[BACKFILL] Embedding batch of ${chunks.length} chunk(s)...`
    );

    try {
      const embeddings =
        await embedTexts(
          chunks.map(
            (c) => c.content
          ),
          "RETRIEVAL_DOCUMENT"
        );

      await Promise.all(
        chunks.map(
          (chunk, index) =>
            prisma.knowledgeChunk.update(
              {
                where: {
                  id: chunk.id,
                },
                data: {
                  embedding:
                    embeddings[
                      index
                    ] ?? [],
                },
              }
            )
        )
      );

      totalEmbedded +=
        chunks.length;

      console.log(
        `[BACKFILL] Progress: ${totalEmbedded} embedded so far.`
      );

      // Small pause between batches even on success, to stay
      // under free-tier per-minute limits rather than firing
      // requests back-to-back as fast as possible.
      await new Promise(
        (resolve) =>
          setTimeout(
            resolve,
            2000
          )
      );
    } catch (batchError) {
      console.error(
        `[BACKFILL] Batch failed, skipping these ${chunks.length} chunk(s) for this run:`,
        batchError instanceof
          Error
          ? batchError.message
          : batchError
      );

      // Mark them with a single zero-length placeholder
      // vector so this loop doesn't spin on the same failing
      // batch forever. A future dedicated retry pass can
      // target chunks where embedding is empty explicitly.
      totalFailed +=
        chunks.length;

      break;
    }
  }

  console.log(
    "========================================"
  );
  console.log(
    `[BACKFILL] Done. Embedded ${totalEmbedded} chunk(s). ${totalFailed > 0 ? `Stopped early after a batch failure (${totalFailed} chunk(s) not attempted further this run — re-run the script to retry).` : ""}`
  );
  console.log(
    "========================================"
  );
}

main()
  .catch((error) => {
    console.error(
      "[BACKFILL] Fatal error:",
      error
    );
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });