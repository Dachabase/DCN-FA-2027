import { Request, Response } from "express";
import { prisma } from "../database/prisma";
import { generateAccessToken, generateRefreshToken, setAuthCookies } from "./auth.service";
import { getStaffRole } from "./staff";

/** Signs the person in: new token pair, refresh hash saved, cookies set. A database failure is an error, never silently ignored. */
export async function startSession(req: Request, res: Response, user: any): Promise<string> {
  const accessToken = generateAccessToken(user);
  const { token: refreshToken, hash } = generateRefreshToken(user);
  await prisma.user.update({
    where: { id: user.id },
    data: { refreshTokenHash: hash, lastSeenAt: new Date() },
  });
  setAuthCookies(req, res, accessToken, refreshToken);
  return accessToken;
}

/** The user shape sent to the browser (never includes password data). */
export async function serializeUser(user: any) {
  const staffRole = await getStaffRole(user);
  return {
    id: user.id,
    googleSub: user.googleSub,
    email: user.email,
    emailVerified: !!user.emailVerifiedAt,
    fullName: user.fullName,
    avatarUrl: user.avatarUrl,
    role: user.role,
    facultyId: user.facultyId,
    faculty: user.faculty,
    departmentId: user.departmentId,
    department: user.department,
    level: user.level,
    utmeExamYear: user.utmeExamYear,
    onboardingCompletedAt: user.onboardingCompletedAt,
    lastSeenAt: user.lastSeenAt,
    isOnboarded: !!user.onboardingCompletedAt,
    isAdmin: staffRole !== null,
    isOwner: staffRole === "owner",
  };
}

export const USER_INCLUDE = {
  faculty: { select: { id: true, name: true, code: true } },
  department: { select: { id: true, name: true } },
} as const;
