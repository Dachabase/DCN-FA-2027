"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const prisma_1 = require("../database/prisma");
const department_resolver_1 = require("./department.resolver");
async function main() {
    const faculty = await prisma_1.prisma.faculty.findUnique({
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
        const department = await (0, department_resolver_1.resolveDepartment)(faculty.id, message);
        console.log(`"${message}" →`, department?.name ?? "NO MATCH");
    }
}
main()
    .catch(console.error)
    .finally(async () => {
    await prisma_1.prisma.$disconnect();
});
