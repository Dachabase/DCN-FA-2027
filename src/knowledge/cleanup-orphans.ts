import "dotenv/config";

import {
  prisma,
} from "../database/prisma";

// =========================================================
// CLEANUP ORPHANED KNOWLEDGE SOURCES
// =========================================================
//
// Finds KnowledgeSource rows that have a checksum set but
// zero associated KnowledgeChunk rows — these are leftovers
// from ingestion runs that failed after creating the source
// but before (or during) chunk creation, prior to the
// createKnowledgeSourceWithChunks() transaction fix.
//
// Without cleanup, these orphans get permanently skipped by
// the batch ingester's checksum-dedup check, since it only
// checks "does a source with this checksum exist", not
// "does it actually have content".
//
// USAGE
//
//   npx tsx src/knowledge/cleanup-orphans.ts          (dry run — lists only)
//   npx tsx src/knowledge/cleanup-orphans.ts --delete (actually deletes)
//

async function main() {
  const shouldDelete =
    process.argv.includes(
      "--delete"
    );

  console.log(
    "========================================"
  );
  console.log(
    `[CLEANUP] Mode: ${shouldDelete ? "DELETE" : "DRY RUN (pass --delete to actually remove)"}`
  );
  console.log(
    "========================================"
  );

  const sources =
    await prisma.knowledgeSource.findMany({
      where: {
        checksum: {
          not: null,
        },
      },
      include: {
        _count: {
          select: {
            chunks: true,
          },
        },
      },
    });

  const orphans =
    sources.filter(
      (s) =>
        s._count.chunks === 0
    );

  console.log(
    `[CLEANUP] Checked ${sources.length} sources with a checksum, found ${orphans.length} orphan(s) with zero chunks.`
  );

  for (const orphan of orphans) {
    console.log(
      `  - ${orphan.id} | ${orphan.title} | fileName=${orphan.fileName ?? "-"}`
    );
  }

  if (
    orphans.length === 0
  ) {
    console.log(
      "[CLEANUP] Nothing to do."
    );
    return;
  }

  if (!shouldDelete) {
    console.log(
      "\n[CLEANUP] Dry run only — re-run with --delete to actually remove these rows."
    );
    return;
  }

  const result =
    await prisma.knowledgeSource.deleteMany({
      where: {
        id: {
          in: orphans.map(
            (o) => o.id
          ),
        },
      },
    });

  console.log(
    `[CLEANUP] Deleted ${result.count} orphan source(s).`
  );
}

main()
  .catch((error) => {
    console.error(
      "[CLEANUP] Fatal error:",
      error
    );
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });