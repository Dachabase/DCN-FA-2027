import { Router, Request, Response } from "express";
import {
  verifyGoogleTokenOrCode,
  exchangeGoogleCode,
  syncGoogleUser,
  generateAccessToken,
  generateRefreshToken,
  updateFallbackUser,
  setAuthCookies,
  clearAuthCookies,
} from "./auth.service";
import { AuthenticatedRequest, requireAuth, optionalAuth } from "./auth.middleware";
import { prisma } from "../database/prisma";
import { emailPasswordRouter } from "./emailPassword";
import { getStaffRole } from "./staff";

export const authRouter = Router();
authRouter.use("/email", emailPasswordRouter); // email + password sign-up, login, verification and reset

// GET /api/auth/config - Public auth client configuration
authRouter.get("/config", (req: Request, res: Response) => {
  res.json({
    success: true,
    data: {
      googleClientId: process.env.GOOGLE_CLIENT_ID || "",
    },
  });
});

function getRedirectUri(req: Request): string {
  // In production, prioritize canonical APP_URL if set (e.g. https://blastexams.app)
  const configuredAppUrl = process.env.APP_URL ? process.env.APP_URL.replace(/\/+$/, "") : null;
  const host = req.get("host") || "";
  const isLocal = host.startsWith("localhost") || host.startsWith("127.0.0.1");

  if (!isLocal && configuredAppUrl) {
    return `${configuredAppUrl}/api/auth/callback/google`;
  }

  const forwardedProto = req.headers["x-forwarded-proto"];
  let protocol = "https";
  if (typeof forwardedProto === "string") {
    protocol = forwardedProto.split(",")[0].trim();
  } else if (Array.isArray(forwardedProto) && forwardedProto.length > 0) {
    protocol = String(forwardedProto[0]).split(",")[0].trim();
  } else if (req.protocol) {
    protocol = req.protocol;
  }
  return `${protocol}://${host}/api/auth/callback/google`;
}

// GET /api/auth/google/login - Real Google OAuth 2.0 redirect.
// The old fake "Choose an account" page and POST /google/choose-account were removed: they let
// anyone sign in as any email address without proving they own it.
authRouter.get("/google/login", (req: Request, res: Response) => {
  const googleClientId = process.env.GOOGLE_CLIENT_ID;
  if (!googleClientId || !process.env.GOOGLE_CLIENT_SECRET) {
    return res.redirect("/#/home?auth_error=google_not_configured");
  }
  const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?` + new URLSearchParams({
    client_id: googleClientId,
    redirect_uri: getRedirectUri(req),
    response_type: "code",
    scope: "openid email profile",
    access_type: "offline",
    prompt: "select_account",
  }).toString();
  return res.redirect(authUrl);
});

// GET /api/auth/callback/google - Google redirects back here with an authorization code
authRouter.get("/callback/google", async (req: Request, res: Response) => {
  try {
    const { code, error } = req.query;
    if (error) {
      console.warn("Google OAuth callback returned error:", error);
      return res.redirect(`/#/home?auth_error=${encodeURIComponent(String(error))}`);
    }
    if (!code) {
      return res.redirect("/#/home?auth_error=missing_authorization_code");
    }

    const redirectUri = getRedirectUri(req);

    const googleIdentity = await exchangeGoogleCode(String(code), redirectUri);
    const user = await syncGoogleUser(googleIdentity);

    // Generate JWT access and refresh token pair
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

    setAuthCookies(req, res, accessToken, refreshToken);
    return res.redirect("/#/home");
  } catch (err: any) {
    console.error("Google OAuth callback error:", err);
    return res.redirect(`/#/home?auth_error=${encodeURIComponent(err?.message || "auth_failed")}`);
  }
});

// POST /api/auth/google - Authenticate with Google ID Token or Auth Code from Google Identity Services
authRouter.post("/google", async (req: Request, res: Response) => {
  try {
    const { credential, code } = req.body;
    const tokenOrCode = credential || code;

    if (!tokenOrCode) {
      return res.status(400).json({
        success: false,
        error: "INVALID_CREDENTIAL",
        message: "Google OAuth credential or authorization code is required.",
      });
    }

    const googleIdentity = await verifyGoogleTokenOrCode(tokenOrCode);
    const user = await syncGoogleUser(googleIdentity);

    // Generate JWT access and refresh token pair (7-day access, 30-day refresh)
    const accessToken = generateAccessToken(user);
    const { token: refreshToken, hash: refreshHash } = generateRefreshToken(user);

    // Persist refresh token hash for persistent sessions & silent rotation
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
          googleSub: fullUser?.googleSub,
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
    console.error("Google Auth verification error:", error);
    return res.status(401).json({
      success: false,
      error: "AUTH_FAILED",
      message: error?.message || "Failed to verify Google authentication.",
    });
  }
});

// GET /api/auth/me - Get current user profile
authRouter.get("/me", optionalAuth, async (req: AuthenticatedRequest, res: Response) => {
  const user = req.user;
  // Invalidate any legacy mock or test sessions without verified Google credentials
  if (!user || !user.email || user.email === "student@ui.edu.ng" || (!user.googleSub && !user.email.includes("@"))) {
    res.clearCookie("ui_access_token", { path: "/" });
    res.clearCookie("ui_refresh_token", { path: "/" });
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

  const staffRole = await getStaffRole(user as any);

  return res.json({
    success: true,
    authenticated: true,
    data: {
      id: user.id,
      googleSub: user.googleSub,
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
      emailVerified: !!(user as any).emailVerifiedAt,
      isAdmin: staffRole !== null,
      isOwner: staffRole === "owner",
    },
  });
});

// POST /api/auth/logout - Sign out user and invalidate session
authRouter.post("/logout", optionalAuth, async (req: AuthenticatedRequest, res: Response) => {
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
