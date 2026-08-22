"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const computing_bot_1 = require("./telegram/computing-bot");
async function main() {
    console.log("Starting UI Computing Freshers Bot...");
    await computing_bot_1.computingBot.start({
        onStart: (botInfo) => {
            console.log(`@${botInfo.username} is running`);
        },
    });
}
main().catch((error) => {
    console.error("Failed to start bot:");
    console.error(error);
    process.exit(1);
});
