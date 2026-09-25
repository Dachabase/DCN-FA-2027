import type { Context } from "grammy";

import { prisma } from "../database/prisma";

import {
  getOnboardingStep,
  setOnboardingStep,
} from "./onboarding.service";

import { resolveDepartment } from "./department.resolver";

import { resolveLevel } from "./level.resolver";

export async function handleOnboardingMessage(
  ctx: Context,
  candidateFacultyId?: string
): Promise<boolean> {
  // =======================================================
  // Make sure this is a text message
  // =======================================================

  if (
    !ctx.from ||
    !ctx.message ||
    !("text" in ctx.message) ||
    typeof ctx.message.text !== "string"
  ) {
    return false;
  }

  const message = ctx.message.text.trim();

  if (!message) {
    return false;
  }

  // =======================================================
  // Find user
  // =======================================================

  const user = await prisma.user.findUnique({
    where: {
      telegramId: BigInt(ctx.from.id),
    },
  });

  if (!user) {
    return false;
  }

  // =======================================================
  // Get current onboarding state
  // =======================================================

  const onboardingStep =
    await getOnboardingStep(user.id);

  // =======================================================
  // FACULTY CONFIRMATION
  // =======================================================

  if (onboardingStep === "FACULTY_CONFIRMATION") {
    if (!candidateFacultyId) {
      await ctx.reply(
        "I couldn't determine which faculty this bot belongs to. Please try /start again."
      );

      return true;
    }

    const candidateFaculty =
      await prisma.faculty.findUnique({
        where: {
          id: candidateFacultyId,
        },
      });

    if (!candidateFaculty) {
      await ctx.reply(
        "I couldn't determine the faculty for this bot. Please try /start again."
      );

      return true;
    }

    const normalizedMessage =
      message
        .toLowerCase()
        .trim()
        .replace(/[.!?,]+/g, " ")
        .replace(/\s+/g, " ")
        .trim();

    // =====================================================
    // Confirmation detection
    // =====================================================

    const affirmativePatterns = [
      /^yes$/,
      /^yeah$/,
      /^yep$/,
      /^yup$/,
      /^sure$/,
      /^correct$/,
      /^absolutely$/,
      /^definitely$/,
      /^of course$/,
      /^that's me$/,
      /^that is me$/,
      /^yes i am$/,
      /^yes i am a student$/,
      /^yes im$/,
      /^yes im a student$/,
      /^yes im a computing student$/,
      /^yes i am a computing student$/,
      /^i am$/,
      /^i am a student$/,
      /^im a student$/,
      /^im a computing student$/,
      /^i am a computing student$/,
      /^thats correct$/,
      /^that is correct$/,
    ];

    const negativePatterns = [
      /^no$/,
      /^nope$/,
      /^nah$/,
      /^not me$/,
      /^wrong$/,
      /^wrong faculty$/,
      /^im not$/,
      /^i am not$/,
      /^no im not$/,
      /^no i am not$/,
      /^im not a computing student$/,
      /^i am not a computing student$/,
      /^this is the wrong bot$/,
      /^wrong bot$/,
    ];

    const isAffirmative =
      affirmativePatterns.some((pattern) =>
        pattern.test(normalizedMessage)
      ) ||
      (
        (
          normalizedMessage.startsWith("yes ") ||
          normalizedMessage.startsWith("yeah ") ||
          normalizedMessage.startsWith("yep ") ||
          normalizedMessage.startsWith("yup ")
        ) &&
        (
          normalizedMessage.includes("i am") ||
          normalizedMessage.includes("im ") ||
          normalizedMessage.includes("this is me") ||
          normalizedMessage.includes("correct")
        )
      ) ||
      (
        normalizedMessage.includes("computing student") &&
        !normalizedMessage.includes("not")
      );

    const isNegative =
      negativePatterns.some((pattern) =>
        pattern.test(normalizedMessage)
      ) ||
      (
        normalizedMessage.includes("wrong faculty") ||
        normalizedMessage.includes("wrong bot")
      );

    // =====================================================
    // Student confirmed candidate faculty
    // =====================================================

    if (isAffirmative) {
      await prisma.user.update({
        where: {
          id: user.id,
        },

        data: {
          facultyId: candidateFaculty.id,
          departmentId: null,
        },
      });

      await setOnboardingStep(
        user.id,
        "DEPARTMENT"
      );

      await ctx.reply(
        `Perfect! 🎓\n\n` +
          `What department are you entering?\n\n` +
          `Just tell me the name of your department.`
      );

      return true;
    }

    // =====================================================
    // Student rejected candidate faculty
    // =====================================================

    if (isNegative) {
      await setOnboardingStep(
        user.id,
        "COMPLETE"
      );

      await ctx.reply(
        `No problem. 👍\n\n` +
          `This bot is for ${candidateFaculty.name} students.\n\n` +
          `If you opened the wrong faculty bot, just use the Freshers Companion for your actual faculty.`
      );

      return true;
    }

    // =====================================================
    // Unclear response
    //
    // Do NOT repeat the long confirmation question.
    // Give the student a clear next action.
    // =====================================================

    await ctx.reply(
      `Just let me know if ${candidateFaculty.name} is your faculty. 👍\n\n` +
        `Say **yes** to continue, or **no** if you opened the wrong faculty bot.`
    );

    return true;
  }

  // =======================================================
  // User is not currently onboarding
  // =======================================================

  if (
    !onboardingStep ||
    onboardingStep === "COMPLETE"
  ) {
    return false;
  }

  // =======================================================
  // DEPARTMENT
  // =======================================================

  if (onboardingStep === "DEPARTMENT") {
    if (!user.facultyId) {
      await ctx.reply(
        "I couldn't determine your faculty yet. Please send /start again."
      );

      return true;
    }

    const department =
      await resolveDepartment(
        user.facultyId,
        message
      );

    if (!department) {
      await ctx.reply(
        "I couldn't quite identify that department.\n\n" +
          "Please tell me the name of your department. For example:\n\n" +
          "Software Engineering\n" +
          "Cybersecurity\n" +
          "Information Technology\n" +
          "Computer Science and AI"
      );

      return true;
    }

    // =====================================================
    // Save department
    // =====================================================

    await prisma.user.update({
      where: {
        id: user.id,
      },

      data: {
        departmentId: department.id,
      },
    });

    // =====================================================
    // Move to LEVEL
    // =====================================================

    await setOnboardingStep(
      user.id,
      "LEVEL"
    );

    await ctx.reply(
      `Nice! ${department.name}. 🎓\n\n` +
        `What level are you entering?\n\n` +
        `You can simply tell me something like "100" or "100 level".`
    );

    return true;
  }

  // =======================================================
  // LEVEL
  // =======================================================

  if (onboardingStep === "LEVEL") {
    const level = resolveLevel(message);

    if (!level) {
      await ctx.reply(
        "I couldn't determine your level from that.\n\n" +
          "Please tell me your level, for example:\n\n" +
          "100\n" +
          "200 level\n" +
          "I'm entering 100 level"
      );

      return true;
    }

    // =====================================================
    // Save level and complete onboarding
    // =====================================================

    await prisma.user.update({
      where: {
        id: user.id,
      },

      data: {
        level,
        onboardingStep: "COMPLETE",
      },
    });

    const firstName =
      user.firstName ||
      ctx.from.first_name ||
      "there";

    const updatedUser =
      await prisma.user.findUnique({
        where: {
          id: user.id,
        },

        include: {
          department: true,
          faculty: true,
        },
      });

    const departmentName =
      updatedUser?.department?.name ??
      "your department";

    const facultyName =
      updatedUser?.faculty?.name ??
      "your faculty";

    await ctx.reply(
      `Perfect, ${firstName}! 🎓\n\n` +
        `You're all set.\n\n` +
        `I now know that you're entering ${level} level in ${departmentName}, ${facultyName}.\n\n` +
        `From here on, you can just talk to me normally. Ask me questions, tell me what you're struggling with, or ask me about life as a UI student.\n\n` +
        `I'm here to help.`
    );

    return true;
  }

  return false;
}