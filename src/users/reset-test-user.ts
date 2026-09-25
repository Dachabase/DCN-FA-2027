import { prisma } from "../database/prisma";

async function main() {
  const user = await prisma.user.update({
    where: {
      id: "cmsyiptpd0000lswo9zl9ei5o",
    },
    data: {
      facultyId: null,
      departmentId: null,
      level: null,
      onboardingStep: null,
    },
  });

  console.log("Test user reset successfully:");

  console.log({
    id: user.id,
    facultyId: user.facultyId,
    departmentId: user.departmentId,
    level: user.level,
    onboardingStep: user.onboardingStep,
  });
}

main()
  .catch((error) => {
    console.error("Failed to reset test user:");
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
