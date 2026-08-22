"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.saveUserMessage = saveUserMessage;
exports.saveAssistantMessage = saveAssistantMessage;
exports.getRecentMessages = getRecentMessages;
const prisma_1 = require("../database/prisma");
async function saveUserMessage(conversationId, content) {
    return prisma_1.prisma.message.create({
        data: {
            conversationId,
            role: "USER",
            content,
        },
    });
}
async function saveAssistantMessage(conversationId, content) {
    return prisma_1.prisma.message.create({
        data: {
            conversationId,
            role: "ASSISTANT",
            content,
        },
    });
}
async function getRecentMessages(conversationId, limit = 20) {
    const messages = await prisma_1.prisma.message.findMany({
        where: {
            conversationId,
        },
        orderBy: {
            createdAt: "desc",
        },
        take: limit,
    });
    return messages.reverse();
}
