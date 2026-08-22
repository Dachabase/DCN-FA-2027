"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const prisma_1 = require("../database/prisma");
const memory_extractor_1 = require("./memory.extractor");
async function main() {
    console.log("Testing memory extraction...");
    console.log("--------------------------------");
    // Use an existing user from the database.
    const user = await prisma_1.prisma.user.findFirst({
        orderBy: {
            createdAt: "asc",
        },
    });
    if (!user) {
        throw new Error("No user was found in the database. Start the Telegram bot and send /start first.");
    }
    console.log("Test user:");
    console.log({
        id: user.id,
        firstName: user.firstName,
        telegramId: user.telegramId.toString(),
    });
    console.log("--------------------------------");
    const testMessage = "I'm struggling with programming, especially JavaScript. I also prefer studying late at night because that's when I concentrate best. My goal is to become a very good software engineer.";
    console.log("Test message:");
    console.log(testMessage);
    console.log("--------------------------------");
    const memories = await (0, memory_extractor_1.extractAndSaveMemories)(user.id, testMessage);
    console.log("--------------------------------");
    console.log("Extracted and saved memories:");
    console.log(memories);
    console.log("--------------------------------");
    const allMemories = await prisma_1.prisma.memory.findMany({
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
    await prisma_1.prisma.$disconnect();
});
