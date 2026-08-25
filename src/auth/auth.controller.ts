import { Router, Request, Response } from "express";
import {
  verifyGoogleTokenOrCode,
  syncGoogleUser,
  generateAccessToken,
  generateRefreshToken,
  updateFallbackUser,
  setAuthCookies,
  clearAuthCookies,
} from "./auth.service";
import { AuthenticatedRequest, requireAuth, optionalAuth } from "./auth.middleware";
import { prisma } from "../database/prisma";

export const authRouter = Router();

// GET /api/auth/config - Public auth client configuration
authRouter.get("/config", (req: Request, res: Response) => {
  res.json({
    success: true,
    data: {
      googleClientId: process.env.GOOGLE_CLIENT_ID || "",
    },
  });
});

// POST /api/auth/google - Authenticate with Google ID Token, Auth Code, or Gmail Address
authRouter.post("/google", async (req: Request, res: Response) => {
  try {
    const { credential, code, email, fullName, avatarUrl } = req.body;

    let googleIdentity;
    if (email) {
      const cleanEmail = String(email).trim().toLowerCase();
      if (!cleanEmail.includes("@")) {
        return res.status(400).json({
          success: false,
          error: "INVALID_EMAIL",
          message: "Please enter a valid Gmail address.",
        });
      }
      const encodedSub = "gmail-" + Buffer.from(cleanEmail).toString("base64").replace(/=/g, "").slice(0, 24);
      const name = fullName || cleanEmail.split("@")[0].replace(/[._]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
      googleIdentity = {
        googleSub: encodedSub,
        email: cleanEmail,
        fullName: name,
        avatarUrl: avatarUrl || `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(name)}&backgroundColor=0a192f&textColor=ffffff`,
      };
    } else {
      const tokenOrCode = credential || code;
      if (!tokenOrCode) {
        return res.status(400).json({
          success: false,
          error: "INVALID_PAYLOAD",
          message: "Gmail address or Google credential is required.",
        });
      }
      googleIdentity = await verifyGoogleTokenOrCode(tokenOrCode);
    }

    const user = await syncGoogleUser(googleIdentity);

    // Generate JWT access and refresh token pair
    const accessToken = generateAccessToken(user);
    const { token: refreshToken, hash: refreshHash } = generateRefreshToken(user);

    // Persist refresh token hash
    try {
      await prisma.user.update({
        where: { id: user.id },
        data: {
          refreshTokenHash: refreshHash,
          lastSeenAt: new Date(),
        },
      });
    } catch (e) {
      updateFallbackUser(user.id, { refreshTokenHash: refreshHash, lastSeenAt: new Date() });
    }

    // Set secure HTTP-only cookies across environments and reverse proxies
    setAuthCookies(req, res, accessToken, refreshToken);

    // Fetch full user with relations
    let fullUser: any = null;
    try {
      fullUser = await prisma.user.findUnique({
        where: { id: user.id },
        include: {
          faculty: { select: { id: true, name: true, code: true } },
          department: { select: { id: true, name: true } },
        },
      });
    } catch (e) {
      fullUser = user;
    }
    if (!fullUser) fullUser = user;

    return res.json({
      success: true,
      data: {
        user: {
          id: fullUser?.id,
          email: fullUser?.email,
          fullName: fullUser?.fullName,
          avatarUrl: fullUser?.avatarUrl,
          role: fullUser?.role,
          facultyId: fullUser?.facultyId,
          faculty: fullUser?.faculty,
          departmentId: fullUser?.departmentId,
          department: fullUser?.department,
          level: fullUser?.level,
          utmeExamYear: fullUser?.utmeExamYear,
          onboardingCompletedAt: fullUser?.onboardingCompletedAt,
          lastSeenAt: fullUser?.lastSeenAt,
          isOnboarded: !!fullUser?.onboardingCompletedAt,
        },
        accessToken,
      },
    });
  } catch (error: any) {
    console.error("Google Auth error:", error);
    return res.status(401).json({
      success: false,
      error: "AUTH_FAILED",
      message: error?.message || "Failed to authenticate with Google.",
    });
  }
});

// POST /api/auth/mock - Demo / Developer quick sign-in for testing
authRouter.post("/mock", async (req: Request, res: Response) => {
  try {
    const { email, fullName, avatarUrl, role, facultyCode } = req.body;
    const testEmail = email || "fresher.demo@ui.edu.ng";
    const testSub = "google-sub-mock-" + Buffer.from(testEmail).toString("base64").substring(0, 16);

    const user = await syncGoogleUser({
      googleSub: testSub,
      email: testEmail,
      fullName: fullName || "Adewale Taiwo",
      avatarUrl: avatarUrl || "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80",
    });

    const accessToken = generateAccessToken(user);
    const { token: refreshToken, hash: refreshHash } = generateRefreshToken(user);

    try {
      await prisma.user.update({
        where: { id: user.id },
        data: {
          refreshTokenHash: refreshHash,
          lastSeenAt: new Date(),
        },
      });
    } catch (e) {
      updateFallbackUser(user.id, { refreshTokenHash: refreshHash, lastSeenAt: new Date() });
    }

    // Set secure HTTP-only cookies
    setAuthCookies(req, res, accessToken, refreshToken);

    let fullUser: any = null;
    try {
      fullUser = await prisma.user.findUnique({
        where: { id: user.id },
        include: {
          faculty: { select: { id: true, name: true, code: true } },
          department: { select: { id: true, name: true } },
        },
      });
    } catch (e) {
      fullUser = user;
    }
    if (!fullUser) fullUser = user;

    return res.json({
      success: true,
      data: {
        user: {
          id: fullUser?.id,
          email: fullUser?.email,
          fullName: fullUser?.fullName,
          avatarUrl: fullUser?.avatarUrl,
          role: fullUser?.role,
          facultyId: fullUser?.facultyId,
          faculty: fullUser?.faculty,
          departmentId: fullUser?.departmentId,
          department: fullUser?.department,
          level: fullUser?.level,
          utmeExamYear: fullUser?.utmeExamYear,
          onboardingCompletedAt: fullUser?.onboardingCompletedAt,
          lastSeenAt: fullUser?.lastSeenAt,
          isOnboarded: !!fullUser?.onboardingCompletedAt,
        },
        accessToken,
      },
    });
  } catch (error: any) {
    console.error("Mock Auth error:", error);
    return res.status(500).json({ success: false, error: "Mock auth failed" });
  }
});

// GET /api/auth/me - Get current user profile
authRouter.get("/me", optionalAuth, async (req: AuthenticatedRequest, res: Response) => {
  const user = req.user;
  if (!user) {
    return res.json({
      success: true,
      authenticated: false,
      data: null,
    });
  }

  // Update last seen
  try {
    await prisma.user.update({
      where: { id: user.id },
      data: { lastSeenAt: new Date() },
    });
  } catch (e) {
    // ignore
  }

  return res.json({
    success: true,
    authenticated: true,
    data: {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      avatarUrl: user.avatarUrl,
      role: user.role,
      facultyId: user.facultyId,
      faculty: (user as any).faculty,
      departmentId: user.departmentId,
      department: (user as any).department,
      level: user.level,
      utmeExamYear: user.utmeExamYear,
      onboardingCompletedAt: user.onboardingCompletedAt,
      lastSeenAt: user.lastSeenAt,
      isOnboarded: !!user.onboardingCompletedAt,
    },
  });
});

// POST /api/auth/logout - Sign out user and invalidate session
authRouter.post("/logout", async (req: AuthenticatedRequest, res: Response) => {
  if (req.user?.id) {
    try {
      await prisma.user.update({
        where: { id: req.user.id },
        data: { refreshTokenHash: null },
      });
    } catch (e) {
      // ignore
    }
  }

  clearAuthCookies(res);

  return res.json({
    success: true,
    message: "Logged out successfully.",
  });
});
