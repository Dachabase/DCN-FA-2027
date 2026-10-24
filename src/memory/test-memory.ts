import "dotenv/config";

import { prisma } from "../database/prisma";
import { extractAndSaveMemories } from "./memory.extractor";

async function main() {
  console.log("Testing memory extraction...");
  console.log("--------------------------------");

  // Use an existing user from the database.
  const user = await prisma.user.findFirst({
    orderBy: {
      createdAt: "asc",
    },
  });

  if (!user) {
    throw new Error(
      "No user was found in the database. Start the Telegram bot and send /start first."
    );
  }

  console.log("Test user:");
  console.log({
    id: user.id,
    firstName: user.firstName,
<<<<<<< HEAD
    telegramId: user.telegramId.toString(),
=======
    telegramId: user.telegramId ? user.telegramId.toString() : "N/A",
>>>>>>> 6e2e38577695a97901aa20f7c0e064e5b40aafa2
  });

  console.log("--------------------------------");

  const testMessage =
    "I'm struggling with programming, especially JavaScript. I also prefer studying late at night because that's when I concentrate best. My goal is to become a very good software engineer.";

  console.log("Test message:");
  console.log(testMessage);

  console.log("--------------------------------");

  const memories = await extractAndSaveMemories(
    user.id,
    testMessage
  );

  console.log("--------------------------------");
  console.log("Extracted and saved memories:");
  console.log(memories);

  console.log("--------------------------------");

  const allMemories = await prisma.memory.findMany({
    where: {
      userId: user.id,
    },
    orderBy: {
      importance: "desc",
    },
  });

  console.log("All memories currently stored for this user:");
  console.log(allMemories);

  console.log("--------------------------------");
  console.log("Memory test completed successfully.");
}

main()
  .catch((error) => {
    console.error("Memory test failed:");
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });