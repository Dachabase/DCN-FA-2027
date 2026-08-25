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

// GET /api/auth/google/login - Standard Google OAuth 2.0 Redirect Authorization Flow
authRouter.get("/google/login", (req: Request, res: Response) => {
  const googleClientId = process.env.GOOGLE_CLIENT_ID;
  if (!googleClientId) {
    return res.status(500).send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Google OAuth Configuration</title>
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #0f0d15; color: #f8fafc; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; padding: 1.5rem; box-sizing: border-box; }
          .card { max-width: 460px; background: #1a1626; border: 1px solid rgba(139,92,246,0.3); border-radius: 16px; padding: 2rem; text-align: center; }
          h2 { color: #f8fafc; margin-top: 0; font-size: 1.4rem; }
          p { color: #94a3b8; font-size: 0.95rem; line-height: 1.5; }
          code { background: rgba(0,0,0,0.4); padding: 0.2rem 0.4rem; border-radius: 6px; color: #a78bfa; }
          a { display: inline-block; margin-top: 1.25rem; background: #8b5cf6; color: #fff; padding: 0.75rem 1.5rem; border-radius: 10px; text-decoration: none; font-weight: 700; }
        </style>
      </head>
      <body>
        <div class="card">
          <h2>Google OAuth Setup Required</h2>
          <p>Please configure <code>GOOGLE_CLIENT_ID</code> and <code>GOOGLE_CLIENT_SECRET</code> in your environment variables to enable Google Sign-In.</p>
          <a href="/#/home">← Return to App</a>
        </div>
      </body>
      </html>
    `);
  }

  const protocol = req.headers["x-forwarded-proto"] || req.protocol;
  const host = req.get("host");
  const redirectUri = `${protocol}://${host}/api/auth/callback/google`;

  const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?` + new URLSearchParams({
    client_id: googleClientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: "openid email profile",
    access_type: "offline",
    prompt: "select_account",
  }).toString();

  res.redirect(authUrl);
});

// GET /api/auth/callback/google - Google OAuth 2.0 Redirect Callback
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

    const protocol = req.headers["x-forwarded-proto"] || req.protocol;
    const host = req.get("host");
    const redirectUri = `${protocol}://${host}/api/auth/callback/google`;

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
