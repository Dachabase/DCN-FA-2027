"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const prisma_1 = require("./prisma");
async function main() {
    try {
        await prisma_1.prisma.$connect();
        console.log("Successfully connected to PostgreSQL through Prisma");
        const faculties = await prisma_1.prisma.faculty.findMany();
        console.log(`Faculties found: ${faculties.length}`);
        console.log(faculties);
    }
    catch (error) {
        console.error("Database connection failed:");
        console.error(error);
        process.exitCode = 1;
    }
    finally {
        await prisma_1.prisma.$disconnect();
    }
}
main();
