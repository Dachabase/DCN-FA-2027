import { prisma } from "../database/prisma";

async function main() {
  console.log("========================================");
  console.log("Computing Faculty Departments");
  console.log("========================================");

  const departments =
    await prisma.department.findMany({
      where: {
        faculty: {
          name: "Computing",
        },
      },

      include: {
        faculty: true,
      },

      orderBy: {
        name: "asc",
      },
    });

  if (departments.length === 0) {
    console.log(
      "No departments found for Computing."
    );

    return;
  }

  for (
    const department of departments
  ) {
    console.log("----------------------------------------");

    console.log(
      `Name: ${department.name}`
    );

    console.log(
      `ID: ${department.id}`
    );

    console.log(
      `Faculty: ${department.faculty.name}`
    );
  }

  console.log("----------------------------------------");
  console.log(
    `Total departments: ${departments.length}`
  );

  console.log("========================================");
}

main()
  .catch((error) => {
    console.error(
      "Failed to retrieve departments:"
    );

    console.error(error);

    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });