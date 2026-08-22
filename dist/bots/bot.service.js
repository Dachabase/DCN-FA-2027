"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerBot = registerBot;
const prisma_1 = require("../database/prisma");
async function registerBot(params) {
    return prisma_1.prisma.bot.upsert({
        where: {
            telegramBotId: params.telegramBotId,
        },
        update: {
            username: params.username,
            name: params.name,
            facultyId: params.facultyId,
        },
        create: {
            telegramBotId: params.telegramBotId,
            username: params.username,
            name: params.name,
            facultyId: params.facultyId,
        },
        include: {
            faculty: true,
        },
    });
}
