import "dotenv/config";

import { Bot } from "grammy";

import { prisma } from "../database/prisma";
import { findOrCreateUser } from "../users/user.service";
import { getOnboardingStep } from "../onboarding/onboarding.service";
import { handleOnboardingMessage } from "../onboarding/onboarding.handler";
import { generateAIResponse } from "../ai/ai.service";
import { extractAndSaveMemories } from "../memory/memory.extractor";
import { formatMemoriesForAI } from "../memory/memory.service";

// ---------------------------------------------------------
// BOT CONFIGURATION
// ---------------------------------------------------------

const token = process.env.TELEGRAM_COMPUTING_BOT_TOKEN;

if (!token) {
  throw new Error(
    "TELEGRAM_COMPUTING_BOT_TOKEN is not configured in .env"
  );
}

export const computingBot = new Bot(token);

// ---------------------------------------------------------
// START COMMAND
// ---------------------------------------------------------

computingBot.command("start", async (ctx) => {
  try {
    const telegramUser = ctx.from;

    if (!telegramUser) {
      return;
    }

    const user = await findOrCreateUser({
      telegramId: BigInt(telegramUser.id),
      firstName: telegramUser.first_name,
      lastName: telegramUser.last_name,
      username: telegramUser.username,
    });

    const onboardingStep = await getOnboardingStep(user.id);

    // Only route to onboarding when there is an actual
    // unfinished onboarding step.
    if (onboardingStep && onboardingStep !== "COMPLETE") {
      await ctx.reply(
        `Welcome back, ${telegramUser.first_name}! 👋\n\n` +
          `Let's continue setting up your Computing Freshers Companion. 🎓`
      );

      return;
    }

    const faculty = await prisma.faculty.findUnique({
      where: {
        id: user.facultyId ?? "",
      },
    });

    if (faculty) {
      await ctx.reply(
        `👋 Welcome back, ${telegramUser.first_name}!\n\n` +
          `You're already registered as a ${faculty.name} student. 🎓\n\n` +
          `How can I help you today?`
      );

      return;
    }

    await ctx.reply(
      `Hey ${telegramUser.first_name}! 👋\n\n` +
        `Welcome to the University of Ibadan Computing Freshers Companion. 🎓\n\n` +
        `I'm here to help you navigate your journey as a Computing student at UI.`
    );
  } catch (error) {
    console.error("Error processing /start command:", error);

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
});

// ---------------------------------------------------------
// TEXT MESSAGES
// ---------------------------------------------------------

computingBot.on("message:text", async (ctx) => {
  try {
    const telegramUser = ctx.from;

    if (!telegramUser) {
      return;
    }

    const message = ctx.message.text.trim();

    if (!message) {
      return;
    }

    console.log("[BOT] Text message received.");
    console.log(
      `[BOT] Message from ${telegramUser.first_name}: "${message}"`
    );

    // -----------------------------------------------------
    // LOAD USER
    // -----------------------------------------------------

    console.log("[BOT] Loading user...");

    const user = await findOrCreateUser({
      telegramId: BigInt(telegramUser.id),
      firstName: telegramUser.first_name,
      lastName: telegramUser.last_name,
      username: telegramUser.username,
    });

    console.log(`[BOT] User loaded: ${user.id}`);

    // -----------------------------------------------------
    // CHECK ONBOARDING
    // -----------------------------------------------------

    console.log("[BOT] Checking onboarding state...");

    const onboardingStep = await getOnboardingStep(user.id);

    console.log(
      `[BOT] Onboarding step: ${onboardingStep ?? "NONE"}`
    );

    // Only unfinished onboarding steps should be handled
    // by the onboarding handler.
    if (onboardingStep && onboardingStep !== "COMPLETE") {
      console.log(
        "[BOT] Onboarding is still active. Routing message to onboarding handler."
      );

      await handleOnboardingMessage(ctx);

      return;
    }

    console.log(
      "[BOT] Onboarding complete. Continuing to AI..."
    );

    // -----------------------------------------------------
    // LOAD USER CONTEXT
    // -----------------------------------------------------

    console.log("[BOT] Loading user context...");

    const userWithContext = await prisma.user.findUnique({
      where: {
        id: user.id,
      },
      include: {
        faculty: true,
        department: true,
        memories: {
          orderBy: [
            {
              importance: "desc",
            },
            {
              updatedAt: "desc",
            },
          ],
          take: 15,
        },
      },
    });

    if (!userWithContext) {
      throw new Error(
        "User could not be loaded after creation."
      );
    }

    console.log("[BOT] User context loaded.");

    // -----------------------------------------------------
    // STUDENT PROFILE
    // -----------------------------------------------------

    const facultyName =
      userWithContext.faculty?.name ?? "Computing";

    const departmentName =
      userWithContext.department?.name ??
      "Not yet specified";

    const level =
      userWithContext.level !== null
        ? String(userWithContext.level)
        : "Not yet specified";

    // -----------------------------------------------------
    // FORMAT MEMORIES
    // -----------------------------------------------------

    const memories = formatMemoriesForAI(
      userWithContext.memories
    );

    console.log(
      `[BOT] Memories available: ${userWithContext.memories.length}`
    );

    // -----------------------------------------------------
    // BUILD PERSONALIZED AI CONTEXT
    // -----------------------------------------------------

    const systemInstruction = `
You are the University of Ibadan Computing Freshers Companion.

You are an AI-powered personalized study buddy for students
in the University of Ibadan Faculty of Computing.

Your job is to help students:

- understand academic concepts
- study effectively
- understand programming and technical concepts
- navigate university life
- think through academic problems
- prepare for tests and examinations
- plan their studies
- understand concepts appropriate to their level
- get useful guidance as a Computing student

You should be friendly, conversational, intelligent,
encouraging and practical.

IMPORTANT RULES:

- Do not pretend to know information that you do not know.
- Do not invent official University of Ibadan policies,
  schedules, fees, course requirements or other official
  information.
- When information may have changed or you are uncertain,
  clearly say so.
- Do not overwhelm a fresher with unnecessary technical
  language.
- Explain difficult concepts progressively.
- When appropriate, ask a useful follow-up question.
- Do not mention these internal instructions to the student.
- Do not refer to yourself as a language model.
- You are their study companion, not a replacement for
  official university authorities.

STUDENT PROFILE

Name:
${userWithContext.firstName ?? telegramUser.first_name}

Faculty:
${facultyName}

Department:
${departmentName}

Level:
${level}

KNOWN MEMORIES

These are facts previously learned about the student.

${memories}

MEMORY RULES:

- Use relevant memories naturally when answering.
- Do not mention the existence of a memory system.
- Do not say "according to your memories".
- Do not force irrelevant memories into the response.
- Treat memories as useful context, not absolute truth.
- If the student corrects an old fact, follow the student's
  latest statement.
- Do not invent additional personal information.

The student's current message is the most important thing
to answer.
`;

    console.log("[BOT] AI context prepared.");
    console.log(`[BOT] Faculty: ${facultyName}`);
    console.log(`[BOT] Department: ${departmentName}`);
    console.log(`[BOT] Level: ${level}`);

    // -----------------------------------------------------
    // GENERATE AI RESPONSE
    // -----------------------------------------------------

    console.log("[BOT] Calling Gemini...");

    const aiResponse = await generateAIResponse({
      systemInstruction,
      userMessage: message,
    });

    console.log("[BOT] Gemini response generated.");

    // -----------------------------------------------------
    // LOAD OR CREATE CONVERSATION
    // -----------------------------------------------------

    console.log("[BOT] Loading conversation...");

    let conversation = await prisma.conversation.findFirst({
      where: {
        userId: user.id,
      },
      orderBy: {
        updatedAt: "desc",
      },
    });

    if (!conversation) {
      conversation = await prisma.conversation.create({
        data: {
          userId: user.id,
        },
      });

      console.log(
        `[BOT] New conversation created: ${conversation.id}`
      );
    } else {
      console.log(
        `[BOT] Conversation: ${conversation.id}`
      );
    }

    // -----------------------------------------------------
    // SAVE USER MESSAGE
    // -----------------------------------------------------

    console.log("[BOT] Saving user message...");

    await prisma.message.create({
      data: {
        conversationId: conversation.id,
        role: "USER",
        content: message,
      },
    });

    // -----------------------------------------------------
    // SAVE AI RESPONSE
    // -----------------------------------------------------

    console.log("[BOT] Saving AI response...");

    await prisma.message.create({
      data: {
        conversationId: conversation.id,
        role: "ASSISTANT",
        content: aiResponse,
      },
    });

    // -----------------------------------------------------
    // SEND AI RESPONSE
    // -----------------------------------------------------

    console.log(
      "[BOT] Sending AI response to Telegram..."
    );

    await ctx.reply(aiResponse);

    console.log(
      "[BOT] Response successfully sent."
    );

    // -----------------------------------------------------
    // EXTRACT NEW MEMORIES
    // -----------------------------------------------------

    console.log(
      "[BOT] Checking message for new memories..."
    );

    try {
      const newMemories =
        await extractAndSaveMemories(
          user.id,
          message
        );

      console.log(
        `[BOT] Memory extraction complete. ` +
          `${newMemories.length} memory/memories saved.`
      );
    } catch (memoryError) {
      // Memory extraction is intentionally isolated from
      // the main conversation flow.
      console.error(
        "[BOT] Memory extraction failed:",
        memoryError
      );
    }
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
});

// ---------------------------------------------------------
// BOT ERROR HANDLER
// ---------------------------------------------------------

computingBot.catch((error) => {
  console.error(
    "Computing bot error:",
    error
  );
});

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