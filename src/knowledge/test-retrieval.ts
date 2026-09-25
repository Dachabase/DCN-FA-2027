import "dotenv/config";

import {
  prisma,
} from "../database/prisma";

import {
  retrieveKnowledge,
} from "./knowledge.retrieval";

// =========================================================
// TEST
// =========================================================

async function main() {
  console.log(
    "========================================"
  );

  console.log(
    "Starting knowledge retrieval test..."
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
      "Computing faculty not found."
    );
  }

  console.log(
    `Computing faculty found: ${faculty.id}`
  );

  // -------------------------------------------------------
  // TEST QUERY
  // -------------------------------------------------------

  const query =
    "What do Software Engineering students study?";

  console.log(
    `Query: ${query}`
  );

  // -------------------------------------------------------
  // RETRIEVE
  // -------------------------------------------------------

  const results =
    await retrieveKnowledge({
      facultyId:
        faculty.id,

      query,

      limit: 6,
    });

  // -------------------------------------------------------
  // DISPLAY
  // -------------------------------------------------------

  console.log(
    `Retrieved ${results.length} knowledge chunk(s).`
  );

  console.log(
    "========================================"
  );

  results.forEach(
    (result, index) => {
      console.log(
        `\n--- Result ${index + 1} ---`
      );

      console.log(
        `Score: ${result.score}`
      );

      console.log(
        `Source: ${result.source.title}`
      );

      console.log(
        `Authority: ${result.source.authority}`
      );

      console.log(
        `Type: ${result.source.type}`
      );

      console.log(
        `Department ID: ${result.source.departmentId ?? "Faculty-wide"}`
      );

      console.log(
        `Course: ${
          result.source.courseCode ??
          "Not specified"
        } ${
          result.source.courseName ??
          ""
        }`.trim()
      );

      console.log(
        `Level: ${
          result.source.level ??
          "All levels"
        }`
      );

      if (
        result.heading
      ) {
        console.log(
          `Heading: ${result.heading}`
        );
      }

      if (
        result.pageNumber
      ) {
        console.log(
          `Page: ${result.pageNumber}`
        );
      }

      if (
        result.slideNumber
      ) {
        console.log(
          `Slide: ${result.slideNumber}`
        );
      }

      console.log(
        "Content:"
      );

      console.log(
        result.content
      );
    }
  );

  console.log(
    "\n========================================"
  );

  console.log(
    "Knowledge retrieval test completed."
  );

  console.log(
    "========================================"
  );
}

// =========================================================
// RUN
// =========================================================

main()
  .catch(
    (error) => {
      console.error(
        "Knowledge retrieval test failed:"
      );

      console.error(
        error
      );

      process.exit(
        1
      );
    }
  )
  .finally(
    async () => {
      await prisma.$disconnect();
    }
  );