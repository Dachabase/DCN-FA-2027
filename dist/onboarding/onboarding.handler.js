"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleOnboardingMessage = handleOnboardingMessage;
const prisma_1 = require("../database/prisma");
const onboarding_service_1 = require("./onboarding.service");
const department_resolver_1 = require("./department.resolver");
const level_resolver_1 = require("./level.resolver");
async function handleOnboardingMessage(ctx) {
    // =======================================================
    // Make sure this is a text message
    // =======================================================
    if (!ctx.from ||
        !ctx.message ||
        !("text" in ctx.message) ||
        typeof ctx.message.text !== "string") {
        return false;
    }
    const message = ctx.message.text.trim();
    if (!message) {
        return false;
    }
    // =======================================================
    // Find user
    // =======================================================
    const user = await prisma_1.prisma.user.findUnique({
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
    const onboardingStep = await (0, onboarding_service_1.getOnboardingStep)(user.id);
    // User is not currently onboarding
    if (!onboardingStep ||
        onboardingStep === "COMPLETE") {
        return false;
    }
    // =======================================================
    // DEPARTMENT
    // =======================================================
    if (onboardingStep === "DEPARTMENT") {
        if (!user.facultyId) {
            await ctx.reply("I couldn't determine your faculty yet. Please send /start again.");
            return true;
        }
        const department = await (0, department_resolver_1.resolveDepartment)(user.facultyId, message);
        if (!department) {
            await ctx.reply("I couldn't quite identify that department.\n\n" +
                "Please tell me the name of your department. For example:\n\n" +
                "Software Engineering\n" +
                "Cybersecurity\n" +
                "Information Technology\n" +
                "Computer Science and AI");
            return true;
        }
        // =====================================================
        // Save department
        // =====================================================
        await prisma_1.prisma.user.update({
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
        await (0, onboarding_service_1.setOnboardingStep)(user.id, "LEVEL");
        await ctx.reply(`Nice! ${department.name}. 🎓\n\n` +
            `What level are you entering?\n\n` +
            `You can simply tell me something like "100" or "100 level".`);
        return true;
    }
    // =======================================================
    // LEVEL
    // =======================================================
    if (onboardingStep === "LEVEL") {
        const level = (0, level_resolver_1.resolveLevel)(message);
        if (!level) {
            await ctx.reply("I couldn't determine your level from that.\n\n" +
                "Please tell me your level, for example:\n\n" +
                "100\n" +
                "200 level\n" +
                "I'm entering 100 level");
            return true;
        }
        // =====================================================
        // Save level and complete onboarding
        // =====================================================
        await prisma_1.prisma.user.update({
            where: {
                id: user.id,
            },
            data: {
                level,
                onboardingStep: "COMPLETE",
            },
        });
        const firstName = user.firstName ||
            ctx.from.first_name ||
            "there";
        const updatedUser = await prisma_1.prisma.user.findUnique({
            where: {
                id: user.id,
            },
            include: {
                department: true,
            },
        });
        const departmentName = updatedUser?.department?.name ??
            "your department";
        await ctx.reply(`Perfect, ${firstName}!\n\n` +
            `You're all set.\n\n` +
            `I now know that you're entering ${level} level in ${departmentName}.\n\n` +
            `From here on, you can just talk to me normally. Ask me questions, tell me what you're struggling with, or ask me about life as a UI student.\n\n` +
            `I'm here to help.`);
        return true;
    }
    return false;
}
