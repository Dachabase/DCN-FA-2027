import "dotenv/config";

import { Bot } from "grammy";

import { prisma } from "../database/prisma";

import {
  findOrCreateUser,
} from "../users/user.service";

import {
  getOnboardingStep,
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

      const onboardingStep =
        await getOnboardingStep(
          user.id
        );

      // ---------------------------------------------------
      // ONBOARDING NOT COMPLETE
      // ---------------------------------------------------

      if (
        onboardingStep &&
        onboardingStep !== "COMPLETE"
      ) {
        await ctx.reply(
          `Welcome back, ${telegramUser.first_name}! 👋\n\n` +
            `Let's continue setting up your Computing Freshers Companion. 🎓`
        );

        return;
      }

      // ---------------------------------------------------
      // CHECK WHETHER USER ALREADY HAS A CONVERSATION
      // ---------------------------------------------------

      const existingConversation =
        await prisma.conversation.findFirst({
          where: {
            userId: user.id,
          },
          include: {
            messages: {
              take: 1,
            },
          },
          orderBy: {
            updatedAt: "desc",
          },
        });

      // ---------------------------------------------------
      // COMPLETELY NEW STUDENT
      // ---------------------------------------------------

      if (
        !existingConversation ||
        existingConversation.messages.length === 0
      ) {
        await ctx.reply(
          `Hey ${telegramUser.first_name}! 👋\n\n` +
            `Welcome to the University of Ibadan Computing Freshers Companion. 🎓\n\n` +
            `I'm here to help you navigate your journey as a Computing student at UI.`
        );

        return;
      }

      // ---------------------------------------------------
      // EXISTING STUDENT
      // ---------------------------------------------------

      await ctx.reply(
        `You're already registered as a Computing student. 🎓\n\n` +
          `What can I help you with?`
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

      const onboardingStep =
        await getOnboardingStep(
          user.id
        );

      console.log(
        `[BOT] Onboarding step: ${
          onboardingStep ?? "NONE"
        }`
      );

      // Only unfinished onboarding steps should
      // be handled by the onboarding handler.
      if (
        onboardingStep &&
        onboardingStep !== "COMPLETE"
      ) {
        console.log(
          "[BOT] Onboarding is still active. Routing message to onboarding handler."
        );

        await handleOnboardingMessage(
          ctx
        );

        return;
      }

      console.log(
        "[BOT] Onboarding complete. Continuing to AI..."
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
      // SEND RESPONSE
      // ---------------------------------------------------

      console.log(
        "[BOT] Sending AI response to Telegram..."
      );

      await ctx.reply(
        formattedResponse,
        {
          parse_mode: "HTML",
        }
      );

      console.log(
        "[BOT] Response successfully sent."
      );

      // ---------------------------------------------------
      // EXTRACT NEW MEMORIES
      // ---------------------------------------------------

      /**
       * IMPORTANT:
       *
       * Memory extraction happens AFTER the student's
       * response has already been sent to Telegram.
       *
       * We intentionally do NOT await this operation.
       *
       * This means memory extraction can never add
       * latency to the student's response.
       *
       * The memory extractor itself also contains a
       * lightweight candidate filter, so ordinary
       * questions do not need another Gemini request.
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
            /**
             * Memory extraction is intentionally isolated
             * from the main conversation flow.
             *
             * A memory failure must NEVER cause the
             * student's successfully generated response
             * to be treated as a failed message.
             */
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