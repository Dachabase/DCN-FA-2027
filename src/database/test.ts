import { prisma } from "./prisma";

async function main() {
  try {
    await prisma.$connect();

    console.log("Successfully connected to PostgreSQL through Prisma");

    const faculties = await prisma.faculty.findMany();

    console.log(`Faculties found: ${faculties.length}`);
    console.log(faculties);
  } catch (error) {
    console.error("Database connection failed:");
    console.error(error);

    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

main();