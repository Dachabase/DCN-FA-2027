import { Request, Response, NextFunction } from "express";
import { prisma } from "../database/prisma";
import {
  verifyAccessToken,
  verifyRefreshToken,
  generateAccessToken,
  generateRefreshToken,
  getFallbackUser,
  updateFallbackUser,
  setAuthCookies,
} from "./auth.service";
import crypto from "crypto";
import { User } from "@prisma/client";

export interface AuthenticatedRequest extends Request {
  user?: User | null;
}

/** A token issued before sessionsValidFrom (set on password reset or a forced sign-out) is no longer valid. */
export function isTokenRevoked(sessionsValidFrom: Date | null | undefined, issuedAtSeconds: number | undefined): boolean {
  if (!sessionsValidFrom) return false;
  if (!issuedAtSeconds) return true;
  return issuedAtSeconds * 1000 < sessionsValidFrom.getTime();
}

export async function authenticateToken(
  req: AuthenticatedRequest,
  res: Response
): Promise<User | null> {
  const authHeader = req.headers.authorization;
  const headerToken = authHeader && authHeader.startsWith("Bearer ") ? authHeader.substring(7) : null;
  const cookieAccessToken = req.cookies?.ui_access_token;
  const accessToken = headerToken || cookieAccessToken;

  // 1. Verify access token if present
  if (accessToken) {
    const payload = verifyAccessToken(accessToken);
    if (payload && payload.userId) {
      try {
        const user = await prisma.user.findUnique({
          where: { id: payload.userId },
          include: {
            faculty: { select: { id: true, name: true, code: true } },
            department: { select: { id: true, name: true } },
          },
        });
        if (user) {
          if (isTokenRevoked(user.sessionsValidFrom, (payload as any).iat)) {
            req.user = null;
            return null;
          }
          req.user = user;
          return user;
        }
        // The account no longer exists: never invent a user from token claims.
        req.user = null;
        return null;
      } catch (e) {
        // DB offline or table sync pending: fall through to the development fallback store
      }

      // Fallback user store
      let fb = getFallbackUser(payload.userId);
      if (!fb) {
        fb = updateFallbackUser(payload.userId, {
          id: payload.userId,
          googleSub: payload.googleSub || null,
          email: payload.email || null,
          fullName: payload.email ? payload.email.split("@")[0].replace(/[._]/g, " ").replace(/\b\w/g, c => c.toUpperCase()) : "UI Fresher",
          lastSeenAt: new Date(),
        }) || {
          id: payload.userId,
          googleSub: payload.googleSub || null,
          email: payload.email || null,
          fullName: "UI Fresher",
          avatarUrl: null,
          telegramId: null,
          firstName: null,
          lastName: null,
          username: null,
          role: null,
          facultyId: null,
          departmentId: null,
          level: 100,
          utmeExamYear: null,
          onboardingStep: null,
          onboardingCompletedAt: new Date(),
          streakCount: 0,
          lastActiveDate: new Date(),
          totalPoints: 0,
          lastSeenAt: new Date(),
          refreshTokenHash: null,
          passwordHash: null,
          emailVerifiedAt: null,
          failedLoginCount: 0,
          lockedUntil: null,
          sessionsValidFrom: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
      }
      req.user = fb;
      return fb;
    }
  }

  // 2. Check refresh token in cookies
  const cookieRefreshToken = req.cookies?.ui_refresh_token;
  if (cookieRefreshToken) {
    const refreshPayload = verifyRefreshToken(cookieRefreshToken);
    if (refreshPayload && refreshPayload.userId) {
      let user: any = null;
      try {
        user = await prisma.user.findUnique({
          where: { id: refreshPayload.userId },
          include: {
            faculty: { select: { id: true, name: true, code: true } },
            department: { select: { id: true, name: true } },
          },
        });
      } catch (e) {
        user = getFallbackUser(refreshPayload.userId);
      }
      if (!user) {
        user = getFallbackUser(refreshPayload.userId);
      }

      const incomingHash = crypto
        .createHash("sha256")
        .update(cookieRefreshToken)
        .digest("hex");

      // The refresh token must match the hash saved at sign-in. A cleared hash (after logout or a
      // password reset) means no refresh token is valid any more.
      const isHashValid =
        !!user &&
        !!user.refreshTokenHash &&
        incomingHash === user.refreshTokenHash &&
        !isTokenRevoked(user.sessionsValidFrom, (refreshPayload as any).iat);

      if (isHashValid) {
        const effectiveUser = user;

        // Rotate refresh token & issue new access token
        const newAccessToken = generateAccessToken(effectiveUser);
        const { token: newRefreshToken, hash: newRefreshHash } = generateRefreshToken(effectiveUser);

        try {
          await prisma.user.update({
            where: { id: effectiveUser.id },
            data: {
              refreshTokenHash: newRefreshHash,
              lastSeenAt: new Date(),
            },
          });
        } catch (e) {
          updateFallbackUser(effectiveUser.id, {
            refreshTokenHash: newRefreshHash,
            lastSeenAt: new Date(),
          });
        }

        setAuthCookies(req, res, newAccessToken, newRefreshToken);

        req.user = effectiveUser;
        return effectiveUser;
      }
    }
  }

  req.user = null;
  return null;
}

export async function requireAuth(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) {
  const user = await authenticateToken(req, res);
  if (!user) {
    return res.status(401).json({
      success: false,
      error: "UNAUTHORIZED",
      message: "Authentication required to access this resource.",
    });
  }
  next();
}

export async function optionalAuth(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) {
  await authenticateToken(req, res);
  next();
}
