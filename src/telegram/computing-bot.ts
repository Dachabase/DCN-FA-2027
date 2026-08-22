import "dotenv/config";

import { Bot, Keyboard, InlineKeyboard } from "grammy";

import { prisma } from "../database/prisma";
import { findOrCreateUser } from "../users/user.service";
import { getOnboardingStep } from "../onboarding/onboarding.service";
import { handleOnboardingMessage } from "../onboarding/onboarding.handler";
import { generateAIResponse } from "../ai/ai.service";
import { extractAndSaveMemories } from "../memory/memory.extractor";
import { formatMemoriesForAI } from "../memory/memory.service";
import { quizService } from "../quiz/quiz.service";

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

// Persistent Reply Keyboard (MB3PrepBot Style)
const mainReplyKeyboard = new Keyboard()
  .text("🎭 Practice CBT").text("📝 Exam Mode").row()
  .text("🔄 Revision").text("📊 My Stats").row()
  .text("🏆 Leaderboard").text("💬 Ask AI Mentor")
  .resized();

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

    if (onboardingStep && onboardingStep !== "COMPLETE") {
      await ctx.reply(
        `Welcome back, ${telegramUser.first_name}! 👋\n\n` +
          `Let's continue setting up your Computing Freshers Companion. 🎓`,
        { reply_markup: mainReplyKeyboard }
      );
      return;
    }

    const faculty = await prisma.faculty.findUnique({
      where: { id: user.facultyId ?? "" },
    });

    if (faculty) {
      await ctx.reply(
        `👋 Welcome back, ${telegramUser.first_name}!\n\n` +
          `You're ready to study with your ${faculty.name} Companion. 🎓\n\n` +
          `Choose an option below or type any academic question:`,
        { reply_markup: mainReplyKeyboard }
      );
      return;
    }

    await ctx.reply(
      `Hey ${telegramUser.first_name}! 👋\n\n` +
        `Welcome to the University of Ibadan Computing Freshers Companion. 🎓\n\n` +
        `I'm here to help you navigate your journey as a Computing student at UI.`,
      { reply_markup: mainReplyKeyboard }
    );
  } catch (error) {
    console.error("Error processing /start command:", error);
    try {
      await ctx.reply("Sorry, something went wrong while starting the bot. Please try again.");
    } catch (replyError) {
      console.error("Failed to send start error message:", replyError);
    }
  }
});

// ---------------------------------------------------------
// CBT PRACTICE & STATS HANDLERS
// ---------------------------------------------------------

computingBot.hears(["🎭 Practice CBT", "📝 Exam Mode", "🔄 Revision"], async (ctx) => {
  try {
    const count = await prisma.question.count();
    if (count === 0) {
      return ctx.reply(
        `📚 *CBT Question Bank Update*\n\n` +
          `The official CBT Question Bank for 100L General & Departmental courses (GST101, MAT111, CSC101, etc.) is currently being uploaded by your department.\n\n` +
          `💡 In the meantime, ask me any course or academic question directly and I'll explain it step-by-step!`,
        { parse_mode: "Markdown", reply_markup: mainReplyKeyboard }
      );
    }

    const keyboard = new InlineKeyboard()
      .text("CSC101", "quiz_course_CSC101")
      .text("MAT111", "quiz_course_MAT111").row()
      .text("GST101", "quiz_course_GST101")
      .text("GES107", "quiz_course_GES107");

    await ctx.reply(
      `🎯 *Select a Course for CBT Practice:*\n\nChoose a course to begin practice mode:`,
      { parse_mode: "Markdown", reply_markup: keyboard }
    );
  } catch (error) {
    console.error("Error handling CBT command:", error);
    ctx.reply("Unable to load CBT courses. Please try again later.");
  }
});

computingBot.hears("📊 My Stats", async (ctx) => {
  try {
    const telegramUser = ctx.from;
    if (!telegramUser) return;

    const user = await prisma.user.findUnique({
      where: { telegramId: BigInt(telegramUser.id) },
      include: { department: true, faculty: true, quizAttempts: true },
    });

    if (!user) {
      return ctx.reply("Profile not found. Send /start to initialize your account.");
    }

    const attemptsCount = user.quizAttempts.length;
    const streak = user.streakCount || 0;
    const points = user.totalPoints || 0;

    await ctx.reply(
      `📊 *Your Academic Progress & Stats*\n\n` +
        `👤 *Student:* ${user.firstName || "Freshman"}\n` +
        `🎓 *Faculty:* ${user.faculty?.name || "Computing"}\n` +
        `📚 *Department:* ${user.department?.name || "Unassigned"}\n\n` +
        `🔥 *Daily Streak:* ${streak} day(s)\n` +
        `⭐ *Total Points:* ${points} pts\n` +
        `📝 *Quizzes Completed:* ${attemptsCount}\n`,
      { parse_mode: "Markdown", reply_markup: mainReplyKeyboard }
    );
  } catch (error) {
    console.error("Error displaying stats:", error);
    ctx.reply("Failed to load your statistics.");
  }
});

computingBot.hears("🏆 Leaderboard", async (ctx) => {
  try {
    const leaders = await quizService.getLeaderboard(5);
    if (leaders.length === 0) {
      return ctx.reply(
        `🏆 *UI Freshers Leaderboard*\n\nNo quiz attempts logged yet. Be the first to practice once the Question Bank goes live!`,
        { parse_mode: "Markdown", reply_markup: mainReplyKeyboard }
      );
    }

    let msg = `🏆 *Top UI Freshers Leaderboard*\n\n`;
    leaders.forEach((u, i) => {
      const name = u.firstName || u.username || `Freshman #${u.id.substring(0, 4)}`;
      msg += `${i + 1}. *${name}* — ${u.totalPoints} pts (🔥 ${u.streakCount}d streak)\n`;
    });

    await ctx.reply(msg, { parse_mode: "Markdown", reply_markup: mainReplyKeyboard });
  } catch (error) {
    console.error("Leaderboard error:", error);
    ctx.reply("Could not fetch leaderboard.");
  }
});

// ---------------------------------------------------------
// TEXT MESSAGES (AI ASSISTANT & ONBOARDING)
// ---------------------------------------------------------

computingBot.on("message:text", async (ctx) => {
  try {
    const telegramUser = ctx.from;
    if (!telegramUser) return;

    const message = ctx.message.text.trim();
    if (!message) return;

    if (["🎭 Practice CBT", "📝 Exam Mode", "🔄 Revision", "📊 My Stats", "🏆 Leaderboard", "💬 Ask AI Mentor"].includes(message)) {
      if (message === "💬 Ask AI Mentor") {
        return ctx.reply("What topic or concept would you like to study today? Ask me anything!", { reply_markup: mainReplyKeyboard });
      }
      return;
    }

    console.log(`[BOT] Message from ${telegramUser.first_name}: "${message}"`);

    const user = await findOrCreateUser({
      telegramId: BigInt(telegramUser.id),
      firstName: telegramUser.first_name,
      lastName: telegramUser.last_name,
      username: telegramUser.username,
    });

    const onboardingStep = await getOnboardingStep(user.id);
    if (onboardingStep && onboardingStep !== "COMPLETE") {
      await handleOnboardingMessage(ctx);
      return;
    }

    const userWithContext = await prisma.user.findUnique({
      where: { id: user.id },
      include: {
        faculty: true,
        department: true,
        memories: {
          orderBy: [{ importance: "desc" }, { updatedAt: "desc" }],
          take: 15,
        },
      },
    });

    if (!userWithContext) {
      throw new Error("User could not be loaded after creation.");
    }

    const facultyName = userWithContext.faculty?.name ?? "Computing";
    const departmentName = userWithContext.department?.name ?? "Not yet specified";
    const level = userWithContext.level !== null ? String(userWithContext.level) : "Not yet specified";

    const memories = formatMemoriesForAI(userWithContext.memories);

    const systemInstruction = `
You are the University of Ibadan Computing Freshers Companion.

You are an AI-powered personalized study buddy for students
in the University of Ibadan Faculty of Computing.

Your job is to help students:
- understand academic concepts
- study effectively
- understand programming and technical concepts
- navigate university life
- prepare for tests and examinations

STUDENT PROFILE:
Name: ${userWithContext.firstName ?? telegramUser.first_name}
Faculty: ${facultyName}
Department: ${departmentName}
Level: ${level}

KNOWN MEMORIES:
${memories}
`;

    const aiResponse = await generateAIResponse({
      systemInstruction,
      userMessage: message,
    });

    let conversation = await prisma.conversation.findFirst({
      where: { userId: user.id },
      orderBy: { updatedAt: "desc" },
    });

    if (!conversation) {
      conversation = await prisma.conversation.create({
        data: { userId: user.id },
      });
    }

    await prisma.message.create({
      data: {
        conversationId: conversation.id,
        role: "USER",
        content: message,
      },
    });

    await prisma.message.create({
      data: {
        conversationId: conversation.id,
        role: "ASSISTANT",
        content: aiResponse,
      },
    });

    await ctx.reply(aiResponse, { reply_markup: mainReplyKeyboard });

    try {
      await extractAndSaveMemories(user.id, message);
    } catch (memoryError) {
      console.error("[BOT] Memory extraction failed:", memoryError);
    }
  } catch (error) {
    console.error("Error processing message:", error);
    try {
      await ctx.reply("Sorry, I ran into a problem while processing your message. Please try again.");
    } catch (replyError) {
      console.error("Failed to send error message to Telegram:", replyError);
    }
  }
});

computingBot.catch((error) => {
  console.error("Computing bot error:", error);
});

export async function startComputingBot(): Promise<void> {
  console.log("Starting UI Computing Freshers Bot...");
  await computingBot.start({
    onStart: (botInfo) => {
      console.log(`@${botInfo.username} is running`);
    },
  });
}