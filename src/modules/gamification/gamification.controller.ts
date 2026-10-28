import { Router, Response } from "express";
import { AuthenticatedRequest, requireAuth, optionalAuth } from "../../auth/auth.middleware";
import { prisma } from "../../database/prisma";
import {
  getOrCreateGamificationProfile,
  getOrCreateTodayQuest,
  calculateLevelFromXp,
} from "./gamification.service";

export const gamificationRouter = Router();

// GET /api/gamification/me - Returns student's gamification overview
gamificationRouter.get("/me", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const profile = await getOrCreateGamificationProfile(userId);
    const quest = await getOrCreateTodayQuest(userId, profile.dailyAnswerGoal);
    const levelInfo = calculateLevelFromXp(profile.totalXp);

    res.json({
      success: true,
      data: {
        profile,
        quest,
        levelInfo,
      },
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// GET /api/gamification/quest/today
gamificationRouter.get("/quest/today", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const profile = await getOrCreateGamificationProfile(userId);
    const quest = await getOrCreateTodayQuest(userId, profile.dailyAnswerGoal);

    res.json({
      success: true,
      data: {
        quest,
        targetAnswers: quest.targetAnswers,
        completedAnswers: quest.completedAnswers,
        grade: quest.grade,
        isCompleted: quest.isCompleted,
        streak: profile.currentStreak,
      },
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// PATCH /api/gamification/settings - Update student alias, real-name toggle, and daily goal
gamificationRouter.patch("/settings", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const { aliasName, showRealName, dailyAnswerGoal } = req.body;

    const updateData: any = {};
    if (typeof aliasName === "string" && aliasName.trim().length > 0) {
      updateData.aliasName = aliasName.trim().slice(0, 30);
    }
    if (typeof showRealName === "boolean") {
      updateData.showRealName = showRealName;
    }
    if (typeof dailyAnswerGoal === "number" && dailyAnswerGoal >= 10 && dailyAnswerGoal <= 300) {
      updateData.dailyAnswerGoal = Math.round(dailyAnswerGoal);
    }

    const updated = await prisma.userGamification.update({
      where: { userId },
      data: updateData,
    });

    res.json({ success: true, data: updated });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// GET /api/gamification/leaderboard - Real-time leaderboard by scope and period
gamificationRouter.get("/leaderboard", optionalAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const period = (req.query.period as string) || "TODAY"; // TODAY, WEEK, ALL_TIME
    const scope = (req.query.scope as string) || "GLOBAL"; // GLOBAL, FACULTY, DEPARTMENT
    const facultyId = req.query.facultyId as string;
    const departmentId = req.query.departmentId as string;

    const currentUserId = req.user?.id;

    // Filters for User scope
    const userWhere: any = {};
    if (scope === "FACULTY" && facultyId) {
      userWhere.facultyId = facultyId;
    } else if (scope === "DEPARTMENT" && departmentId) {
      userWhere.departmentId = departmentId;
    }

    let rankings: any[] = [];

    if (period === "TODAY") {
      const today = new Date();
      today.setUTCHours(0, 0, 0, 0);

      const quests = await prisma.userDailyQuest.findMany({
        where: {
          targetDate: today,
          completedAnswers: { gt: 0 },
          user: userWhere,
        },
        orderBy: [{ xpEarned: "desc" }, { completedAnswers: "desc" }],
        take: 50,
        include: {
          user: {
            select: {
              id: true,
              fullName: true,
              gamification: true,
            },
          },
        },
      });

      rankings = quests.map((q, idx) => {
        const g = q.user.gamification;
        const name = g?.showRealName && q.user.fullName ? q.user.fullName : g?.aliasName || "UI Scholar";
        return {
          rank: idx + 1,
          userId: q.user.id,
          displayName: name,
          xp: q.xpEarned,
          netMarks: q.completedAnswers,
          hunterRank: g?.hunterRank || "E",
          academicTier: g?.academicTier || "Freshite",
          isCurrentUser: currentUserId === q.user.id,
        };
      });
    } else {
      // WEEKLY or ALL_TIME based on cumulative XP
      const profiles = await prisma.userGamification.findMany({
        where: {
          totalXp: { gt: 0 },
          user: userWhere,
        },
        orderBy: [{ totalXp: "desc" }, { currentStreak: "desc" }],
        take: 50,
        include: {
          user: {
            select: {
              id: true,
              fullName: true,
            },
          },
        },
      });

      rankings = profiles.map((p, idx) => {
        const name = p.showRealName && p.user.fullName ? p.user.fullName : p.aliasName || "UI Scholar";
        return {
          rank: idx + 1,
          userId: p.user.id,
          displayName: name,
          xp: p.totalXp,
          netMarks: Math.floor(p.totalXp / 10),
          hunterRank: p.hunterRank,
          academicTier: p.academicTier,
          currentStreak: p.currentStreak,
          isCurrentUser: currentUserId === p.user.id,
        };
      });
    }

    res.json({
      success: true,
      data: {
        period,
        scope,
        rankings,
      },
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});
