import "dotenv/config";

import { Bot } from "grammy";

import { prisma } from "../database/prisma";

import {
  findOrCreateUser,
} from "../users/user.service";

import {
  getOnboardingStep,
  setOnboardingStep,
} from "../onboarding/onboarding.service";

import {
  handleOnboardingMessage,
} from "../onboarding/onboarding.handler";

import {
  generateAIResponseFromContext,
} from "../ai/ai.service";

import {
  buildAIContext,
} from "../ai/context.builder";

import {
  extractAndSaveMemories,
} from "../memory/memory.extractor";

import {
  getOrCreateConversation,
} from "../conversations/conversation.service";

import {
  saveUserMessage,
  saveAssistantMessage,
} from "../conversations/message.service";

import {
  formatTelegramResponse,
  splitTelegramResponse,
} from "./response-formatter";

// ---------------------------------------------------------
// BOT CONFIGURATION
// ---------------------------------------------------------

const token =
  process.env.TELEGRAM_COMPUTING_BOT_TOKEN;

if (!token) {
  throw new Error(
    "TELEGRAM_COMPUTING_BOT_TOKEN is not configured in .env"
  );
}

export const computingBot =
  new Bot(token);

// ---------------------------------------------------------
// BOT FACULTY
// ---------------------------------------------------------

/**
 * The Telegram bot itself determines the faculty it represents.
 *
 * We do NOT immediately assign this faculty to a student.
 *
 * A student may have opened the wrong faculty bot, so the
 * faculty is treated as a candidate until the student confirms it.
 */
async function getComputingBotFaculty() {
  const botInfo =
    await computingBot.api.getMe();

  const botRecord =
    await prisma.bot.findUnique({
      where: {
        telegramBotId: BigInt(botInfo.id),
      },

      include: {
        faculty: true,
      },
    });

  if (!botRecord) {
    throw new Error(
      `No database record found for Telegram bot ${botInfo.id} (@${botInfo.username ?? "unknown"}).`
    );
  }

  if (!botRecord.faculty) {
    throw new Error(
      `Telegram bot @${botInfo.username ?? "unknown"} is not assigned to a faculty in the database.`
    );
  }

  return botRecord.faculty;
}

// ---------------------------------------------------------
// START COMMAND
// ---------------------------------------------------------

computingBot.command(
  "start",
  async (ctx) => {
    try {
      const telegramUser =
        ctx.from;

      if (!telegramUser) {
        return;
      }

      console.log(
        "[BOT] Resolving faculty represented by this bot..."
      );

      const botFaculty =
        await getComputingBotFaculty();

      console.log(
        `[BOT] Bot faculty: ${botFaculty.name} (${botFaculty.id})`
      );

      const user =
        await findOrCreateUser({
          telegramId:
            BigInt(telegramUser.id),

          firstName:
            telegramUser.first_name,

          lastName:
            telegramUser.last_name,

          username:
            telegramUser.username,
        });

      console.log(
        `[BOT] User loaded: ${user.id}`
      );

      const onboardingStep =
        await getOnboardingStep(
          user.id
        );

      // // ---------------------------------------------------
      // // ONBOARDING ALREADY IN PROGRESS
      // // ---------------------------------------------------

      // if (
      //   onboardingStep &&
      //   onboardingStep !== "COMPLETE"
      // ) {
      //   /**
      //    * If the user is already in onboarding, continue the
      //    * existing onboarding flow rather than silently changing
      //    * their faculty.
      //    */
      //   if (
      //     onboardingStep ===
      //     "FACULTY_CONFIRMATION"
      //   ) {
      //     await ctx.reply(
      //       `Welcome back, ${telegramUser.first_name}! 👋\n\n` +
      //         `Before we continue, I just need to confirm something.\n\n` +
      //         `Are you a ${botFaculty.name} student?\n\n` +
      //         `Please reply with "Yes" or "No".`
      //     );

      //     return;
      //   }

      //   await ctx.reply(
      //     `Welcome back, ${telegramUser.first_name}! 👋\n\n` +
      //       `Let's continue setting up your Computing Freshers Companion. 🎓`
      //   );

      //   return;
      // }

           
      // ---------------------------------------------------
      // ONBOARDING ALREADY IN PROGRESS
      // ---------------------------------------------------

      if (
        onboardingStep &&
        onboardingStep !== "COMPLETE"
      ) {
        /**
         * /start acts as a resume command.
         *
         * We do not restart onboarding or modify the user's
         * faculty. We simply remind the student what information
         * is currently required.
         */

        if (
          onboardingStep ===
          "FACULTY_CONFIRMATION"
        ) {
          await ctx.reply(
            `Welcome back, ${telegramUser.first_name}! 👋\n\n` +
              `Are you a ${botFaculty.name} student?\n\n` +
              `Just reply "Yes" or "No".`
          );

          return;
        }

        if (
          onboardingStep ===
          "DEPARTMENT"
        ) {
          await ctx.reply(
            `Welcome back, ${telegramUser.first_name}! 👋\n\n` +
              `What department are you in?\n\n` +
              `Just tell me the name of your department.`
          );

          return;
        }

        if (
          onboardingStep ===
          "LEVEL"
        ) {
          await ctx.reply(
            `Welcome back, ${telegramUser.first_name}! 👋\n\n` +
              `What level are you entering?\n\n` +
              `You can simply say "100" or "100 level".`
          );

          return;
        }
      }

      // ---------------------------------------------------
      // USER HAS NO FACULTY
      // ---------------------------------------------------

      if (!user.facultyId) {
        console.log(
          "[BOT] User has no faculty assigned."
        );

        console.log(
          "[BOT] Starting faculty confirmation."
        );

        await setOnboardingStep(
          user.id,
          "FACULTY_CONFIRMATION"
        );

        await ctx.reply(
          `Hey ${telegramUser.first_name}! 👋\n\n` +
            `Welcome to the University of Ibadan ${botFaculty.name} Freshers Companion. 🎓\n\n` +
            `Before we get you set up, I just need to confirm something:\n\n` +
            `Are you a ${botFaculty.name} student?\n\n` +
            `Please reply with "Yes" or "No".`
        );

        return;
      }

      // ---------------------------------------------------
      // USER ALREADY HAS A FACULTY
      // ---------------------------------------------------

      const userFaculty =
        await prisma.faculty.findUnique({
          where: {
            id: user.facultyId,
          },
        });

      // ---------------------------------------------------
      // USER'S FACULTY MATCHES THIS BOT
      // ---------------------------------------------------

      if (
        userFaculty &&
        userFaculty.id === botFaculty.id
      ) {
        console.log(
          `[BOT] User is already registered under ${botFaculty.name}.`
        );

        await ctx.reply(
          `Welcome back, ${telegramUser.first_name}! 👋\n\n` +
            `You're already registered as a ${botFaculty.name} student. 🎓\n\n` +
            `What can I help you with?`
        );

        return;
      }

      // ---------------------------------------------------
      // USER BELONGS TO A DIFFERENT FACULTY
      // ---------------------------------------------------

      console.log(
        `[BOT] User already belongs to another faculty: ${
          userFaculty?.name ?? user.facultyId
        }`
      );

      await ctx.reply(
        `Hey ${telegramUser.first_name}! 👋\n\n` +
          `I can see that your account is currently registered under ${
            userFaculty?.name ?? "another faculty"
          }.\n\n` +
          `This bot is for ${botFaculty.name} students.\n\n` +
          `If you believe your faculty should be changed, please contact the Freshers Companion support team rather than creating conflicting faculty records.`
      );
    } catch (error) {
      console.error(
        "Error processing /start command:",
        error
      );

      try {
        await ctx.reply(
          "Sorry, something went wrong while starting the bot. Please try again."
        );
      } catch (replyError) {
        console.error(
          "Failed to send start error message:",
          replyError
        );
      }
    }
  }
);

// ---------------------------------------------------------
// TEXT MESSAGES
// ---------------------------------------------------------

computingBot.on(
  "message:text",
  async (ctx) => {
    try {
      const telegramUser =
        ctx.from;

      if (!telegramUser) {
        return;
      }

      const message =
        ctx.message.text.trim();

      if (!message) {
        return;
      }

      console.log(
        "[BOT] Text message received."
      );

      console.log(
        `[BOT] Message from ${telegramUser.first_name}: "${message}"`
      );

      // ---------------------------------------------------
      // RESOLVE BOT FACULTY
      // ---------------------------------------------------

      console.log(
        "[BOT] Resolving faculty represented by this bot..."
      );

      const botFaculty =
        await getComputingBotFaculty();

      console.log(
        `[BOT] Bot faculty: ${botFaculty.name} (${botFaculty.id})`
      );

      // ---------------------------------------------------
      // LOAD USER
      // ---------------------------------------------------

      console.log(
        "[BOT] Loading user..."
      );

      const user =
        await findOrCreateUser({
          telegramId:
            BigInt(telegramUser.id),

          firstName:
            telegramUser.first_name,

          lastName:
            telegramUser.last_name,

          username:
            telegramUser.username,
        });

      console.log(
        `[BOT] User loaded: ${user.id}`
      );

      // ---------------------------------------------------
      // CHECK ONBOARDING
      // ---------------------------------------------------

      console.log(
        "[BOT] Checking onboarding state..."
      );

      let onboardingStep =
        await getOnboardingStep(
          user.id
        );

      console.log(
        `[BOT] Onboarding step: ${
          onboardingStep ?? "NONE"
        }`
      );

      // ---------------------------------------------------
      // FIRST CONTACT WITHOUT FACULTY
      // ---------------------------------------------------

      /**
       * A user can send a message without pressing /start.
       *
       * If they have no faculty yet, the bot must establish
       * the bot's faculty before allowing normal AI interaction.
       */
      if (
        !user.facultyId &&
        !onboardingStep
      ) {
        console.log(
          "[BOT] User has no faculty. Starting faculty confirmation."
        );

        await setOnboardingStep(
          user.id,
          "FACULTY_CONFIRMATION"
        );

        onboardingStep =
          "FACULTY_CONFIRMATION";
      }

      // ---------------------------------------------------
      // ONBOARDING ACTIVE
      // ---------------------------------------------------

      if (
        onboardingStep &&
        onboardingStep !== "COMPLETE"
      ) {
        console.log(
          "[BOT] Onboarding is still active. Routing message to onboarding handler."
        );

        const handled =
          await handleOnboardingMessage(
            ctx,
            botFaculty.id
          );

        if (handled) {
          return;
        }
      }

      // ---------------------------------------------------
      // SAFETY CHECK
      // ---------------------------------------------------

      /**
       * If the user still has no faculty after onboarding,
       * do not send the message to the AI without faculty
       * context.
       */
      const refreshedUser =
        await prisma.user.findUnique({
          where: {
            id: user.id,
          },
        });

      if (!refreshedUser) {
        throw new Error(
          "User disappeared while processing message."
        );
      }

      if (!refreshedUser.facultyId) {
        console.log(
          "[BOT] Faculty has not been established. Stopping before AI."
        );

        return;
      }

      console.log(
        "[BOT] Faculty established. Continuing to AI..."
      );

      // ---------------------------------------------------
      // LOAD / CREATE CONVERSATION
      // ---------------------------------------------------

      console.log(
        "[BOT] Loading conversation..."
      );

      const conversation =
        await getOrCreateConversation(
          user.id
        );

      console.log(
        `[BOT] Conversation: ${conversation.id}`
      );

      // ---------------------------------------------------
      // BUILD AI CONTEXT
      // ---------------------------------------------------

      /**
       * IMPORTANT:
       *
       * We build context BEFORE saving the current
       * user message.
       *
       * This allows the context builder to correctly
       * determine whether this is the first message.
       */
      console.log(
        "[BOT] Building AI context..."
      );

      const aiContext =
        await buildAIContext(
          user.id,
          conversation.id,
          message
        );

      console.log(
        `[BOT] Previous messages: ${aiContext.messages.length}`
      );

      console.log(
        `[BOT] First message: ${aiContext.isFirstMessage}`
      );

      console.log(
        `[BOT] Memories available: ${aiContext.memories.length}`
      );

      // ---------------------------------------------------
      // SAVE USER MESSAGE
      // ---------------------------------------------------

      console.log(
        "[BOT] Saving user message..."
      );

      await saveUserMessage(
        conversation.id,
        message
      );

      // ---------------------------------------------------
      // GENERATE AI RESPONSE
      // ---------------------------------------------------

      console.log(
        "[BOT] Calling Gemini..."
      );

      const aiResponse =
        await generateAIResponseFromContext(
          aiContext
        );

      console.log(
        "[BOT] Gemini response generated."
      );

      // ---------------------------------------------------
      // SAVE AI RESPONSE
      // ---------------------------------------------------

      console.log(
        "[BOT] Saving AI response..."
      );

      await saveAssistantMessage(
        conversation.id,
        aiResponse
      );

      // ---------------------------------------------------
      // FORMAT RESPONSE FOR TELEGRAM
      // ---------------------------------------------------

      console.log(
        "[BOT] Formatting AI response for Telegram..."
      );

      const formattedResponse =
        formatTelegramResponse(
          aiResponse
        );

      if (!formattedResponse) {
        throw new Error(
          "AI response became empty after formatting."
        );
      }

      // ---------------------------------------------------
      // SPLIT RESPONSE FOR TELEGRAM
      // ---------------------------------------------------

      console.log(
        "[BOT] Preparing Telegram response chunks..."
      );

      const responseChunks =
        splitTelegramResponse(
          formattedResponse
        );

      if (
        responseChunks.length === 0
      ) {
        throw new Error(
          "AI response produced no Telegram message chunks."
        );
      }

      console.log(
        `[BOT] Telegram response split into ${responseChunks.length} message(s).`
      );

      responseChunks.forEach(
        (chunk, index) => {
          console.log(
            `[BOT] Chunk ${index + 1}/${responseChunks.length}: ${chunk.length} characters.`
          );
        }
      );

      // ---------------------------------------------------
      // SEND RESPONSE
      // ---------------------------------------------------

      console.log(
        "[BOT] Sending AI response to Telegram..."
      );

      for (
        let index = 0;
        index <
        responseChunks.length;
        index += 1
      ) {
        const chunk =
          responseChunks[index];

        console.log(
          `[BOT] Sending response chunk ${index + 1}/${responseChunks.length}...`
        );

        await ctx.reply(
          chunk,
          {
            parse_mode: "HTML",
          }
        );
      }

      console.log(
        "[BOT] Response successfully sent."
      );

      // ---------------------------------------------------
      // EXTRACT NEW MEMORIES
      // ---------------------------------------------------

      /**
       * Memory extraction happens AFTER the student's
       * response has already been sent to Telegram.
       *
       * We intentionally do NOT await this operation.
       *
       * This means memory extraction can never add
       * latency to the student's response.
       */
      console.log(
        "[BOT] Starting background memory check..."
      );

      void extractAndSaveMemories(
        user.id,
        message
      )
        .then(
          (newMemories) => {
            console.log(
              `[BOT] Background memory extraction complete. ` +
                `${newMemories.length} memory/memories saved.`
            );
          }
        )
        .catch(
          (memoryError) => {
            console.error(
              "[BOT] Background memory extraction failed:",
              memoryError
            );
          }
        );
    } catch (error) {
      console.error(
        "Error processing message:",
        error
      );

      try {
        await ctx.reply(
          "Sorry, I ran into a problem while processing your message. Please try again."
        );
      } catch (replyError) {
        console.error(
          "Failed to send error message to Telegram:",
          replyError
        );
      }
    }
  }
);

// ---------------------------------------------------------
// BOT ERROR HANDLER
// ---------------------------------------------------------

computingBot.catch(
  (error) => {
    console.error(
      "Computing bot error:",
      error
    );
  }
);

// ---------------------------------------------------------
// START BOT
// ---------------------------------------------------------

export async function startComputingBot(): Promise<void> {
  console.log(
    "Starting UI Computing Freshers Bot..."
  );

  await computingBot.start({
    onStart: (botInfo) => {
      console.log(
        `@${botInfo.username} is running`
      );
    },
  });
}