import "dotenv/config";

import {
  extractDocument,
} from "./knowledge.extractor";

// =========================================================
// M1 VALIDATION SCRIPT
// =========================================================
//
// Standalone extraction check — does NOT write to the
// database. Confirms extractDocument() can handle the
// newly-added file types without throwing and without
// producing empty text.
//
// Edit the paths below to point at real sample files from
// your knowledge-materials folder, or pass paths as CLI
// arguments:
//
//   npx tsx src/knowledge/test-extraction-types.ts \
//     "./knowledge-materials/.../Week 5 Number Systems_...ppt" \
//     "./knowledge-materials/.../IMG_8088.jpg"
//

const defaultSamplePaths = [
  "./knowledge-materials/Faculty of computing/FIRST SEMESTER -20260822T104743Z-1-001/FIRST SEMESTER_/COS 101/Week 5 Number Systems_4fc9712ba285390b667273a8ae522a87.ppt",
  "./knowledge-materials/Faculty of computing/FIRST SEMESTER -20260822T104743Z-1-001/FIRST SEMESTER_/COS 101/Past Questions/2025 test_/IMG_8088.jpg",
];

async function main() {
  const paths =
    process.argv.length > 2
      ? process.argv.slice(2)
      : defaultSamplePaths;

  console.log(
    "========================================"
  );

  console.log(
    "[TEST] Extraction type-coverage check"
  );

  console.log(
    "========================================"
  );

  let failures = 0;

  for (
    const filePath of paths
  ) {
    console.log(
      `\n--- ${filePath} ---`
    );

    try {
      const started =
        Date.now();

      const result =
        await extractDocument(
          filePath
        );

      const elapsedMs =
        Date.now() - started;

      const text =
        result.text.trim();

      if (!text) {
        console.error(
          "FAIL — extraction succeeded but produced no text."
        );

        failures++;
        continue;
      }

      console.log(
        `OK — extracted ${text.length} characters in ${elapsedMs}ms.`
      );

      console.log(
        `Preview: ${text
          .slice(0, 300)
          .replace(/\s+/g, " ")}...`
      );
    } catch (extractionError) {
      console.error(
        "FAIL —",
        extractionError instanceof Error
          ? extractionError.message
          : extractionError
      );

      failures++;
    }
  }

  console.log(
    "\n========================================"
  );

  if (failures > 0) {
    console.error(
      `${failures} of ${paths.length} file(s) failed extraction.`
    );

    process.exit(1);
  }

  console.log(
    `All ${paths.length} file(s) extracted successfully.`
  );
}

main().catch(
  (error) => {
    console.error(
      "Test script crashed:",
      error
    );

    process.exit(1);
  }
);