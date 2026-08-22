"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildAIContext = buildAIContext;
const prisma_1 = require("../database/prisma");
const message_service_1 = require("../conversations/message.service");
async function buildAIContext(userId, conversationId) {
    const user = await prisma_1.prisma.user.findUnique({
        where: {
            id: userId,
        },
        include: {
            faculty: true,
            department: true,
            memories: {
                orderBy: {
                    importance: "desc",
                },
                take: 20,
            },
        },
    });
    if (!user) {
        throw new Error(`User ${userId} not found`);
    }
    const messages = await (0, message_service_1.getRecentMessages)(conversationId, 20);
    return {
        user: {
            firstName: user.firstName,
            lastName: user.lastName,
            username: user.username,
            faculty: user.faculty?.name ?? null,
            department: user.department?.name ?? null,
            level: user.level,
        },
        memories: user.memories.map((memory) => ({
            type: memory.type,
            content: memory.content,
            importance: memory.importance,
            confidence: memory.confidence,
        })),
        messages: messages.map((message) => ({
            role: message.role === "USER"
                ? "user"
                : "assistant",
            content: message.content,
        })),
    };
}
