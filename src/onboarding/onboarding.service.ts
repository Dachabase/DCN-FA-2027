import { prisma } from "../database/prisma";
import type { OnboardingStep } from "./onboarding.types";

export async function setOnboardingStep(
  userId: string,
  step: OnboardingStep
) {
  return prisma.user.update({
    where: {
      id: userId,
    },

    data: {
      onboardingStep: step,
    },
  });
}

export async function getOnboardingStep(
  userId: string
): Promise<OnboardingStep | null> {
  const user = await prisma.user.findUnique({
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

  return user.onboardingStep as OnboardingStep;
}