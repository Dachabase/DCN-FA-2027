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

// 1. Persistent Reply Keyboard (Bottom Bar)
const mainReplyKeyboard = new Keyboard()
  .text("🎭 Practice CBT").text("📝 Exam Mode").row()
  .text("🔄 Revision").text("📊 My Stats").row()
  .text("🏆 Leaderboard").text("💡 Quick Prompts").row()
  .text("💬 Ask AI Mentor")
  .resized();

// 2. Interactive Quick Prompts (Inline Tap Keyboards)
const getQuickPromptsKeyboard = () => {
  return new InlineKeyboard()
    .text("📋 100L Course Registration Guide", "prompt_course_reg").row()
    .text("📊 How UI 4.0 CGPA Works", "prompt_cgpa").row()
    .text("🏛️ Lecture Venues & Labs", "prompt_venues")
    .text("💰 Scholarships & Jobs", "prompt_scholarships").row()
    .text("❓ Clearance FAQs", "prompt_clearance")
    .text("🎭 CBT Question Bank", "prompt_cbt");
};

// ---------------------------------------------------------
// START COMMAND
// ---------------------------------------------------------

computingBot.command("start", async (ctx) => {
  try {
    const telegramUser = ctx.from;
    if (!telegramUser) return;

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
          `Let me know what you'd like to explore today. Tap any prompt below:`,
        { reply_markup: getQuickPromptsKeyboard() }
      );
      return;
    }

    const faculty = await prisma.faculty.findUnique({
      where: { id: user.facultyId ?? "" },
    });

    const facultyName = faculty?.name || "Computing";

    await ctx.reply(
      `👋 *Welcome, ${telegramUser.first_name}!* 🎓\n\n` +
        `I am your **UI ${facultyName} Freshers Companion**.\n` +
        `I can answer academic questions, guide you through course registration, explain CGPA rules, and help you practice CBT questions!\n\n` +
        `👇 *Tap a prompt below to get started immediately, or type any question:*`,
      { parse_mode: "Markdown", reply_markup: getQuickPromptsKeyboard() }
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
// INTERACTIVE PROMPT CALLBACK HANDLERS (TAP TO CHOOSE)
// ---------------------------------------------------------

computingBot.callbackQuery("prompt_course_reg", async (ctx) => {
  await ctx.answerCallbackQuery();
  const followUpKeyboard = new InlineKeyboard()
    .text("📚 100L Core Courses", "prompt_core_courses")
    .text("⏳ Add/Drop Deadline", "prompt_add_drop").row()
    .text("🔙 Back to Main Prompts", "prompt_main_menu");

  await ctx.reply(
    `📋 *100L Course Registration Walkthrough*\n\n` +
      `Every 100 Level student must register for compulsory general courses (**GST101, GST102, GES107**) alongside departmental core courses.\n\n` +
      `📌 *Key Rules:*\n` +
      `• **Max Credit Load:** 24 units per semester (Min: 15 units).\n` +
      `• **Validation:** Must be signed by your Departmental Adviser.\n` +
      `• **Clearance:** Print 4 copies of your Form 01.\n\n` +
      `What would you like to check next?`,
    { parse_mode: "Markdown", reply_markup: followUpKeyboard }
  );
});

computingBot.callbackQuery("prompt_cgpa", async (ctx) => {
  await ctx.answerCallbackQuery();
  const followUpKeyboard = new InlineKeyboard()
    .text("⚠️ Probation & Withdrawal Rules", "prompt_probation")
    .text("🔙 Main Prompts", "prompt_main_menu");

  await ctx.reply(
    `📊 *UI 4.0 CGPA Grading System*\n\n` +
      `The Senate of the University of Ibadan operates a **4.0 Scale**:\n\n` +
      `• **70% - 100%**: Grade A (4.0 GP)\n` +
      `• **60% - 69%**: Grade B (3.0 GP)\n` +
      `• **50% - 59%**: Grade C (2.0 GP)\n` +
      `• **45% - 49%**: Grade D (1.0 GP)\n` +
      `• **0% - 44%**: Grade F (0.0 GP)\n\n` +
      `• **Good Standing:** CGPA ≥ 1.50\n` +
      `• **Probation:** CGPA between 1.00 and 1.49 at end of session.`,
    { parse_mode: "Markdown", reply_markup: followUpKeyboard }
  );
});

computingBot.callbackQuery("prompt_venues", async (ctx) => {
  await ctx.answerCallbackQuery();
  await ctx.reply(
    `🏛️ *UI Campus Lecture Venues & Labs*\n\n` +
      `• **Large Lecture Theatre (LLT):** Adjacent to Faculty of Science (Venue for GST & MAT lectures).\n` +
      `• **Computing Computer Lab 1 & 2:** Ground Floor, New Computing Building.\n` +
      `• **SUB Pit Theatre:** Student Union Building grounds.\n` +
      `• **Kenneth Dike Library (KDL) E-Classroom:** 2nd Floor, KDL main building.`,
    { parse_mode: "Markdown", reply_markup: getQuickPromptsKeyboard() }
  );
});

computingBot.callbackQuery("prompt_scholarships", async (ctx) => {
  await ctx.answerCallbackQuery();
  await ctx.reply(
    `💰 *Freshers Scholarships & Work-Study Opportunities*\n\n` +
      `1. **MTN Foundation STEM Scholarship:** ₦200,000 annual grant awarded to STEM students.\n` +
      `2. **UI Work-Study Scheme:** Earn up to ₦35,000 monthly working max 2 hours daily in campus libraries or ICT centers.\n` +
      `3. **GDSC UI Tech Community:** Gain practical web, mobile, and AI development skills.`,
    { parse_mode: "Markdown", reply_markup: getQuickPromptsKeyboard() }
  );
});

computingBot.callbackQuery("prompt_clearance", async (ctx) => {
  await ctx.answerCallbackQuery();
  await ctx.reply(
    `❓ *Departmental Physical Clearance Requirements*\n\n` +
      `Bring originals and photocopies of:\n` +
      `1. JAMB Admission Letter\n` +
      `2. UI Acceptance Fee Receipt\n` +
      `3. O'Level Result / Certificate\n` +
      `4. Birth Certificate / Sworn Age Declaration\n` +
      `5. Four (4) recent passport photographs`,
    { parse_mode: "Markdown", reply_markup: getQuickPromptsKeyboard() }
  );
});

computingBot.callbackQuery("prompt_core_courses", async (ctx) => {
  await ctx.answerCallbackQuery();
  await ctx.reply(
    `📚 *100L Core Computing Courses*\n\n` +
      `• **CSC101:** Intro to Computer Science (3 Units)\n` +
      `• **CSC102:** Intro to Problem Solving & Programming (3 Units)\n` +
      `• **MAT111:** Algebra & Trigonometry (3 Units)\n` +
      `• **MAT121:** Calculus I (3 Units)\n` +
      `• **PHY101:** General Physics I (3 Units)\n` +
      `• **GST101:** Use of English I (2 Units)`,
    { parse_mode: "Markdown", reply_markup: getQuickPromptsKeyboard() }
  );
});

computingBot.callbackQuery("prompt_main_menu", async (ctx) => {
  await ctx.answerCallbackQuery();
  await ctx.reply(
    `💡 *Choose a topic prompt below or type your custom question:*`,
    { reply_markup: getQuickPromptsKeyboard() }
  );
});

// ---------------------------------------------------------
// CBT PRACTICE & STATS HANDLERS
// ---------------------------------------------------------

computingBot.hears(["🎭 Practice CBT", "📝 Exam Mode", "🔄 Revision", "prompt_cbt"], async (ctx) => {
  try {
    const count = await prisma.question.count();
    if (count === 0) {
      return ctx.reply(
        `📚 *CBT Question Bank Update*\n\n` +
          `The official CBT Question Bank for 100L General & Departmental courses (GST101, MAT111, CSC101, etc.) is currently being uploaded by your department.\n\n` +
          `💡 In the meantime, tap a quick prompt or ask me any question directly!`,
        { parse_mode: "Markdown", reply_markup: getQuickPromptsKeyboard() }
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

computingBot.hears(["💡 Quick Prompts", "/prompts"], async (ctx) => {
  await ctx.reply(
    `💡 *Explore Freshers Guide Prompts:*\nTap any topic below to view instant information:`,
    { parse_mode: "Markdown", reply_markup: getQuickPromptsKeyboard() }
  );
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

    if (["🎭 Practice CBT", "📝 Exam Mode", "🔄 Revision", "📊 My Stats", "🏆 Leaderboard", "💡 Quick Prompts", "💬 Ask AI Mentor"].includes(message)) {
      if (message === "💬 Ask AI Mentor") {
        return ctx.reply("What topic or concept would you like to study today? Ask me anything!", { reply_markup: getQuickPromptsKeyboard() });
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
ROLE & PERSONA:
You are the University of Ibadan Computing Freshers Companion — a wise, approachable teacher who is also a warm, encouraging friend.

YOUR IDENTITY:
- You combine the academic wisdom of a University of Ibadan lecturer with the warmth, patience, and accessibility of a trusted mentor.
- You speak with genuine warmth, enthusiasm, and deep empathy for fresher student life at UI.
- You make complex technical concepts (programming, binary logic, calculus) feel easy to understand using clear real-world analogies.
- You understand fresher anxiety (course registration, CGPA calculations, hostel life) and reassure students with calm, practical, and friendly advice.

COMMUNICATION STYLE:
- **Warm & Engaging:** Address the student by name warmly ("Hey ${userWithContext.firstName ?? telegramUser.first_name}!").
- **Teacher-Friend Tone:** Be academically thorough yet supportive, conversational, and uplifting.
- **Step-by-Step Teaching:** Break down difficult concepts progressively using simple analogies.
- **Encouragement:** Remind them that adjusting to 100L takes time, but they have everything it takes to succeed at UI!
- **Interactive Check-ins:** Always conclude responses with a friendly follow-up question ("Does that make sense, or would you like me to give you a quick practical example?").

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

    // Provide response along with follow-up prompt chips so student can tap to continue
    await ctx.reply(aiResponse, { reply_markup: getQuickPromptsKeyboard() });

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