import "dotenv/config";

import { PrismaPg } from "@prisma/adapter-pg";
<<<<<<< HEAD
import { PrismaClient } from "../src/generated/prisma/client";
=======
import { PrismaClient } from "../generated/prisma/client";
>>>>>>> 6e2e38577695a97901aa20f7c0e064e5b40aafa2
import { Bot } from "grammy";

const databaseUrl = process.env.DATABASE_URL;
const telegramToken = process.env.TELEGRAM_COMPUTING_BOT_TOKEN;

if (!databaseUrl) {
  throw new Error("DATABASE_URL is not defined");
}

if (!telegramToken) {
  throw new Error("TELEGRAM_COMPUTING_BOT_TOKEN is not defined");
}

const adapter = new PrismaPg({
  connectionString: databaseUrl,
});

const prisma = new PrismaClient({
  adapter,
});

const telegramBot = new Bot(telegramToken);

async function main() {
  console.log("Getting Telegram bot information...");

  const botInfo = await telegramBot.api.getMe();

  if (!botInfo.username) {
    throw new Error("Telegram bot does not have a username");
  }

  console.log(`@${botInfo.username}`);
  console.log(`Telegram ID: ${botInfo.id}`);

  console.log("Finding Computing faculty...");

  const computing = await prisma.faculty.findUnique({
    where: {
      name: "Computing",
    },
  });

  if (!computing) {
    throw new Error(
      "Computing faculty was not found. Run the database seed first."
    );
  }

  console.log(`Faculty: ${computing.name}`);

  const registeredBot = await prisma.bot.upsert({
    where: {
      telegramBotId: BigInt(botInfo.id),
    },
    update: {
      username: botInfo.username,
      name: botInfo.first_name,
      facultyId: computing.id,
    },
    create: {
      telegramBotId: BigInt(botInfo.id),
      username: botInfo.username,
      name: botInfo.first_name,
      facultyId: computing.id,
    },
    include: {
      faculty: true,
    },
  });

  console.log("");
  console.log("Bot registered successfully!");
  console.log("");
  console.log(`Bot: @${registeredBot.username}`);
  console.log(`Telegram ID: ${registeredBot.telegramBotId}`);
  console.log(`Faculty: ${registeredBot.faculty?.name}`);
}

main()
  .catch((error) => {
    console.error("Registration failed:");
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });