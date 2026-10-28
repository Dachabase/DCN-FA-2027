import { prisma } from "../../database/prisma";
import {
  LEVEL_TIERS,
  HUNTER_RANKS,
  XP_PER_ANSWER,
  XP_DAILY_QUEST_BONUS,
  LevelInfo,
} from "./gamification.types";

const LEVEL_ARRAY = [0, 200, 500, 900, 1400, 2000, 2700, 3500, 4400, 5400, 6500, 8000, 10000];

/**
 * Calculates XP required to enter a given level using the reverse-engineered formula.
 */
export function levelStartXp(level: number): number {
  const t = Math.max(1, Math.floor(level));
  if (t <= LEVEL_ARRAY.length) {
    return LEVEL_ARRAY[t - 1];
  }
  const lastBase = LEVEL_ARRAY[LEVEL_ARRAY.length - 1]; // 10000
  const n = Math.min(t, 45) - LEVEL_ARRAY.length;
  const quadraticXp = lastBase + 2500 * n + (250 * n * (n - 1)) / 2;
  if (t <= 45) {
    return Math.round(quadraticXp);
  }
  const beyondLinear = (t - 45) * (2500 + 250 * (45 - LEVEL_ARRAY.length));
  return Math.round(quadraticXp + beyondLinear);
}

/**
 * Calculates current level and progression info for a given cumulative XP.
 */
export function calculateLevelFromXp(totalXp: number): LevelInfo {
  let level = 1;
  while (totalXp >= levelStartXp(level + 1)) {
    level++;
    if (level > 200) break; // sanity bound
  }

  const currentLevelXp = levelStartXp(level);
  const nextLevelXp = levelStartXp(level + 1);
  const progressInLevel = Math.max(0, totalXp - currentLevelXp);
  const span = Math.max(1, nextLevelXp - currentLevelXp);
  const progressPct = Math.min(100, Math.round((progressInLevel / span) * 100));

  const tier = LEVEL_TIERS.find(t => level >= t.from && (t.to === null || level <= t.to)) || LEVEL_TIERS[0];
  const rank = [...HUNTER_RANKS].reverse().find(r => level >= r.from) || HUNTER_RANKS[0];

  return {
    level,
    xpRequired: currentLevelXp,
    nextLevelXp,
    progressPct,
    academicTier: tier.name,
    hunterRank: rank.rank,
  };
}

/**
 * Ensures a student has their UserGamification profile properly initialized.
 */
export async function getOrCreateGamificationProfile(userId: string) {
  let profile = await prisma.userGamification.findUnique({
    where: { userId },
  });

  if (!profile) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    const alias = user?.fullName
      ? `${user.fullName.split(" ")[0]}Scholar #${Math.floor(10 + Math.random() * 90)}`
      : `UIScholar #${Math.floor(100 + Math.random() * 900)}`;

    profile = await prisma.userGamification.create({
      data: {
        userId,
        totalXp: user?.totalPoints || 0,
        currentLevel: 1,
        academicTier: "Freshite",
        hunterRank: "E",
        currentStreak: user?.streakCount || 0,
        longestStreak: user?.streakCount || 0,
        aliasName: alias,
        showRealName: true,
        dailyAnswerGoal: 20,
      },
    });
  }

  return profile;
}

/**
 * Get or initialize today's Daily Quest for a user.
 */
export async function getOrCreateTodayQuest(userId: string, targetAnswers = 20) {
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);

  let quest = await prisma.userDailyQuest.findUnique({
    where: {
      userId_targetDate: {
        userId,
        targetDate: today,
      },
    },
  });

  if (!quest) {
    quest = await prisma.userDailyQuest.create({
      data: {
        userId,
        targetDate: today,
        targetAnswers,
        completedAnswers: 0,
        xpEarned: 0,
        grade: "E",
        isCompleted: false,
      },
    });
  }

  return quest;
}

/**
 * Awards XP for an answered question and increments quest + level status.
 */
export async function awardAnswerXp(userId: string, xpAmount = XP_PER_ANSWER) {
  const profile = await getOrCreateGamificationProfile(userId);
  const quest = await getOrCreateTodayQuest(userId, profile.dailyAnswerGoal);

  const newTotalXp = profile.totalXp + xpAmount;
  const levelInfo = calculateLevelFromXp(newTotalXp);

  // Update Daily Quest
  const newCompleted = quest.completedAnswers + 1;
  const isNowCompleted = newCompleted >= quest.targetAnswers;
  const questXpEarned = quest.xpEarned + xpAmount + (isNowCompleted && !quest.isCompleted ? XP_DAILY_QUEST_BONUS : 0);

  // Compute Grade based on completed count vs target
  let grade = "E";
  const ratio = newCompleted / Math.max(1, quest.targetAnswers);
  if (ratio >= 2.0) grade = "M";
  else if (ratio >= 1.5) grade = "S";
  else if (ratio >= 1.2) grade = "A";
  else if (ratio >= 1.0) grade = "B";
  else if (ratio >= 0.7) grade = "C";
  else if (ratio >= 0.4) grade = "D";

  // Check and maintain streaks
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  let newCurrentStreak = profile.currentStreak;
  const lastActive = profile.lastActiveDate ? new Date(profile.lastActiveDate) : null;

  if (!lastActive) {
    newCurrentStreak = 1;
  } else {
    lastActive.setUTCHours(0, 0, 0, 0);
    const dayDiff = Math.round((today.getTime() - lastActive.getTime()) / (1000 * 60 * 60 * 24));
    if (dayDiff === 1) {
      newCurrentStreak += 1;
    } else if (dayDiff > 1) {
      newCurrentStreak = 1; // streak reset
    }
  }

  const newLongestStreak = Math.max(newCurrentStreak, profile.longestStreak);

  // Atomic database updates
  const [updatedProfile, updatedQuest] = await prisma.$transaction([
    prisma.userGamification.update({
      where: { userId },
      data: {
        totalXp: newTotalXp + (isNowCompleted && !quest.isCompleted ? XP_DAILY_QUEST_BONUS : 0),
        currentLevel: levelInfo.level,
        academicTier: levelInfo.academicTier,
        hunterRank: levelInfo.hunterRank,
        currentStreak: newCurrentStreak,
        longestStreak: newLongestStreak,
        lastActiveDate: today,
      },
    }),
    prisma.userDailyQuest.update({
      where: { id: quest.id },
      data: {
        completedAnswers: newCompleted,
        xpEarned: questXpEarned,
        grade,
        isCompleted: isNowCompleted || quest.isCompleted,
      },
    }),
  ]);

  return {
    profile: updatedProfile,
    quest: updatedQuest,
    levelInfo,
    xpAwarded: xpAmount + (isNowCompleted && !quest.isCompleted ? XP_DAILY_QUEST_BONUS : 0),
    justCompletedQuest: isNowCompleted && !quest.isCompleted,
  };
}

