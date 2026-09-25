import "dotenv/config";

import crypto from "node:crypto";

import {
  prisma,
} from "../database/prisma";

// =========================================================
// M3 — CONTENT-LEVEL DEDUPLICATION
// =========================================================
//
// Two-part script:
//
// 1. BACKFILL: sources ingested before contentChecksum
//    existed have it as NULL. This computes it from their
//    already-stored chunks (same derivation used going
//    forward at ingest time: chunk contents joined with
//    "\n\n", then SHA-256) and saves it.
//
// 2. DEDUP: groups ACTIVE sources by (facultyId,
//    contentChecksum) and reports any group with more than
//    one member — these are files that differ at the byte
//    level but contain identical extracted content. The
//    oldest source in each group is kept as canonical; the
//    rest are candidates for archiving.
//
// USAGE
//
//   npx tsx src/knowledge/dedupe-content.ts            (backfill + report only)
//   npx tsx src/knowledge/dedupe-content.ts --archive   (also archive duplicates)
//

// A minimum combined-content length before two sources are
// even eligible to be compared for content-level duplication.
// Below this, extracted text is dominated by boilerplate,
// watermarks, or near-empty OCR noise — coincidentally
// identical short strings across UNRELATED documents are
// common in this corpus (e.g. shared cover-page text from a
// redistribution source), and would otherwise cause false-
// positive duplicate matches between genuinely different
// documents. Sources below this threshold are simply not
// compared at all (contentChecksum stays NULL for them).
const MIN_CONTENT_LENGTH_FOR_DEDUP = 500;

function computeContentChecksum(
  chunkContents: string[]
): string {
  const joined =
    chunkContents.join(
      "\n\n"
    );

  return crypto
    .createHash("sha256")
    .update(joined)
    .digest("hex");
}

async function backfillMissingChecksums() {
  const sources =
    await prisma.knowledgeSource.findMany({
      where: {
        contentChecksum: null,
      },
      include: {
        chunks: {
          orderBy: {
            chunkIndex: "asc",
          },
          select: {
            content: true,
          },
        },
      },
    });

  console.log(
    `[DEDUPE] Found ${sources.length} source(s) missing contentChecksum.`
  );

  let backfilled = 0;
  let skippedEmpty = 0;
  let skippedTooShort = 0;

  for (const source of sources) {
    if (
      source.chunks.length === 0
    ) {
      skippedEmpty++;
      continue;
    }

    const contents =
      source.chunks.map(
        (c) => c.content
      );

    const totalLength =
      contents.join(
        "\n\n"
      ).length;

    if (
      totalLength <
      MIN_CONTENT_LENGTH_FOR_DEDUP
    ) {
      skippedTooShort++;
      continue;
    }

    const contentChecksum =
      computeContentChecksum(
        contents
      );

    await prisma.knowledgeSource.update({
      where: {
        id: source.id,
      },
      data: {
        contentChecksum,
      },
    });

    backfilled++;
  }

  console.log(
    `[DEDUPE] Backfilled ${backfilled} source(s). Skipped ${skippedEmpty} with zero chunks, ${skippedTooShort} below the ${MIN_CONTENT_LENGTH_FOR_DEDUP}-char dedup threshold.`
  );
}

async function findAndHandleDuplicates(
  shouldArchive: boolean
) {
  const sources =
    await prisma.knowledgeSource.findMany({
      where: {
        status: "ACTIVE",
        contentChecksum: {
          not: null,
        },
      },
      select: {
        id: true,
        title: true,
        fileName: true,
        facultyId: true,
        contentChecksum: true,
        createdAt: true,
        metadata: true,
      },
      orderBy: {
        createdAt: "asc",
      },
    });

  const groups = new Map<
    string,
    typeof sources
  >();

  for (const source of sources) {
    const key = `${source.facultyId}::${source.contentChecksum}`;

    const existing =
      groups.get(key) ?? [];

    existing.push(source);

    groups.set(
      key,
      existing
    );
  }

  const duplicateGroups =
    [...groups.values()].filter(
      (g) => g.length > 1
    );

  console.log(
    `[DEDUPE] Checked ${sources.length} active sources, found ${duplicateGroups.length} duplicate group(s).`
  );

  let archivedCount = 0;

  for (const group of duplicateGroups) {
    const [
      canonical,
      ...duplicates
    ] = group; // oldest first, already sorted by createdAt asc

    console.log(
      `\n  Group (${group.length} sources):`
    );
    console.log(
      `    KEEP:    ${canonical.id} | ${canonical.fileName ?? canonical.title} | ${canonical.createdAt.toISOString()}`
    );

    for (const dup of duplicates) {
      console.log(
        `    ${shouldArchive ? "ARCHIVE" : "DUPLICATE"}: ${dup.id} | ${dup.fileName ?? dup.title} | ${dup.createdAt.toISOString()}`
      );
    }

    if (shouldArchive) {
      await prisma.knowledgeSource.updateMany({
        where: {
          id: {
            in: duplicates.map(
              (d) => d.id
            ),
          },
        },
        data: {
          status: "ARCHIVED",
        },
      });

      archivedCount +=
        duplicates.length;
    }
  }

  if (shouldArchive) {
    console.log(
      `\n[DEDUPE] Archived ${archivedCount} duplicate source(s).`
    );
  } else if (
    duplicateGroups.length > 0
  ) {
    console.log(
      "\n[DEDUPE] Dry run only — re-run with --archive to archive the duplicates listed above."
    );
  }
}

async function resetChecksums() {
  const result =
    await prisma.knowledgeSource.updateMany({
      where: {
        contentChecksum: {
          not: null,
        },
      },
      data: {
        contentChecksum: null,
      },
    });

  console.log(
    `[DEDUPE] Reset contentChecksum on ${result.count} source(s).`
  );
}

async function main() {
  const shouldArchive =
    process.argv.includes(
      "--archive"
    );

  const shouldReset =
    process.argv.includes(
      "--reset"
    );

  console.log(
    "========================================"
  );
  console.log(
    `[DEDUPE] Mode: ${shouldArchive ? "ARCHIVE" : "DRY RUN (pass --archive to actually archive)"}`
  );
  console.log(
    "========================================"
  );

  if (shouldReset) {
    await resetChecksums();
    console.log(
      "----------------------------------------"
    );
  }

  await backfillMissingChecksums();

  console.log(
    "----------------------------------------"
  );

  await findAndHandleDuplicates(
    shouldArchive
  );

  console.log(
    "========================================"
  );
}

main()
  .catch((error) => {
    console.error(
      "[DEDUPE] Fatal error:",
      error
    );
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });