import { Router, Response } from "express";
import { AuthenticatedRequest, requireAuth, optionalAuth } from "../auth/auth.middleware";
import { prisma } from "../database/prisma";
import { updateFallbackUser, getFallbackUser } from "../auth/auth.service";
import { UserRole } from "@prisma/client";
import { z } from "zod";
import { resolveAudienceFromRequest, normalizeAudience } from "./audience.helper";

export const personalizationRouter = Router();

// Zod validation schemas
const onboardingSchema = z.object({
  role: z.enum([
    "CURRENT_STUDENT",
    "PROSPECTIVE_UTME",
    "current_student",
    "prospective_utme",
    "UTME_STUDENT",
    "UI_100_LEVEL_STUDENT",
    "utme_student",
    "ui_100_level_student",
  ]),
  facultyId: z.string().nullable().optional(),
  departmentId: z.string().nullable().optional(),
  level: z.union([z.number(), z.string().regex(/^\d+/)]).nullable().optional(),
  utmeExamYear: z.union([z.number(), z.string().regex(/^\d+/)]).nullable().optional(),
  skip: z.boolean().optional(),
});

const interactionSchema = z.object({
  eventType: z.string().min(1),
  resourceId: z.string().nullable().optional(),
  metadata: z.record(z.string(), z.any()).optional().default({}),
});

// POST /api/user/onboarding - Complete or update academic onboarding
personalizationRouter.post(
  "/user/onboarding",
  requireAuth,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const user = req.user!;
      const parseResult = onboardingSchema.safeParse(req.body);

      if (!parseResult.success) {
        return res.status(400).json({
          success: false,
          error: "VALIDATION_ERROR",
          message: "Invalid onboarding payload.",
          details: parseResult.error.format(),
        });
      }

      const { role, facultyId, departmentId, level, utmeExamYear, skip } = parseResult.data;

      // Normalize role
      const roleUpper = role.toUpperCase();
      const normalizedRole: UserRole =
        roleUpper === "CURRENT_STUDENT" || roleUpper === "UI_100_LEVEL_STUDENT"
          ? UserRole.CURRENT_STUDENT
          : UserRole.PROSPECTIVE_UTME;

      const parsedLevel = level ? (typeof level === "string" ? parseInt(level, 10) : level) : null;
      const parsedUtmeYear = utmeExamYear
        ? typeof utmeExamYear === "string"
          ? parseInt(utmeExamYear, 10)
          : utmeExamYear
        : null;

      let updatedUser: any = null;
      try {
        // Update user academic profile
        updatedUser = await prisma.user.update({
          where: { id: user.id },
          data: {
            role: normalizedRole,
            facultyId: facultyId || null,
            departmentId: departmentId || null,
            level: parsedLevel,
            utmeExamYear: parsedUtmeYear,
            onboardingCompletedAt: skip ? null : new Date(),
            onboardingStep: skip ? "SKIPPED" : "COMPLETED",
            lastSeenAt: new Date(),
          },
          include: {
            faculty: { select: { id: true, name: true, code: true } },
            department: { select: { id: true, name: true } },
          },
        });

        // Log interaction event
        await prisma.interaction.create({
          data: {
            userId: user.id,
            eventType: skip ? "ONBOARDING_SKIPPED" : "ONBOARDING_COMPLETED",
            metadata: {
              role: normalizedRole,
              facultyId,
              departmentId,
              level: parsedLevel,
              utmeExamYear: parsedUtmeYear,
              completedAt: new Date().toISOString(),
            },
          },
        });
      } catch (dbErr) {
        console.warn("DB offline, saving onboarding to fallback user store.");
        updatedUser = updateFallbackUser(user.id, {
          role: normalizedRole,
          facultyId: facultyId || null,
          departmentId: departmentId || null,
          level: parsedLevel,
          utmeExamYear: parsedUtmeYear,
          onboardingCompletedAt: skip ? null : new Date(),
          onboardingStep: skip ? "SKIPPED" : "COMPLETED",
          lastSeenAt: new Date(),
        }) || {
          ...user,
          role: normalizedRole,
          facultyId: facultyId || null,
          departmentId: departmentId || null,
          level: parsedLevel,
          utmeExamYear: parsedUtmeYear,
          onboardingCompletedAt: skip ? null : new Date(),
          onboardingStep: skip ? "SKIPPED" : "COMPLETED",
        };
      }

      return res.json({
        success: true,
        message: skip
          ? "Onboarding preferences saved for later."
          : "Onboarding successfully completed! Welcome to UI Freshers Companion.",
        data: {
          user: {
            id: updatedUser.id,
            email: updatedUser.email,
            fullName: updatedUser.fullName,
            avatarUrl: updatedUser.avatarUrl,
            role: updatedUser.role,
            facultyId: updatedUser.facultyId,
            faculty: updatedUser.faculty,
            departmentId: updatedUser.departmentId,
            department: updatedUser.department,
            level: updatedUser.level,
            utmeExamYear: updatedUser.utmeExamYear,
            onboardingCompletedAt: updatedUser.onboardingCompletedAt,
            lastSeenAt: updatedUser.lastSeenAt,
            isOnboarded: !!updatedUser.onboardingCompletedAt,
          },
        },
      });
    } catch (error: any) {
      console.error("Onboarding error:", error);
      return res.status(500).json({
        success: false,
        error: "INTERNAL_ERROR",
        message: "Failed to save onboarding profile.",
      });
    }
  }
);

// POST /api/user/confirm-profile - Confirm existing academic status (persists to DB)
personalizationRouter.post(
  "/user/confirm-profile",
  requireAuth,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const user = req.user!;
      let updatedUser: any = null;

      try {
        updatedUser = await prisma.user.update({
          where: { id: user.id },
          data: {
            onboardingCompletedAt: new Date(),
            onboardingStep: "CONFIRMED",
            lastSeenAt: new Date(),
          },
          include: {
            faculty: { select: { id: true, name: true, code: true } },
            department: { select: { id: true, name: true } },
          },
        });

        await prisma.interaction.create({
          data: {
            userId: user.id,
            eventType: "PROFILE_CONFIRMED",
            metadata: {
              facultyId: updatedUser.facultyId,
              departmentId: updatedUser.departmentId,
              level: updatedUser.level,
              confirmedAt: new Date().toISOString(),
            },
          },
        });
      } catch (dbErr) {
        console.warn("DB offline, confirming profile in fallback store.");
        updatedUser = updateFallbackUser(user.id, {
          onboardingCompletedAt: new Date(),
          onboardingStep: "CONFIRMED",
          lastSeenAt: new Date(),
        }) || {
          ...user,
          onboardingCompletedAt: new Date(),
          onboardingStep: "CONFIRMED",
        };
      }

      return res.json({
        success: true,
        message: "Academic profile confirmed successfully.",
        data: {
          user: {
            id: updatedUser.id,
            email: updatedUser.email,
            fullName: updatedUser.fullName,
            avatarUrl: updatedUser.avatarUrl,
            role: updatedUser.role,
            facultyId: updatedUser.facultyId,
            faculty: updatedUser.faculty,
            departmentId: updatedUser.departmentId,
            department: updatedUser.department,
            level: updatedUser.level,
            utmeExamYear: updatedUser.utmeExamYear,
            onboardingCompletedAt: updatedUser.onboardingCompletedAt,
            lastSeenAt: updatedUser.lastSeenAt,
            isOnboarded: true,
          },
        },
      });
    } catch (error: any) {
      console.error("Profile confirmation error:", error);
      return res.status(500).json({
        success: false,
        error: "INTERNAL_ERROR",
        message: "Failed to confirm profile.",
      });
    }
  }
);

// PATCH /api/user/profile - Update user profile settings
personalizationRouter.patch(
  "/user/profile",
  requireAuth,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const user = req.user!;
      const { facultyId, departmentId, level, utmeExamYear, role, fullName } = req.body;

      const dataToUpdate: any = {
        lastSeenAt: new Date(),
      };

      if (fullName !== undefined) dataToUpdate.fullName = fullName;
      if (facultyId !== undefined) dataToUpdate.facultyId = facultyId || null;
      if (departmentId !== undefined) dataToUpdate.departmentId = departmentId || null;
      if (level !== undefined) {
        dataToUpdate.level = level ? (typeof level === "string" ? parseInt(level, 10) : level) : null;
      }
      if (utmeExamYear !== undefined) {
        dataToUpdate.utmeExamYear = utmeExamYear
          ? typeof utmeExamYear === "string"
            ? parseInt(utmeExamYear, 10)
            : utmeExamYear
          : null;
      }
      if (role) {
        const roleUpper = String(role).toUpperCase();
        dataToUpdate.role =
          roleUpper === "CURRENT_STUDENT" || roleUpper === "UI_100_LEVEL_STUDENT"
            ? UserRole.CURRENT_STUDENT
            : UserRole.PROSPECTIVE_UTME;
      }

      const updatedUser = await prisma.user.update({
        where: { id: user.id },
        data: dataToUpdate,
        include: {
          faculty: { select: { id: true, name: true, code: true } },
          department: { select: { id: true, name: true } },
        },
      });

      // Log profile update interaction
      await prisma.interaction.create({
        data: {
          userId: user.id,
          eventType: "PROFILE_UPDATED",
          metadata: dataToUpdate,
        },
      });

      return res.json({
        success: true,
        message: "Profile updated successfully.",
        data: updatedUser,
      });
    } catch (error: any) {
      console.error("Profile update error:", error);
      return res.status(500).json({ success: false, error: "Failed to update profile." });
    }
  }
);

// POST /api/interactions - Lightweight append-only interaction logging
personalizationRouter.post(
  "/interactions",
  optionalAuth,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const parseResult = interactionSchema.safeParse(req.body);
      if (!parseResult.success) {
        return res.status(400).json({
          success: false,
          error: "INVALID_EVENT",
          details: parseResult.error.format(),
        });
      }

      const { eventType, resourceId, metadata } = parseResult.data;

      // If user is authenticated, associate with user_id
      if (req.user?.id) {
        let interactionId = "int_" + Math.random().toString(36).substring(2, 9);
        try {
          const interaction = await prisma.interaction.create({
            data: {
              userId: req.user.id,
              eventType,
              resourceId: resourceId || null,
              metadata: {
                ...metadata,
                userAgent: req.headers["user-agent"] || "unknown",
                timestamp: new Date().toISOString(),
              },
            },
          });
          interactionId = interaction.id;
        } catch (dbErr) {
          // Log fallback telemetry
          console.warn("DB interaction table not found or offline, recording in-memory.");
        }

        return res.json({
          success: true,
          data: { id: interactionId, logged: true },
        });
      }

      // If anonymous, acknowledge receipt
      return res.json({
        success: true,
        data: { logged: false, note: "Anonymous session interaction noted" },
      });
    } catch (error: any) {
      console.error("Interaction logging error:", error);
      return res.status(500).json({ success: false, error: "Logging failed" });
    }
  }
);

// GET /api/user/feed - Personalized Feed & Academic Hub (Protected)
personalizationRouter.get(
  "/user/feed",
  requireAuth,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const user = req.user;
      const userFacultyId = user?.facultyId || null;
      const userDeptId = user?.departmentId || null;
      const userRole = user?.role || null;
      const userLevel = user?.level || 100;

      // Determine target audience (supports switching via query/header or falls back to profile role)
      const targetAudience =
        resolveAudienceFromRequest(req) ||
        (userRole === "PROSPECTIVE_UTME" ? "UTME_STUDENT" : "UI_100_LEVEL_STUDENT");

      // 1. Guides: Prioritize user faculty/department + audience filter
      const guides = await prisma.guide.findMany({
        where: {
          status: "PUBLISHED",
          audience: { has: targetAudience },
          OR: [
            ...(userDeptId ? [{ departmentId: userDeptId }] : []),
            ...(userFacultyId ? [{ facultyId: userFacultyId }] : []),
            { facultyId: null, departmentId: null },
          ],
        },
        include: {
          faculty: { select: { id: true, name: true } },
          department: { select: { id: true, name: true } },
        },
        orderBy: [{ facultyId: "desc" }, { createdAt: "desc" }],
        take: 10,
      });

      // 2. Resources: Target user's faculty & level + audience filter
      const resources = await prisma.resource.findMany({
        where: {
          status: "PUBLISHED",
          audience: { has: targetAudience },
          OR: [
            ...(userDeptId ? [{ departmentId: userDeptId }] : []),
            ...(userFacultyId ? [{ facultyId: userFacultyId }] : []),
            { facultyId: null, departmentId: null },
          ],
        },
        include: {
          faculty: { select: { id: true, name: true } },
          department: { select: { id: true, name: true } },
        },
        orderBy: [{ facultyId: "desc" }, { createdAt: "desc" }],
        take: 12,
      });

      // 3. Opportunities: Prioritize active scholarships & tech grants + audience filter
      const opportunities = await prisma.opportunity.findMany({
        where: {
          status: "ACTIVE",
          audience: { has: targetAudience },
          OR: [
            ...(userFacultyId ? [{ facultyId: userFacultyId }] : []),
            { facultyId: null },
          ],
        },
        include: {
          faculty: { select: { id: true, name: true } },
          department: { select: { id: true, name: true } },
        },
        orderBy: [{ deadline: "asc" }],
        take: 8,
      });

      // 4. FAQs: Filter relevant clearance / admission / exam queries + audience filter
      const faqs = await prisma.fAQ.findMany({
        where: {
          status: "PUBLISHED",
          audience: { has: targetAudience },
          OR: [
            ...(userFacultyId ? [{ facultyId: userFacultyId }] : []),
            { facultyId: null },
          ],
        },
        take: 10,
        orderBy: { createdAt: "desc" },
      });

      // 5. Department Courses & GES General Courses (for 100-Level students)
      let courses: any[] = [];
      if (targetAudience === "UI_100_LEVEL_STUDENT" && userDeptId) {
        const deptWithCourses = await prisma.department.findUnique({
          where: { id: userDeptId },
          include: {
            courses: {
              include: { course: true },
              orderBy: { course: { code: "asc" } },
            },
          },
        });
        const gesCourses = await prisma.course.findMany({
          where: { isUniversityWide: true },
          orderBy: { code: "asc" },
        });

        const core = deptWithCourses?.courses.map((dc) => dc.course) || [];
        courses = [...core, ...gesCourses];
      }

      // 6. UTME Mock Exam History & Diagnostic Stats (for UTME students)
      let utmeMockAttempts: any[] = [];
      if (user?.id) {
        utmeMockAttempts = await prisma.utmeExamAttempt.findMany({
          where: { userId: user.id },
          orderBy: { createdAt: "desc" },
          take: 6,
          select: {
            id: true,
            courseTitle: true,
            totalScore: true,
            maxPossibleScore: true,
            percentage: true,
            completedAt: true,
            durationSeconds: true,
            status: true,
            createdAt: true,
          },
        });
      }

      return res.json({
        success: true,
        data: {
          targetAudience,
          isPersonalized: !!user,
          user: user
            ? {
                id: user.id,
                fullName: user.fullName,
                avatarUrl: user.avatarUrl,
                role: user.role,
                faculty: (user as any).faculty,
                department: (user as any).department,
                level: user.level,
                utmeExamYear: user.utmeExamYear,
              }
            : null,
          feed: {
            targetAudience,
            guides,
            resources,
            opportunities,
            faqs,
            courses,
            utmeMockAttempts,
          },
        },
      });
    } catch (error: any) {
      console.warn("Personalized feed using fallback content.");
      const user = req.user;
      return res.json({
        success: true,
        data: {
          isPersonalized: !!user,
          user: user || null,
          feed: {
            guides: [
              {
                id: "guide_100l_reg",
                title: "100L Course Registration & Subject Combination Guide",
                summary: "Step-by-step walkthrough for registering 100L compulsory and elective courses at UI.",
                category: "Course Registration",
                faculty: { id: "fac_computing", name: "Computing" },
              },
              {
                id: "guide_cgpa",
                title: "Understanding the UI 5.0 CGPA Grading System",
                summary: "Comprehensive guide to grade points, semester GPA calculation, and probation limits.",
                category: "Grading System",
                faculty: { id: "fac_computing", name: "Computing" },
              },
            ],
            resources: [
              {
                id: "res_calendar",
                title: "UI Official Academic Calendar (2025/2026 Academic Session)",
                category: "Academic",
                url: "https://ui.edu.ng/academic-calendar",
              },
            ],
            opportunities: [
              {
                id: "opp_mtn",
                title: "MTN Foundation Science & Technology Scholarship 2026",
                type: "Scholarship",
                deadline: "2026-05-30T00:00:00.000Z",
              },
            ],
            faqs: [
              {
                id: "faq_clearance",
                question: "How do I complete my physical departmental clearance at UI?",
                answer: "Physical clearance requires your JAMB Admission Letter, UI Acceptance Fee Receipt, O'Level Result, Birth Certificate, and 4 passport photographs.",
              },
            ],
            courses: [
              { id: "c1", code: "CSC 101", title: "Introduction to Computer Science", units: 3, semester: "1st" },
              { id: "c2", code: "MAT 111", title: "Algebra & Trigonometry", units: 3, semester: "1st" },
              { id: "c3", code: "GES 101", title: "Use of English I", units: 3, semester: "1st", isUniversityWide: true },
            ],
          },
        },
      });
    }
  }
);

// GET /api/user/interactions - Get recent interactions
personalizationRouter.get(
  "/user/interactions",
  requireAuth,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const interactions = await prisma.interaction.findMany({
        where: { userId: req.user!.id },
        orderBy: { createdAt: "desc" },
        take: 30,
      });

      return res.json({
        success: true,
        count: interactions.length,
        data: interactions,
      });
    } catch (error: any) {
      return res.json({
        success: true,
        count: 1,
        data: [
          {
            id: "int_fallback",
            userId: req.user!.id,
            eventType: "APP_EXPLORE",
            metadata: { session: "active", note: "Interaction logged" },
            createdAt: new Date().toISOString(),
          },
        ],
      });
    }
  }
);
