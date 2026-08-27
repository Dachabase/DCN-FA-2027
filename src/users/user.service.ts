import { prisma } from "../database/prisma";

export interface TelegramUserData {
  telegramId: bigint;
  firstName?: string;
  lastName?: string;
  username?: string;
  facultyId?: string;
}

export async function findOrCreateUser(data: TelegramUserData) {
  return prisma.user.upsert({
    where: {
      telegramId: data.telegramId,
    },

    update: {
      firstName: data.firstName,
      lastName: data.lastName,
      username: data.username,
      ...(data.facultyId
        ? {
            facultyId: data.facultyId,
          }
        : {}),
    },

    create: {
      telegramId: data.telegramId,
      firstName: data.firstName,
      lastName: data.lastName,
      username: data.username,
      facultyId: data.facultyId,
    },
  });
}