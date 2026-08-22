import "dotenv/config";

import { Bot } from "grammy";

import { prisma } from "../database/prisma";

import { findOrCreateUser } from "../users/user.service";

import { setOnboardingStep } from "../onboarding/onboarding.service";

import { handleOnboardingMessage } from "../onboarding/onboarding.handler";

import {
  getOrCreateConversation,
} from "../conversations/conversation.service";

import {
  aiService,
} from "../ai/ai.service";

const token =
  process.env.TELEGRAM_COMPUTING_BOT_TOKEN;

if (!token) {
  throw new Error(
    "TELEGRAM_COMPUTING_BOT_TOKEN is not defined"
  );
}

export const computingBot =
  new Bot(token);

// =========================================================
// START
// =========================================================

computingBot.command(
  "start",
  async (ctx) => {
    if (!ctx.from) {
      return;
    }

    try {
      const botInfo =
        await computingBot.api.getMe();

      const botRecord =
        await prisma.bot.findUnique({
          where: {
            telegramBotId:
              BigInt(botInfo.id),
          },

          include: {
            faculty: true,
          },
        });

      if (!botRecord) {
        console.error(
          `Bot ${botInfo.id} (@${botInfo.username}) is not registered in the database.`
        );

        await ctx.reply(
          "Sorry, something went wrong while setting up your account."
        );

        return;
      }

      if (!botRecord.faculty) {
        console.error(
          `Bot ${botRecord.username} has no faculty assigned.`
        );

        await ctx.reply(
          "Sorry, this bot has not been properly configured yet."
        );

        return;
      }

      const user =
        await findOrCreateUser({
          telegramId:
            BigInt(ctx.from.id),

          firstName:
            ctx.from.first_name,

          lastName:
            ctx.from.last_name,

          username:
            ctx.from.username,

          facultyId:
            botRecord.faculty.id,
        });

      const displayName =
        user.firstName ??
        ctx.from.first_name ??
        "there";

      const facultyName =
        botRecord.faculty.name;

      // ---------------------------------------------------
      // Department onboarding
      // ---------------------------------------------------

      if (!user.departmentId) {
        await setOnboardingStep(
          user.id,
          "DEPARTMENT"
        );

        await ctx.reply(
          `👋 Hey ${displayName}!\n\n` +
            `Welcome to the University of Ibadan ${facultyName} Freshers Companion. 🎓\n\n` +
            `I'm going to get to know you a little so I can personalize your experience.\n\n` +
            `Which department are you joining?`
        );

        return;
      }

      // ---------------------------------------------------
      // Existing user
      // ---------------------------------------------------

      await ctx.reply(
        `👋 Welcome back, ${displayName}!\n\n` +
          `You're already registered as a ${facultyName} student. 🎓\n\n` +
          `How can I help you today?`
      );
    } catch (error) {
      console.error(
        "Error processing /start:"
      );

      console.error(error);

      await ctx.reply(
        "Sorry, something went wrong. Please try again."
      );
    }
  }
);

// =========================================================
// TEXT MESSAGES
// =========================================================

computingBot.on(
  "message:text",
  async (ctx) => {
    try {
      // ---------------------------------------------------
      // Onboarding gets first priority
      // ---------------------------------------------------

      const handled =
        await handleOnboardingMessage(ctx);

      if (handled) {
        return;
      }

      if (!ctx.from) {
        return;
      }

      // ---------------------------------------------------
      // Get user
      // ---------------------------------------------------

      const user =
        await prisma.user.findUnique({
          where: {
            telegramId:
              BigInt(ctx.from.id),
          },
        });

      if (!user) {
        await ctx.reply(
          "Please send /start first so I can set up your account."
        );

        return;
      }

      // ---------------------------------------------------
      // Make sure onboarding is complete
      // ---------------------------------------------------

      if (
        !user.facultyId ||
        !user.departmentId ||
        !user.level
      ) {
        await ctx.reply(
          "Let's finish setting up your profile first. Please send /start."
        );

        return;
      }

      // ---------------------------------------------------
      // Get/create conversation
      // ---------------------------------------------------

      const conversation =
        await getOrCreateConversation(
          user.id
        );

      // ---------------------------------------------------
      // Send message through AI service
      // ---------------------------------------------------

      const response =
        await aiService.respond(
          user.id,
          conversation.id,
          ctx.message.text
        );

      // ---------------------------------------------------
      // Reply to Telegram
      // ---------------------------------------------------

      await ctx.reply(response);
    } catch (error) {
      console.error(
        "Error processing message:"
      );

      console.error(error);

      await ctx.reply(
        "Sorry, something went wrong while processing your message."
      );
    }
  }
);