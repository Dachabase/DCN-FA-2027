import "dotenv/config";

import {
  prisma,
} from "../database/prisma";

import {
  ingestDocument,
} from "./knowledge.ingest";

async function main() {
  console.log(
    "Starting knowledge ingestion test..."
  );

  // -------------------------------------------------------
  // FIND COMPUTING FACULTY
  // -------------------------------------------------------

  const faculty =
    await prisma.faculty.findUnique({
      where: {
        name: "Computing",
      },
    });

  if (!faculty) {
    throw new Error(
      "Computing faculty was not found."
    );
  }

  console.log(
    `Computing faculty found: ${faculty.id}`
  );

  // -------------------------------------------------------
  // INGEST TEST FILE
  // -------------------------------------------------------

  const result =
    await ingestDocument({
      filePath:
        "./knowledge-materials/test.txt",

      title:
        "Computing Faculty Test Material",

      description:
        "Initial test knowledge source for the Computing faculty.",

      facultyId:
        faculty.id,

      authority:
        "FACULTY",

      metadata: {
        session:
          "2026/2027",

        importedFor:
          "knowledge-system-testing",
      },
    });

  console.log(
    `Source ID: ${result.source.id}`
  );

  console.log(
    `Chunks created: ${result.chunks.length}`
  );

  for (
    const chunk of result.chunks
  ) {
    console.log(
      `\n--- Chunk ${chunk.chunkIndex} ---`
    );

    console.log(
      chunk.content
    );
  }
}

main()
  .catch(
    (error) => {
      console.error(
        "Knowledge ingestion test failed:",
        error
      );

      process.exit(1);
    }
  )
  .finally(
    async () => {
      await prisma.$disconnect();
    }
  );