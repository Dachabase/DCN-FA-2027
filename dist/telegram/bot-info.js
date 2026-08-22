"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const grammy_1 = require("grammy");
const token = process.env.TELEGRAM_COMPUTING_BOT_TOKEN;
if (!token) {
    throw new Error("TELEGRAM_COMPUTING_BOT_TOKEN is not defined");
}
const bot = new grammy_1.Bot(token);
async function main() {
    const me = await bot.api.getMe();
    console.log("🤖 Bot information:");
    console.log(`ID: ${me.id}`);
    console.log(`Username: @${me.username}`);
    console.log(`Name: ${me.first_name}`);
}
main()
    .catch((error) => {
    console.error("Failed to retrieve bot information:");
    console.error(error);
    process.exit(1);
});
