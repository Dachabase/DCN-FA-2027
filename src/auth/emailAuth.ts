import { Router, Request, Response } from "express";
import crypto from "crypto";
import jwt from "jsonwebtoken";
import { prisma } from "../database/prisma";
import { generateAccessToken, generateRefreshToken, setAuthCookies } from "./auth.service";

/**
 * Passwordless email sign-in with a 4-digit code.
 *   POST /api/auth/email/send-code   { email }                      -> { success, data: { challenge } }
 *   POST /api/auth/email/verify-code { email, code, challenge }     -> same shape as POST /api/auth/google
 * No database migration needed: the code is checked against a signed, 10-minute "challenge" token.
 * Email is sent with the Brevo HTTP API (works on Render free tier).
 * Env vars: BREVO_API_KEY, MAIL_FROM_EMAIL (a sender verified in Brevo), MAIL_FROM_NAME (optional)
 */
export const emailAuthRouter = Router();

function getEmailAuthSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.trim() === "") {
    if (process.env.NODE_ENV === "production") {
      throw new Error("JWT_SECRET environment variable is required in production mode.");
    }
    return "dev-only-jwt-secret-do-not-use-in-production";
  }
  return secret;
}

const SECRET = getEmailAuthSecret();

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const lastSent = new Map<string, number>();   // email -> timestamp (1 code per 45s)
const attempts = new Map<string, number>();   // email -> wrong tries (max 5 per code)

const hashCode = (email: string, code: string) =>
  crypto.createHmac("sha256", SECRET).update(`${email}:${code}`).digest("hex");

async function sendEmail(to: string, code: string): Promise<boolean> {
  const apiKey = process.env.BREVO_API_KEY;
  const fromEmail = process.env.MAIL_FROM_EMAIL;
  if (!apiKey || !fromEmail) {
    console.warn(`[email-auth] BREVO_API_KEY / MAIL_FROM_EMAIL not set. Code for ${to}: ${code}`);
    return false;
  }
  const res = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: { "api-key": apiKey, "Content-Type": "application/json", accept: "application/json" },
    body: JSON.stringify({
      sender: { email: fromEmail, name: process.env.MAIL_FROM_NAME || "UI Freshers Companion" },
      to: [{ email: to }],
      subject: `Your UI Freshers verification code: ${code}`,
      htmlContent: `<div style="font-family:Arial,sans-serif;max-width:420px;margin:auto;padding:24px">
        <h2 style="color:#830074">UI Freshers Companion</h2>
        <p>Your verification code is:</p>
        <p style="font-size:36px;font-weight:bold;letter-spacing:10px;color:#1A0518">${code}</p>
        <p style="color:#6b5c6b">It expires in 10 minutes. If you did not request it, ignore this email.</p></div>`,
    }),
  });
  if (!res.ok) {
    console.error("[email-auth] Brevo error", res.status, await res.text().catch(() => ""));
    return false;
  }
  return true;
}

emailAuthRouter.post("/send-code", async (req: Request, res: Response) => {
  const email = String(req.body?.email || "").trim().toLowerCase();
  if (!EMAIL_RE.test(email)) {
    return res.status(400).json({ success: false, error: "INVALID_EMAIL", message: "Please enter a valid email address." });
  }
  const now = Date.now();
  if (now - (lastSent.get(email) || 0) < 45_000) {
    return res.status(429).json({ success: false, error: "TOO_MANY_REQUESTS", message: "Please wait a moment before requesting another code." });
  }
  const code = String(crypto.randomInt(0, 10000)).padStart(4, "0");
  const sent = await sendEmail(email, code);
  const isProd = process.env.NODE_ENV === "production";
  if (!sent && isProd) {
    return res.status(502).json({ success: false, error: "EMAIL_FAILED", message: "Could not send the email. Please try again shortly." });
  }
  lastSent.set(email, now);
  attempts.delete(email);
  const challenge = jwt.sign({ email, h: hashCode(email, code) }, SECRET, { expiresIn: "10m" });
  return res.json({
    success: true,
    data: { challenge, ...(sent ? {} : { devCode: code }) }, // devCode only when email is not configured and not in production
  });
});

emailAuthRouter.post("/verify-code", async (req: Request, res: Response) => {
  try {
    const email = String(req.body?.email || "").trim().toLowerCase();
    const code = String(req.body?.code || "").trim();
    const challenge = String(req.body?.challenge || "");
    if (!EMAIL_RE.test(email) || !/^\d{4}$/.test(code) || !challenge) {
      return res.status(400).json({ success: false, error: "INVALID_INPUT", message: "Enter the 4-digit code from your email." });
    }
    if ((attempts.get(email) || 0) >= 5) {
      return res.status(429).json({ success: false, error: "TOO_MANY_ATTEMPTS", message: "Too many wrong attempts. Please request a new code." });
    }
    let payload: any;
    try { payload = jwt.verify(challenge, SECRET); }
    catch { return res.status(400).json({ success: false, error: "CODE_EXPIRED", message: "This code has expired. Please request a new one." }); }
    if (payload.email !== email || payload.h !== hashCode(email, code)) {
      attempts.set(email, (attempts.get(email) || 0) + 1);
      return res.status(401).json({ success: false, error: "WRONG_CODE", message: "That code is not correct." });
    }
    attempts.delete(email);

    let user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      user = await prisma.user.create({ data: { email, fullName: email.split("@")[0] } });
    }
    const accessToken = generateAccessToken(user);
    const { token: refreshToken, hash } = generateRefreshToken(user);
    await prisma.user.update({ where: { id: user.id }, data: { refreshTokenHash: hash, lastSeenAt: new Date() } });
    setAuthCookies(req, res, accessToken, refreshToken);

    return res.json({
      success: true,
      data: {
        user: {
          id: user.id, email: user.email, fullName: user.fullName, avatarUrl: user.avatarUrl, role: user.role,
          facultyId: user.facultyId, departmentId: user.departmentId, level: user.level,
          onboardingCompletedAt: user.onboardingCompletedAt, isOnboarded: !!user.onboardingCompletedAt,
        },
        accessToken,
      },
    });
  } catch (error: any) {
    console.error("[email-auth] verify error:", error);
    return res.status(500).json({ success: false, error: "SERVER_ERROR", message: "Could not sign you in. Please try again." });
  }
});
