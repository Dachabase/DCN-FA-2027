import { prisma } from "../database/prisma";

export async function getOrCreateConversation(
  userId: string
) {
  const existingConversation =
    await prisma.conversation.findFirst({
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

  return prisma.conversation.create({
    data: {
      userId,
    },
  });
}