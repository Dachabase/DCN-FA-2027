import "dotenv/config";

import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";

import {
  prisma,
} from "../database/prisma";

import {
  ingestDocument,
  DuplicateContentError,
} from "./knowledge.ingest";

import {
  findKnowledgeSourceByChecksum,
} from "./knowledge.service";

import type {
  KnowledgeAuthority,
} from "../generated/prisma/client";

// =========================================================
// M2 — BATCH INGESTION
// =========================================================
//
// Recursively walks the Faculty of Computing knowledge
// materials tree and ingests every supported file, inferring
// courseCode / semester / material category from the folder
// structure instead of requiring each file to be listed by
// hand.
//
// USAGE
//
//   npx tsx src/knowledge/ingest-all.ts [options]
//
// OPTIONS
//
//   --dry-run        Walk and classify every file, print what
//                     WOULD happen, but do not touch the
//                     database or run extraction. Use this
//                     first to sanity-check folder parsing.
//
//   --course "COS 101"
//                     Only process files whose inferred course
//                     code matches (case-insensitive, partial
//                     match). Useful for testing on a small
//                     slice before running the full corpus.
//
//   --limit N         Stop after N supported files have been
//                     processed (counts skipped/failed too).
//                     Useful for a quick smoke test.
//
// EXAMPLES
//
//   npx tsx src/knowledge/ingest-all.ts --dry-run
//   npx tsx src/knowledge/ingest-all.ts --course "COS 101" --limit 5
//   npx tsx src/knowledge/ingest-all.ts
//   npx tsx src/knowledge/ingest-all.ts --faculty "Arts" --folder "Faculty of arts" --level 100
//

const DEFAULT_FACULTY_NAME =
  "Computing";

const DEFAULT_FOLDER_NAME =
  "Faculty of computing";

const DEFAULT_LEVEL = 100;

// Set inside main() once CLI args are parsed — classifyPath()
// and walkFiles() read this via closure, so it must be
// assigned before either is called.
let ROOT_DIR: string;

const SUPPORTED_EXTENSIONS =
  new Set([
    ".pdf",
    ".docx",
    ".doc",
    ".pptx",
    ".ppt",
    ".jpg",
    ".jpeg",
    ".png",
    ".txt",
    ".md",
  ]);

// =========================================================
// CLI OPTIONS
// =========================================================

function parseArgs() {
  const args = process.argv.slice(2);

  const dryRun =
    args.includes("--dry-run");

  const courseIndex =
    args.indexOf("--course");

  const courseFilter =
    courseIndex !== -1
      ? args[courseIndex + 1]?.toLowerCase()
      : undefined;

  const limitIndex =
    args.indexOf("--limit");

  const limit =
    limitIndex !== -1
      ? Number(args[limitIndex + 1])
      : undefined;

  const facultyIndex =
    args.indexOf("--faculty");

  const facultyName =
    facultyIndex !== -1
      ? args[facultyIndex + 1]
      : DEFAULT_FACULTY_NAME;

  const folderIndex =
    args.indexOf("--folder");

  const folderName =
    folderIndex !== -1
      ? args[folderIndex + 1]
      : DEFAULT_FOLDER_NAME;

  const levelIndex =
    args.indexOf("--level");

  const level =
    levelIndex !== -1
      ? Number(args[levelIndex + 1])
      : DEFAULT_LEVEL;

  return {
    dryRun,
    courseFilter,
    limit,
    facultyName,
    folderName,
    level,
  };
}

// =========================================================
// RECURSIVE FILE WALKER
// =========================================================

async function walkFiles(
  dir: string
): Promise<string[]> {
  const entries =
    await fs.readdir(dir, {
      withFileTypes: true,
    });

  const files: string[] = [];

  for (const entry of entries) {
    const fullPath =
      path.join(dir, entry.name);

    if (entry.isDirectory()) {
      files.push(
        ...(await walkFiles(fullPath))
      );
    } else if (entry.isFile()) {
      files.push(fullPath);
    }
  }

  return files;
}

// =========================================================
// PATH CLASSIFICATION
// =========================================================
//
// Turns a file's location inside the corpus into metadata,
// based on the observed folder convention:
//
// Faculty of computing/
//   <file directly here>                     -> faculty-wide
//   FIRST SEMESTER -.../FIRST SEMESTER_/
//     COS 101/
//       Materials/...
//       Past Questions/...
//   SECOND SEMESTER -.../SECOND SEMESTER_/
//     PHY103(BMAS)/
//       ...
//
// The "-20260822T...-1-001" and trailing "_" wrapper folders
// are Google Drive export artifacts, not meaningful metadata,
// so they are detected and skipped rather than hardcoding an
// exact folder depth (which would break if the export
// structure changes slightly).
//

interface Classification {
  facultyWide: boolean;
  semester?: "First" | "Second";
  courseCode?: string;
  courseTag?: string;
  materialCategory?: string;
  subPath?: string;
  authority: KnowledgeAuthority;
}

function isSemesterWrapper(
  segment: string
): boolean {
  return /semester/i.test(segment);
}

function normalizeCourseCode(
  rawFolderName: string
): {
  code: string;
  tag?: string;
} {
  const tagMatch =
    rawFolderName.match(
      /\(([^)]+)\)/
    );

  const tag =
    tagMatch?.[1];

  const withoutTag =
    rawFolderName
      .replace(/\([^)]*\)/g, "")
      .trim();

  const codeMatch =
    withoutTag.match(
      /^([A-Za-z]+)\s*(\d+.*)$/
    );

  const code =
    codeMatch
      ? `${codeMatch[1].toUpperCase()} ${codeMatch[2].trim()}`
      : withoutTag;

  return { code, tag };
}

function classifyPath(
  filePath: string
): Classification {
  const relative =
    path.relative(
      ROOT_DIR,
      filePath
    );

  const segments =
    relative
      .split(path.sep)
      .slice(0, -1); // drop the filename itself

  if (segments.length === 0) {
    // File sits directly under "Faculty of computing"
    const fileName =
      path.basename(filePath);

    return {
      facultyWide: true,
      authority:
        /list of courses/i.test(
          fileName
        )
          ? "FACULTY"
          : "GENERAL",
    };
  }

  const semester: "First" | "Second" | undefined =
    /first semester/i.test(segments[0])
      ? "First"
      : /second semester/i.test(segments[0])
      ? "Second"
      : undefined;

  // Skip the Google-Drive wrapper folder(s) that just repeat
  // "...SEMESTER_" without introducing a real course folder.
  let cursor = 1;

  while (
    cursor < segments.length &&
    isSemesterWrapper(segments[cursor])
  ) {
    cursor++;
  }

  const courseFolder =
    segments[cursor];

  const { code, tag } =
    courseFolder
      ? normalizeCourseCode(courseFolder)
      : { code: undefined, tag: undefined };

  const materialCategory =
    segments[cursor + 1];

  const subPath =
    segments
      .slice(cursor + 2)
      .join("/") || undefined;

  const authority: KnowledgeAuthority =
    /reference|textbook/i.test(relative)
      ? "GENERAL"
      : "COURSE";

  return {
    facultyWide: false,
    semester,
    courseCode: code,
    courseTag: tag,
    materialCategory,
    subPath,
    authority,
  };
}

// =========================================================
// CHECKSUM
// =========================================================

async function computeChecksum(
  filePath: string
): Promise<string> {
  const buffer =
    await fs.readFile(filePath);

  return crypto
    .createHash("sha256")
    .update(buffer)
    .digest("hex");
}

// =========================================================
// MAIN
// =========================================================

async function main() {
  const {
    dryRun,
    courseFilter,
    limit,
    facultyName,
    folderName,
    level,
  } = parseArgs();

  ROOT_DIR = path.resolve(
    process.cwd(),
    "knowledge-materials",
    folderName
  );

  console.log(
    "========================================"
  );
  console.log(
    `[BATCH] Faculty: ${facultyName}`
  );
  console.log(
    `[BATCH] Root: ${ROOT_DIR}`
  );
  console.log(
    `[BATCH] Level tag: ${level}`
  );
  console.log(
    `[BATCH] Dry run: ${dryRun}`
  );
  if (courseFilter) {
    console.log(
      `[BATCH] Course filter: ${courseFilter}`
    );
  }
  if (limit) {
    console.log(
      `[BATCH] Limit: ${limit}`
    );
  }
  console.log(
    "========================================"
  );

  const faculty =
    await prisma.faculty.findUnique({
      where: {
        name: facultyName,
      },
    });

  if (!faculty) {
    throw new Error(
      `Faculty "${facultyName}" was not found. Seed it first (via Prisma Studio or a register-*-bot.ts script) before running batch ingestion. Pass --faculty "<exact name>" to target a different faculty.`
    );
  }

  console.log(
    `[BATCH] Faculty ID: ${faculty.id}`
  );

  const allFiles =
    await walkFiles(ROOT_DIR);

  console.log(
    `[BATCH] Found ${allFiles.length} total files under root.`
  );

  const summary = {
    scanned: 0,
    ingested: 0,
    skippedUnsupported: 0,
    skippedDuplicate: 0,
    skippedContentDuplicate: 0,
    skippedFilteredOut: 0,
    failed: 0,
    totalChunks: 0,
  };

  const failures: Array<{
    filePath: string;
    reason: string;
  }> = [];

  const skippedExtensionCounts =
    new Map<string, number>();

  for (const filePath of allFiles) {
    if (
      limit &&
      summary.scanned >= limit
    ) {
      console.log(
        `[BATCH] Limit of ${limit} reached, stopping.`
      );
      break;
    }

    summary.scanned++;

    const extension =
      path
        .extname(filePath)
        .toLowerCase();

    if (
      !SUPPORTED_EXTENSIONS.has(
        extension
      )
    ) {
      summary.skippedUnsupported++;

      skippedExtensionCounts.set(
        extension,
        (skippedExtensionCounts.get(
          extension
        ) ?? 0) + 1
      );

      continue;
    }

    const classification =
      classifyPath(filePath);

    if (
      courseFilter &&
      !classification.courseCode
        ?.toLowerCase()
        .includes(courseFilter)
    ) {
      summary.skippedFilteredOut++;
      continue;
    }

    const relativePath =
      path.relative(
        ROOT_DIR,
        filePath
      );

    const fileName =
      path.basename(filePath);

    const titleParts = [
      classification.courseCode ??
        "Faculty of Computing",
      classification.materialCategory,
      path.basename(
        fileName,
        extension
      ),
    ].filter(Boolean);

    const title =
      titleParts.join(" — ");

    if (dryRun) {
      console.log(
        `[DRY RUN] ${relativePath}`
      );
      console.log(
        `          -> course=${classification.courseCode ?? "-"} tag=${classification.courseTag ?? "-"} ` +
          `semester=${classification.semester ?? "-"} category=${classification.materialCategory ?? "-"} ` +
          `authority=${classification.authority}`
      );
      summary.ingested++; // counted as "would ingest" in dry-run mode
      continue;
    }

    try {
      const checksum =
        await computeChecksum(
          filePath
        );

      const existing =
        await findKnowledgeSourceByChecksum(
          faculty.id,
          checksum
        );

      if (existing) {
        console.log(
          `[SKIP] Already ingested (checksum match): ${relativePath}`
        );
        summary.skippedDuplicate++;
        continue;
      }

      console.log(
        `[INGEST] ${relativePath}`
      );

      const started = Date.now();

      const result =
        await ingestDocument({
          filePath,
          title,

          description: `Ingested from ${relativePath}`,

          facultyId: faculty.id,

          courseCode:
            classification.courseCode,

          level: level,

          authority:
            classification.authority,

          checksum,

          metadata: {
            semester:
              classification.semester,
            courseTag:
              classification.courseTag,
            materialCategory:
              classification.materialCategory,
            subPath:
              classification.subPath,
            relativePath,
          },
        });

      const elapsedMs =
        Date.now() - started;

      console.log(
        `[OK] ${result.chunks.length} chunks in ${elapsedMs}ms`
      );

      summary.ingested++;
      summary.totalChunks +=
        result.chunks.length;
    } catch (ingestError) {
      if (
        ingestError instanceof
        DuplicateContentError
      ) {
        console.log(
          `[SKIP] Content duplicate of ${ingestError.existingSourceId}: ${relativePath}`
        );
        summary.skippedContentDuplicate++;
        continue;
      }

      const reason =
        ingestError instanceof Error
          ? ingestError.message
          : String(ingestError);

      console.error(
        `[FAIL] ${relativePath} — ${reason}`
      );

      summary.failed++;

      failures.push({
        filePath: relativePath,
        reason,
      });
    }
  }

  console.log(
    "\n========================================"
  );
  console.log(
    "[BATCH] RUN SUMMARY"
  );
  console.log(
    "========================================"
  );
  console.log(
    `Scanned:              ${summary.scanned}`
  );
  console.log(
    `Ingested:              ${summary.ingested}`
  );
  console.log(
    `Skipped (duplicate):   ${summary.skippedDuplicate}`
  );
  console.log(
    `Skipped (content dup): ${summary.skippedContentDuplicate}`
  );
  console.log(
    `Skipped (unsupported): ${summary.skippedUnsupported}`
  );
  console.log(
    `Skipped (filtered):    ${summary.skippedFilteredOut}`
  );
  console.log(
    `Failed:                ${summary.failed}`
  );
  console.log(
    `Total chunks created:  ${summary.totalChunks}`
  );

  if (skippedExtensionCounts.size > 0) {
    console.log(
      "\nUnsupported extensions encountered:"
    );

    for (const [
      ext,
      count,
    ] of skippedExtensionCounts) {
      console.log(
        `  ${ext || "(no extension)"}: ${count}`
      );
    }
  }

  if (failures.length > 0) {
    console.log(
      "\nFailures:"
    );

    for (const failure of failures) {
      console.log(
        `  ${failure.filePath}\n    -> ${failure.reason}`
      );
    }
  }

  console.log(
    "========================================"
  );
}

main()
  .catch((error) => {
    console.error(
      "[BATCH] Fatal error:",
      error
    );
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });