"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.bot = void 0;
const grammy_1 = require("grammy");
const env_js_1 = require("../config/env.js");
exports.bot = new grammy_1.Bot(env_js_1.env.TELEGRAM_BOT_TOKEN);
