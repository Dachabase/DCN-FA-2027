import { prisma } from "../database/prisma";

import {
  getRecentMessages,
} from "../conversations/message.service";

import type {
  AIContext,
} from "./ai.provider";

export async function buildAIContext(
  userId: string,
  conversationId: string
): Promise<AIContext> {
  const user =
    await prisma.user.findUnique({
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
    throw new Error(
      `User ${userId} not found`
    );
  }

  const messages =
    await getRecentMessages(
      conversationId,
      20
    );

  return {
    user: {
      firstName: user.firstName,
      lastName: user.lastName,
      username: user.username,

      faculty:
        user.faculty?.name ?? null,

      department:
        user.department?.name ?? null,

      level: user.level,
    },

    memories: user.memories.map(
      (memory) => ({
        type: memory.type,
        content: memory.content,
        importance:
          memory.importance,
        confidence:
          memory.confidence,
      })
    ),

    messages: messages.map(
      (message) => ({
        role:
          message.role === "USER"
            ? "user"
            : "assistant",

        content: message.content,
      })
    ),
  };
}