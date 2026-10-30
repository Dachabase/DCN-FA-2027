import { prisma } from "../database/prisma";

export async function registerBot(params: {
  telegramBotId: bigint;
  username: string;
  name: string;
  facultyId?: string;
}) {
  return prisma.bot.upsert({
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