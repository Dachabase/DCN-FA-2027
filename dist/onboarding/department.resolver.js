"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolveDepartment = resolveDepartment;
const prisma_1 = require("../database/prisma");
function normalizeText(text) {
    return text
        .toLowerCase()
        .trim()
        .replace(/\s+/g, " ");
}
async function resolveDepartment(facultyId, userMessage) {
    const departments = await prisma_1.prisma.department.findMany({
        where: {
            facultyId,
        },
    });
    const normalizedMessage = normalizeText(userMessage);
    // =======================================================
    // Exact match
    // =======================================================
    const exactMatch = departments.find((department) => normalizeText(department.name) === normalizedMessage);
    if (exactMatch) {
        return exactMatch;
    }
    // =======================================================
    // Message contains department name
    // =======================================================
    const partialMatches = departments.filter((department) => {
        const departmentName = normalizeText(department.name);
        return (normalizedMessage.includes(departmentName) ||
            departmentName.includes(normalizedMessage));
    });
    if (partialMatches.length === 1) {
        return partialMatches[0];
    }
    // =======================================================
    // Common abbreviations
    // =======================================================
    const aliases = {
        cs: "Computer Science and AI",
        csa: "Computer Science and AI",
        "computer science": "Computer Science and AI",
        "computer science and ai": "Computer Science and AI",
        cyber: "Cybersecurity",
        "cyber security": "Cybersecurity",
        cybersecurity: "Cybersecurity",
        it: "Information Technology",
        "information technology": "Information Technology",
        se: "Software Engineering",
        "software eng": "Software Engineering",
        "software engineering": "Software Engineering",
    };
    const aliasedDepartmentName = aliases[normalizedMessage];
    if (aliasedDepartmentName) {
        const aliasMatch = departments.find((department) => department.name === aliasedDepartmentName);
        if (aliasMatch) {
            return aliasMatch;
        }
    }
    return null;
}
