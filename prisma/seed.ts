import "dotenv/config";

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL is not defined");
}

const adapter = new PrismaPg({
  connectionString,
});

const prisma = new PrismaClient({
  adapter,
});

async function main() {
  console.log("Starting database seed...");

  const computing = await prisma.faculty.upsert({
    where: {
      name: "Computing",
    },
    update: {},
    create: {
      name: "Computing",
    },
  });

  const departments = [
    "Computer Science and AI",
    "Cybersecurity",
    "Information Technology",
    "Software Engineering",
  ];

  for (const name of departments) {
    await prisma.department.upsert({
      where: {
        facultyId_name: {
          facultyId: computing.id,
          name,
        },
      },
      update: {},
      create: {
        name,
        facultyId: computing.id,
      },
    });
  }

  console.log("Computing faculty seeded successfully.");
  console.log(`Departments: ${departments.length}`);
}

main()
  .catch((error) => {
    console.error("❌ Seed failed:");
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });