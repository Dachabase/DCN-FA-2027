"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getOrCreateConversation = getOrCreateConversation;
const prisma_1 = require("../database/prisma");
async function getOrCreateConversation(userId) {
    const existingConversation = await prisma_1.prisma.conversation.findFirst({
        where: {
            userId,
        },
        orderBy: {
            updatedAt: "desc",
        },
    });
    if (existingConversation) {
        return existingConversation;
    }
    return prisma_1.prisma.conversation.create({
        data: {
            userId,
        },
    });
}
