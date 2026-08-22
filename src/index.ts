import { computingBot } from "./telegram/computing-bot";

async function main() {
  console.log("Starting UI Computing Freshers Bot...");

  await computingBot.start({
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