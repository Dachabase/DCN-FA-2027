import { prisma } from "../database/prisma";

async function main() {
  const bot = await prisma.bot.findUnique({
    where: {
      telegramBotId: 8954703429n,
    },

    include: {
      faculty: true,
    },
  });

  if (!bot) {
    console.log("Computing bot was NOT found in the database.");
    return;
  }

  console.log("========================================");
  console.log("Computing Bot Database Record");
  console.log("========================================");

  console.log(`Bot ID: ${bot.id}`);
  console.log(`Telegram Bot ID: ${bot.telegramBotId}`);
  console.log(`Username: @${bot.username}`);
  console.log(`Name: ${bot.name}`);
  console.log(`Faculty ID: ${bot.facultyId ?? "Not assigned"}`);
  console.log(
    `Faculty: ${bot.faculty?.name ?? "Not assigned"}`
  );

  console.log("========================================");
}

main()
  .catch((error) => {
    console.error("Failed to retrieve bot:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });