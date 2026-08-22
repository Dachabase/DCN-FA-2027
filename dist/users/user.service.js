"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.findOrCreateUser = findOrCreateUser;
const prisma_1 = require("../database/prisma");
async function findOrCreateUser(data) {
    return prisma_1.prisma.user.upsert({
        where: {
            telegramId: data.telegramId,
        },
        update: {
            firstName: data.firstName,
            lastName: data.lastName,
            username: data.username,
            ...(data.facultyId
                ? {
                    facultyId: data.facultyId,
                }
                : {}),
        },
        create: {
            telegramId: data.telegramId,
            firstName: data.firstName,
            lastName: data.lastName,
            username: data.username,
            facultyId: data.facultyId,
        },
    });
}
