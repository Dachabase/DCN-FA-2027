import { Request, Response, NextFunction } from "express";
import { prisma } from "../database/prisma";
import {
  verifyAccessToken,
  verifyRefreshToken,
  generateAccessToken,
  generateRefreshToken,
  getFallbackUser,
  setAuthCookies,
} from "./auth.service";
import crypto from "crypto";
import { User } from "@prisma/client";

export interface AuthenticatedRequest extends Request {
  user?: User | null;
}

export async function authenticateToken(
  req: AuthenticatedRequest,
  res: Response
): Promise<User | null> {
  const authHeader = req.headers.authorization;
  const headerToken = authHeader && authHeader.startsWith("Bearer ") ? authHeader.substring(7) : null;
  const cookieAccessToken = req.cookies?.ui_access_token;
  const accessToken = headerToken || cookieAccessToken;

  // Verify access token if present
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
          req.user = user;
          return user;
        }
      } catch (e) {
        // Fallback user store if DB unavailable
        const fb = getFallbackUser(payload.userId);
        if (fb) {
          req.user = fb;
          return fb;
        }
      }
    }
  }

  // Check refresh token in cookies
  const cookieRefreshToken = req.cookies?.ui_refresh_token;
  if (cookieRefreshToken) {
    const refreshPayload = verifyRefreshToken(cookieRefreshToken);
    if (refreshPayload && refreshPayload.userId) {
      try {
        const user = await prisma.user.findUnique({
          where: { id: refreshPayload.userId },
          include: {
            faculty: { select: { id: true, name: true, code: true } },
            department: { select: { id: true, name: true } },
          },
        });

        if (user && user.refreshTokenHash) {
          const incomingHash = crypto
            .createHash("sha256")
            .update(cookieRefreshToken)
            .digest("hex");

          if (incomingHash === user.refreshTokenHash) {
            // Rotate refresh token & issue new access token
            const newAccessToken = generateAccessToken(user);
            const { token: newRefreshToken, hash: newRefreshHash } = generateRefreshToken(user);

            await prisma.user.update({
              where: { id: user.id },
              data: {
                refreshTokenHash: newRefreshHash,
                lastSeenAt: new Date(),
              },
            });

            setAuthCookies(req, res, newAccessToken, newRefreshToken);

            req.user = user;
            return user;
          }
        }
      } catch (e) {
        console.error("Error refreshing token:", e);
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
