import { prisma } from "../database/prisma";

// ---------------------------------------------------------
// TYPES
// ---------------------------------------------------------

export interface CreateMemoryInput {
  userId: string;
  type: string;
  content: string;
  importance?: number;
  confidence?: number;
}

export interface UpdateMemoryInput {
  content?: string;
  importance?: number;
  confidence?: number;
}

// ---------------------------------------------------------
// CREATE MEMORY
// ---------------------------------------------------------

export async function createMemory(
  input: CreateMemoryInput
) {
  const importance = Math.max(
    1,
    Math.min(5, input.importance ?? 1)
  );

  const confidence = Math.max(
    0,
    Math.min(1, input.confidence ?? 1)
  );

  return prisma.memory.create({
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

export async function getUserMemories(
  userId: string,
  limit = 10
) {
  return prisma.memory.findMany({
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

export async function getUserMemoriesByType(
  userId: string,
  type: string,
  limit = 10
) {
  return prisma.memory.findMany({
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

export async function findMemory(
  userId: string,
  type: string,
  content: string
) {
  const memories = await prisma.memory.findMany({
    where: {
      userId,
      type,
    },
  });

  const normalizedContent = normalizeText(content);

  return (
    memories.find(
      (memory) =>
        normalizeText(memory.content) === normalizedContent
    ) ?? null
  );
}

// ---------------------------------------------------------
// UPDATE MEMORY
// ---------------------------------------------------------

export async function updateMemory(
  memoryId: string,
  input: UpdateMemoryInput
) {
  const data: {
    content?: string;
    importance?: number;
    confidence?: number;
  } = {};

  if (input.content !== undefined) {
    data.content = input.content;
  }

  if (input.importance !== undefined) {
    data.importance = Math.max(
      1,
      Math.min(5, input.importance)
    );
  }

  if (input.confidence !== undefined) {
    data.confidence = Math.max(
      0,
      Math.min(1, input.confidence)
    );
  }

  return prisma.memory.update({
    where: {
      id: memoryId,
    },
    data,
  });
}

// ---------------------------------------------------------
// UPSERT MEMORY
// ---------------------------------------------------------

export async function saveMemory(
  input: CreateMemoryInput
) {
  const existingMemory = await findMemory(
    input.userId,
    input.type,
    input.content
  );

  if (existingMemory) {
    return updateMemory(existingMemory.id, {
      importance:
        input.importance ?? existingMemory.importance,
      confidence:
        input.confidence ?? existingMemory.confidence,
    });
  }

  return createMemory(input);
}

// ---------------------------------------------------------
// DELETE MEMORY
// ---------------------------------------------------------

export async function deleteMemory(
  memoryId: string
) {
  return prisma.memory.delete({
    where: {
      id: memoryId,
    },
  });
}

// ---------------------------------------------------------
// DELETE ALL USER MEMORIES
// ---------------------------------------------------------

export async function deleteAllUserMemories(
  userId: string
) {
  return prisma.memory.deleteMany({
    where: {
      userId,
    },
  });
}

// ---------------------------------------------------------
// FORMAT MEMORIES FOR AI
// ---------------------------------------------------------

export function formatMemoriesForAI(
  memories: Array<{
    type: string;
    content: string;
    importance: number;
    confidence: number;
  }>
): string {
  if (memories.length === 0) {
    return "No stored memories yet.";
  }

  return memories
    .map(
      (memory) =>
        `- ${memory.type}: ${memory.content} ` +
        `(importance: ${memory.importance}/5, ` +
        `confidence: ${memory.confidence})`
    )
    .join("\n");
}

// ---------------------------------------------------------
// NORMALIZE TEXT
// ---------------------------------------------------------

function normalizeText(text: string): string {
  return text
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}