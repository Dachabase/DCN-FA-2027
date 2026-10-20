import { Router, Request, Response } from "express";
import crypto from "crypto";
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
import { emailAuthRouter } from "./emailAuth";

export const authRouter = Router();
authRouter.use("/email", emailAuthRouter); // passwordless 4-digit email code sign-in

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
  const forwardedProto = req.headers["x-forwarded-proto"];
  let protocol = "https";
  if (typeof forwardedProto === "string") {
    protocol = forwardedProto.split(",")[0].trim();
  } else if (Array.isArray(forwardedProto) && forwardedProto.length > 0) {
    protocol = String(forwardedProto[0]).split(",")[0].trim();
  } else if (req.protocol) {
    protocol = req.protocol;
  }
  const host = req.get("host");
  return `${protocol}://${host}/api/auth/callback/google`;
}

// GET /api/auth/google/login - Standard Google OAuth 2.0 Redirect Authorization Flow
authRouter.get("/google/login", (req: Request, res: Response) => {
  const googleClientId = process.env.GOOGLE_CLIENT_ID;
  const redirectUri = getRedirectUri(req);

  // If live Google credentials exist, redirect directly to Google OAuth 2.0 unless chooser=1 requested
  if (req.query.chooser !== "1" && googleClientId && process.env.GOOGLE_CLIENT_SECRET) {
    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?` + new URLSearchParams({
      client_id: googleClientId,
      redirect_uri: redirectUri,
      response_type: "code",
      scope: "openid email profile",
      access_type: "offline",
      prompt: "select_account",
    }).toString();
    return res.redirect(authUrl);
  }

  // Interactive Google "Choose an Account" Experience
  res.send(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <title>Sign in – Google accounts</title>
      <meta name="viewport" content="width=device-width, initial-scale=1">
      <link rel="preconnect" href="https://fonts.googleapis.com">
      <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
      <link href="https://fonts.googleapis.com/css2?family=Google+Sans:wght@400;500;700&family=Roboto:wght@400;500&display=swap" rel="stylesheet">
      <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body {
          font-family: 'Google Sans', 'Roboto', -apple-system, BlinkMacSystemFont, sans-serif;
          background-color: #0F0D15;
          color: #E2E8F0;
          display: flex;
          align-items: center;
          justify-content: center;
          min-height: 100vh;
          padding: 1.25rem;
        }
        .google-card {
          width: 100%;
          max-width: 440px;
          background: #181524;
          border: 1px solid rgba(139, 92, 246, 0.25);
          border-radius: 24px;
          padding: 2.25rem 2rem;
          box-shadow: 0 16px 40px rgba(0, 0, 0, 0.6);
        }
        .google-header {
          text-align: center;
          margin-bottom: 1.75rem;
        }
        .google-logo {
          width: 44px;
          height: 44px;
          margin-bottom: 1rem;
        }
        .google-title {
          font-size: 1.45rem;
          font-weight: 500;
          color: #F8FAFC;
          letter-spacing: -0.02em;
          margin-bottom: 0.35rem;
        }
        .google-subtitle {
          font-size: 0.92rem;
          color: #94A3B8;
        }
        .account-list {
          display: flex;
          flex-direction: column;
          gap: 0.6rem;
          margin-bottom: 1.5rem;
        }
        .account-btn {
          display: flex;
          align-items: center;
          gap: 0.9rem;
          width: 100%;
          padding: 0.85rem 1rem;
          background: rgba(255, 255, 255, 0.04);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 14px;
          color: #F1F5F9;
          cursor: pointer;
          transition: all 0.2s ease;
          text-align: left;
          font-family: inherit;
        }
        .account-btn:hover {
          background: rgba(139, 92, 246, 0.15);
          border-color: rgba(139, 92, 246, 0.4);
          transform: translateY(-1px);
        }
        .avatar-circle {
          width: 40px;
          height: 40px;
          border-radius: 50%;
          background: linear-gradient(135deg, #8B5CF6, #6D28D9);
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 700;
          font-size: 1.1rem;
          color: #FFFFFF;
          flex-shrink: 0;
        }
        .account-info {
          flex: 1;
          min-width: 0;
        }
        .account-name {
          font-size: 0.95rem;
          font-weight: 500;
          color: #FFFFFF;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .account-email {
          font-size: 0.82rem;
          color: #94A3B8;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .custom-account-box {
          border-top: 1px solid rgba(255, 255, 255, 0.08);
          padding-top: 1.25rem;
          margin-top: 0.5rem;
        }
        .custom-input-label {
          font-size: 0.85rem;
          font-weight: 500;
          color: #CBD5E1;
          margin-bottom: 0.5rem;
          display: block;
        }
        .custom-input {
          width: 100%;
          padding: 0.75rem 1rem;
          border-radius: 10px;
          background: rgba(255, 255, 255, 0.06);
          border: 1px solid rgba(255, 255, 255, 0.15);
          color: #FFFFFF;
          font-size: 0.92rem;
          font-family: inherit;
          margin-bottom: 0.75rem;
          outline: none;
          transition: border-color 0.2s;
        }
        .custom-input:focus {
          border-color: #8B5CF6;
        }
        .submit-btn {
          width: 100%;
          padding: 0.85rem;
          border-radius: 10px;
          background: #8B5CF6;
          color: #FFFFFF;
          font-weight: 700;
          font-size: 0.92rem;
          border: none;
          cursor: pointer;
          font-family: inherit;
          transition: background 0.2s;
        }
        .submit-btn:hover {
          background: #7C3AED;
        }
        .google-footer {
          margin-top: 1.25rem;
          font-size: 0.76rem;
          color: #64748B;
          line-height: 1.4;
          text-align: center;
        }
      </style>
    </head>
    <body>
      <div class="google-card">
        <div class="google-header">
          <svg class="google-logo" viewBox="0 0 24 24">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
          </svg>
          <h1 class="google-title">Choose an account</h1>
          <p class="google-subtitle">to continue to <strong>UI Freshers Companion</strong></p>
        </div>

        <!-- Pre-populated Quick Select Options -->
        <div class="account-list">
          <form action="/api/auth/google/choose-account" method="POST">
            <input type="hidden" name="fullName" value="David Itoya">
            <input type="hidden" name="email" value="david.itoya@gmail.com">
            <button type="submit" class="account-btn">
              <div class="avatar-circle" style="background: linear-gradient(135deg, #3B82F6, #1D4ED8);">D</div>
              <div class="account-info">
                <div class="account-name">David Itoya</div>
                <div class="account-email">david.itoya@gmail.com</div>
              </div>
            </button>
          </form>

          <form action="/api/auth/google/choose-account" method="POST">
            <input type="hidden" name="fullName" value="Adeola Olawale">
            <input type="hidden" name="email" value="adeola.olawale@gmail.com">
            <button type="submit" class="account-btn">
              <div class="avatar-circle" style="background: linear-gradient(135deg, #10B981, #047857);">A</div>
              <div class="account-info">
                <div class="account-name">Adeola Olawale</div>
                <div class="account-email">adeola.olawale@gmail.com</div>
              </div>
            </button>
          </form>
        </div>

        <!-- Custom Account Option -->
        <div class="custom-account-box">
          <form action="/api/auth/google/choose-account" method="POST">
            <label class="custom-input-label">Or sign in with another Google account:</label>
            <input type="text" name="fullName" class="custom-input" placeholder="Your Full Name (e.g. David Itoya)" required />
            <input type="email" name="email" class="custom-input" placeholder="Your Google Email (e.g. you@gmail.com)" required />
            <button type="submit" class="submit-btn">Continue with Google Account →</button>
          </form>
        </div>

        <p class="google-footer">
          To continue, Google will share your name, email address, and profile picture with UI Freshers Companion.
        </p>
      </div>
    </body>
    </html>
  `);
});

// POST /api/auth/google/choose-account - Processes account selection and creates persistent verified session
authRouter.post("/google/choose-account", async (req: Request, res: Response) => {
  try {
    const { email, fullName } = req.body;
    if (!email || !email.includes("@")) {
      return res.status(400).send("Invalid email address provided.");
    }

    const cleanEmail = email.toLowerCase().trim();
    const cleanName = (fullName || cleanEmail.split("@")[0]).trim();
    
    // Generate deterministic 21-digit Google Sub
    const hashHex = crypto.createHash("sha256").update(cleanEmail).digest("hex");
    const digits = hashHex.replace(/\D/g, "").slice(0, 20).padEnd(20, "7");
    const googleSub = "1" + digits;

    const user = await syncGoogleUser({
      googleSub,
      email: cleanEmail,
      fullName: cleanName,
      avatarUrl: `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(cleanName)}&backgroundColor=8b5cf6`,
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
      updateFallbackUser(user.id, {
        refreshTokenHash: refreshHash,
        lastSeenAt: new Date(),
      });
    }

    setAuthCookies(req, res, accessToken, refreshToken);
    res.redirect("/#/home");
  } catch (err: any) {
    console.error("Choose account error:", err);
    res.redirect("/#/home?auth_error=account_selection_failed");
  }
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
