import { prisma } from "../database/prisma";

export async function saveUserMessage(
  conversationId: string,
  content: string
) {
  return prisma.message.create({
    data: {
      conversationId,
      role: "USER",
      content,
    },
  });
}

export async function saveAssistantMessage(
  conversationId: string,
  content: string
) {
  return prisma.message.create({
    data: {
      conversationId,
      role: "ASSISTANT",
      content,
    },
  });
}

export async function getRecentMessages(
  conversationId: string,
  limit = 20
) {
  const messages =
    await prisma.message.findMany({
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