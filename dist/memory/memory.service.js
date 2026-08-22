"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createMemory = createMemory;
exports.getUserMemories = getUserMemories;
exports.getUserMemoriesByType = getUserMemoriesByType;
exports.findMemory = findMemory;
exports.updateMemory = updateMemory;
exports.saveMemory = saveMemory;
exports.deleteMemory = deleteMemory;
exports.deleteAllUserMemories = deleteAllUserMemories;
exports.formatMemoriesForAI = formatMemoriesForAI;
const prisma_1 = require("../database/prisma");
// ---------------------------------------------------------
// CREATE MEMORY
// ---------------------------------------------------------
async function createMemory(input) {
    const importance = Math.max(1, Math.min(5, input.importance ?? 1));
    const confidence = Math.max(0, Math.min(1, input.confidence ?? 1));
    return prisma_1.prisma.memory.create({
        data: {
            userId: input.userId,
            type: input.type,
            content: input.content,
            importance,
            confidence,
        },
    });
}
// ---------------------------------------------------------
// GET USER MEMORIES
// ---------------------------------------------------------
async function getUserMemories(userId, limit = 10) {
    return prisma_1.prisma.memory.findMany({
        where: {
            userId,
        },
        orderBy: [
            {
                importance: "desc",
            },
            {
                updatedAt: "desc",
            },
        ],
        take: limit,
    });
}
// ---------------------------------------------------------
// GET MEMORIES BY TYPE
// ---------------------------------------------------------
async function getUserMemoriesByType(userId, type, limit = 10) {
    return prisma_1.prisma.memory.findMany({
        where: {
            userId,
            type,
        },
        orderBy: {
            updatedAt: "desc",
        },
        take: limit,
    });
}
// ---------------------------------------------------------
// FIND SIMILAR MEMORY
// ---------------------------------------------------------
async function findMemory(userId, type, content) {
    const memories = await prisma_1.prisma.memory.findMany({
        where: {
            userId,
            type,
        },
    });
    const normalizedContent = normalizeText(content);
    return (memories.find((memory) => normalizeText(memory.content) === normalizedContent) ?? null);
}
// ---------------------------------------------------------
// UPDATE MEMORY
// ---------------------------------------------------------
async function updateMemory(memoryId, input) {
    const data = {};
    if (input.content !== undefined) {
        data.content = input.content;
    }
    if (input.importance !== undefined) {
        data.importance = Math.max(1, Math.min(5, input.importance));
    }
    if (input.confidence !== undefined) {
        data.confidence = Math.max(0, Math.min(1, input.confidence));
    }
    return prisma_1.prisma.memory.update({
        where: {
            id: memoryId,
        },
        data,
    });
}
// ---------------------------------------------------------
// UPSERT MEMORY
// ---------------------------------------------------------
async function saveMemory(input) {
    const existingMemory = await findMemory(input.userId, input.type, input.content);
    if (existingMemory) {
        return updateMemory(existingMemory.id, {
            importance: input.importance ?? existingMemory.importance,
            confidence: input.confidence ?? existingMemory.confidence,
        });
    }
    return createMemory(input);
}
// ---------------------------------------------------------
// DELETE MEMORY
// ---------------------------------------------------------
async function deleteMemory(memoryId) {
    return prisma_1.prisma.memory.delete({
        where: {
            id: memoryId,
        },
    });
}
// ---------------------------------------------------------
// DELETE ALL USER MEMORIES
// ---------------------------------------------------------
async function deleteAllUserMemories(userId) {
    return prisma_1.prisma.memory.deleteMany({
        where: {
            userId,
        },
    });
}
// ---------------------------------------------------------
// FORMAT MEMORIES FOR AI
// ---------------------------------------------------------
function formatMemoriesForAI(memories) {
    if (memories.length === 0) {
        return "No stored memories yet.";
    }
    return memories
        .map((memory) => `- ${memory.type}: ${memory.content} ` +
        `(importance: ${memory.importance}/5, ` +
        `confidence: ${memory.confidence})`)
        .join("\n");
}
// ---------------------------------------------------------
// NORMALIZE TEXT
// ---------------------------------------------------------
function normalizeText(text) {
    return text
        .trim()
        .toLowerCase()
        .replace(/\s+/g, " ");
}
