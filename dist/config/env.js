"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.env = void 0;
require("dotenv/config");
const zod_1 = require("zod");
const envSchema = zod_1.z.object({
    TELEGRAM_BOT_TOKEN: zod_1.z.string().min(1),
});
exports.env = envSchema.parse(process.env);
