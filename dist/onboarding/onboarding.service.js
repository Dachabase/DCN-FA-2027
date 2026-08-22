"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.setOnboardingStep = setOnboardingStep;
exports.getOnboardingStep = getOnboardingStep;
const prisma_1 = require("../database/prisma");
async function setOnboardingStep(userId, step) {
    return prisma_1.prisma.user.update({
        where: {
            id: userId,
        },
        data: {
            onboardingStep: step,
        },
    });
}
async function getOnboardingStep(userId) {
    const user = await prisma_1.prisma.user.findUnique({
        where: {
            id: userId,
        },
        select: {
            onboardingStep: true,
        },
    });
    if (!user?.onboardingStep) {
        return null;
    }
    return user.onboardingStep;
}
