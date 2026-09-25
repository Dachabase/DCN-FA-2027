import { prisma } from "../database/prisma";

// =========================================================
// TEST STUDENT CONFIGURATION
// =========================================================

const TEST_USER_ID =
  "cmsyifrvn0000q0wo90tbpqtz";

const COMPUTING_FACULTY_ID =
  "cmsygdk7n00001wwo1rdbjewx";

const SOFTWARE_ENGINEERING_DEPARTMENT_ID =
  "cmsygdl7f00041wwobc4vdrpy";

const TEST_LEVEL = 100;

// =========================================================
// MAIN
// =========================================================

async function main() {
  console.log("========================================");
  console.log("Assigning Test Student");
  console.log("========================================");

  // -------------------------------------------------------
  // VERIFY FACULTY
  // -------------------------------------------------------

  const faculty =
    await prisma.faculty.findUnique({
      where: {
        id: COMPUTING_FACULTY_ID,
      },
    });

  if (!faculty) {
    throw new Error(
      `Computing faculty not found: ${COMPUTING_FACULTY_ID}`
    );
  }

  console.log(
    `Faculty found: ${faculty.name}`
  );

  // -------------------------------------------------------
  // VERIFY DEPARTMENT
  // -------------------------------------------------------

  const department =
    await prisma.department.findUnique({
      where: {
        id: SOFTWARE_ENGINEERING_DEPARTMENT_ID,
      },

      include: {
        faculty: true,
      },
    });

  if (!department) {
    throw new Error(
      `Software Engineering department not found: ${SOFTWARE_ENGINEERING_DEPARTMENT_ID}`
    );
  }

  console.log(
    `Department found: ${department.name}`
  );

  if (
    department.facultyId !==
    COMPUTING_FACULTY_ID
  ) {
    throw new Error(
      "Software Engineering department does not belong to the Computing faculty."
    );
  }

  // -------------------------------------------------------
  // VERIFY USER
  // -------------------------------------------------------

  const user =
    await prisma.user.findUnique({
      where: {
        id: TEST_USER_ID,
      },
    });

  if (!user) {
    throw new Error(
      `Test user not found: ${TEST_USER_ID}`
    );
  }

  console.log(
    `User found: ${user.firstName}`
  );

  // -------------------------------------------------------
  // UPDATE USER
  // -------------------------------------------------------

  const updatedUser =
    await prisma.user.update({
      where: {
        id: TEST_USER_ID,
      },

      data: {
        facultyId:
          COMPUTING_FACULTY_ID,

        departmentId:
          SOFTWARE_ENGINEERING_DEPARTMENT_ID,

        level:
          TEST_LEVEL,
      },

      include: {
        faculty: true,
        department: true,
      },
    });

  // -------------------------------------------------------
  // DISPLAY RESULT
  // -------------------------------------------------------

  console.log("----------------------------------------");

  console.log(
    `User ID: ${updatedUser.id}`
  );

  console.log(
    `Name: ${updatedUser.firstName} ${updatedUser.lastName ?? ""}`.trim()
  );

  console.log(
    `Faculty: ${updatedUser.faculty?.name ?? "Not specified"}`
  );

  console.log(
    `Department: ${updatedUser.department?.name ?? "Not specified"}`
  );

  console.log(
    `Level: ${updatedUser.level ?? "Not specified"}`
  );

  console.log("----------------------------------------");

  console.log(
    "Test student updated successfully."
  );

  console.log("========================================");
}

// =========================================================
// EXECUTION
// =========================================================

main()
  .catch((error) => {
    console.error(
      "Failed to update test student:"
    );

    console.error(error);

    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });