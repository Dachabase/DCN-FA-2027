import { prisma } from "../database/prisma";
import { resolveDepartment } from "./department.resolver";

async function main() {
  const faculty = await prisma.faculty.findUnique({
    where: {
      name: "Computing",
    },
  });

  if (!faculty) {
    throw new Error("Computing faculty not found");
  }

  const tests = [
    "Software Engineering",
    "software engineering",
    "Cybersecurity",
    "Information Technology",
    "Computer Science and AI",
  ];

  for (const message of tests) {
    const department = await resolveDepartment(
      faculty.id,
      message
    );

    console.log(
      `"${message}" →`,
      department?.name ?? "NO MATCH"
    );
  }
}

main()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
  });