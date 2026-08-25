import { OAuth2Client } from "google-auth-library";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import { prisma } from "../database/prisma";
import { User } from "@prisma/client";

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || "";
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || "";
const JWT_SECRET = process.env.JWT_SECRET || "ui-freshers-secure-jwt-secret-2026-fallback";
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || "ui-freshers-refresh-jwt-secret-2026-fallback";

const oauth2Client = new OAuth2Client(
  GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET,
  "postmessage" // For Google Sign-in One-Tap / Popup Auth Code flow
);

export interface TokenPayload {
  userId: string;
  email?: string | null;
  googleSub?: string | null;
}

export function generateAccessToken(user: User): string {
  return jwt.sign(
    {
      userId: user.id,
      email: user.email,
      googleSub: user.googleSub,
    } as TokenPayload,
    JWT_SECRET,
    { expiresIn: "7d" } // 7-day persistent access token
  );
}

export function generateRefreshToken(user: User): { token: string; hash: string } {
  const token = jwt.sign(
    { userId: user.id } as TokenPayload,
    JWT_REFRESH_SECRET,
    { expiresIn: "30d" } // 30-day refresh token
  );
  const hash = crypto.createHash("sha256").update(token).digest("hex");
  return { token, hash };
}

export function verifyAccessToken(token: string): TokenPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET) as TokenPayload;
  } catch (error) {
    return null;
  }
}

export function verifyRefreshToken(token: string): TokenPayload | null {
  try {
    return jwt.verify(token, JWT_REFRESH_SECRET) as TokenPayload;
  } catch (error) {
    return null;
  }
}

export function setAuthCookies(req: any, res: any, accessToken: string, refreshToken: string) {
  const isSecure = process.env.NODE_ENV === "production" || req.secure || req.headers["x-forwarded-proto"] === "https";

  res.cookie("ui_access_token", accessToken, {
    httpOnly: true,
    secure: isSecure,
    sameSite: "lax",
    path: "/",
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  });

  res.cookie("ui_refresh_token", refreshToken, {
    httpOnly: true,
    secure: isSecure,
    sameSite: "lax",
    path: "/",
    maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
  });
}

export function clearAuthCookies(res: any) {
  const isSecure = process.env.NODE_ENV === "production";
  res.clearCookie("ui_access_token", { path: "/", httpOnly: true, secure: isSecure, sameSite: "lax" });
  res.clearCookie("ui_refresh_token", { path: "/", httpOnly: true, secure: isSecure, sameSite: "lax" });
}

export async function verifyGoogleTokenOrCode(credentialOrCode: string): Promise<{
  googleSub: string;
  email: string;
  fullName: string;
  avatarUrl: string;
}> {
  const googleClientId = process.env.GOOGLE_CLIENT_ID || "";
  const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET || "";

  // 1. If it's an ID Token (JWT) from Google Identity Services
  if (credentialOrCode.split(".").length === 3) {
    const client = new OAuth2Client(googleClientId, googleClientSecret);
    const ticket = await client.verifyIdToken({
      idToken: credentialOrCode,
      audience: googleClientId || undefined,
    });
    const payload = ticket.getPayload();
    if (!payload || !payload.sub) {
      throw new Error("Invalid Google token payload");
    }
    return {
      googleSub: payload.sub,
      email: payload.email || "",
      fullName: payload.name || `${payload.given_name || ""} ${payload.family_name || ""}`.trim() || "UI Fresher",
      avatarUrl: payload.picture || "",
    };
  }

  // 2. Otherwise, exchange authorization code for tokens
  const client = new OAuth2Client(
    googleClientId,
    googleClientSecret,
    "postmessage"
  );
  const { tokens } = await client.getToken(credentialOrCode);
  if (!tokens.id_token) {
    throw new Error("Failed to retrieve ID token from Google authorization code");
  }

  const ticket = await client.verifyIdToken({
    idToken: tokens.id_token,
    audience: googleClientId || undefined,
  });
  const payload = ticket.getPayload();
  if (!payload || !payload.sub) {
    throw new Error("Missing payload sub from Google auth code");
  }

  return {
    googleSub: payload.sub,
    email: payload.email || "",
    fullName: payload.name || `${payload.given_name || ""} ${payload.family_name || ""}`.trim() || "UI Fresher",
    avatarUrl: payload.picture || "",
  };
}

export async function exchangeGoogleCode(code: string, redirectUri: string): Promise<{
  googleSub: string;
  email: string;
  fullName: string;
  avatarUrl: string;
}> {
  const googleClientId = process.env.GOOGLE_CLIENT_ID || "";
  const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET || "";

  const client = new OAuth2Client(
    googleClientId,
    googleClientSecret,
    redirectUri
  );

  const { tokens } = await client.getToken(code);
  if (!tokens.id_token) {
    throw new Error("Failed to receive Google ID token from OAuth code exchange.");
  }

  const ticket = await client.verifyIdToken({
    idToken: tokens.id_token,
    audience: googleClientId || undefined,
  });

  const payload = ticket.getPayload();
  if (!payload || !payload.sub) {
    throw new Error("Invalid token payload returned from Google.");
  }

  return {
    googleSub: payload.sub,
    email: payload.email || "",
    fullName: payload.name || `${payload.given_name || ""} ${payload.family_name || ""}`.trim() || "UI Fresher",
    avatarUrl: payload.picture || "",
  };
}

// In-memory fallback cache for offline development/testing
const fallbackUsers: Map<string, User> = new Map();

export async function syncGoogleUser(data: {
  googleSub: string;
  email: string;
  fullName: string;
  avatarUrl: string;
}): Promise<User> {
  try {
    // Stable keying by googleSub
    const existingUser = await prisma.user.findUnique({
      where: { googleSub: data.googleSub },
    });

    if (existingUser) {
      return await prisma.user.update({
        where: { id: existingUser.id },
        data: {
          email: data.email || existingUser.email,
          fullName: data.fullName || existingUser.fullName,
          avatarUrl: data.avatarUrl || existingUser.avatarUrl,
          lastSeenAt: new Date(),
        },
      });
    }

    // Check if user exists by email (link accounts if previously created)
    if (data.email) {
      const userByEmail = await prisma.user.findUnique({
        where: { email: data.email },
      });
      if (userByEmail) {
        return await prisma.user.update({
          where: { id: userByEmail.id },
          data: {
            googleSub: data.googleSub,
            fullName: data.fullName || userByEmail.fullName,
            avatarUrl: data.avatarUrl || userByEmail.avatarUrl,
            lastSeenAt: new Date(),
          },
        });
      }
    }

    // Create new user
    return await prisma.user.create({
      data: {
        googleSub: data.googleSub,
        email: data.email,
        fullName: data.fullName,
        avatarUrl: data.avatarUrl,
        lastSeenAt: new Date(),
      },
    });
  } catch (err) {
    console.warn("DB offline or unavailable, using fallback in-memory user store.");
    let user = Array.from(fallbackUsers.values()).find(
      (u) => u.googleSub === data.googleSub || (data.email && u.email === data.email)
    );

    if (!user) {
      user = {
        id: "usr_" + Math.random().toString(36).substring(2, 9),
        googleSub: data.googleSub,
        email: data.email,
        fullName: data.fullName,
        avatarUrl: data.avatarUrl,
        telegramId: null,
        firstName: data.fullName.split(" ")[0],
        lastName: data.fullName.split(" ")[1] || null,
        username: data.email ? data.email.split("@")[0] : null,
        role: null,
        facultyId: null,
        departmentId: null,
        level: null,
        utmeExamYear: null,
        onboardingStep: null,
        onboardingCompletedAt: null,
        streakCount: 0,
        lastActiveDate: new Date(),
        totalPoints: 0,
        lastSeenAt: new Date(),
        refreshTokenHash: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
    } else {
      user = {
        ...user,
        fullName: data.fullName || user.fullName,
        avatarUrl: data.avatarUrl || user.avatarUrl,
        lastSeenAt: new Date(),
      };
    }

    fallbackUsers.set(user.id, user);
    return user;
  }
}

export function getFallbackUser(id: string): User | undefined {
  return fallbackUsers.get(id);
}

export function updateFallbackUser(id: string, updates: Partial<User>): User | undefined {
  const user = fallbackUsers.get(id);
  if (!user) return undefined;
  const updated = { ...user, ...updates, updatedAt: new Date() };
  fallbackUsers.set(id, updated);
  return updated;
}

