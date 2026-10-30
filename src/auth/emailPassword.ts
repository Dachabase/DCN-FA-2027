import { Router, Request, Response } from "express";
import { prisma } from "../database/prisma";
import {
  hashPassword,
  verifyPassword,
  burnPasswordCheck,
  validatePassword,
} from "./password";
import {
  issueCode,
  consumeCode,
  CodeCooldownError,
  CODE_MAX_ATTEMPTS,
} from "./authCodes";
import { sendVerificationCode, sendPasswordResetCode, sendAccountExistsNotice } from "./mailer";
import { rateLimit } from "./rateLimit";
import { startSession, serializeUser, USER_INCLUDE } from "./session";
import { normalizeEmail, isValidEmail } from "./staffRules";

/**
 * Email + password accounts.
 *   POST /api/auth/email/signup           { fullName, email, password }  -> emails a 6-digit code
 *   POST /api/auth/email/verify-email     { email, code }                -> verifies the address and signs in
 *   POST /api/auth/email/resend-code      { email }                      -> new verification code
 *   POST /api/auth/email/login            { email, password }
 *   POST /api/auth/email/forgot-password  { email }                      -> emails a 6-digit reset code
 *   POST /api/auth/email/reset-password   { email, code, newPassword }   -> sets the password, signs out other devices
 *
 * Endpoints that take an email never reveal whether that email is registered.
 */
export const emailPasswordRouter = Router();

const LOGIN_MAX_FAILS = 5;
const LOGIN_LOCK_MS = 15 * 60 * 1000;

const HOUR = 60 * 60 * 1000;
const QUARTER_HOUR = 15 * 60 * 1000;

const signupLimit = rateLimit({ windowMs: HOUR, max: 10 });
const codeLimit = rateLimit({ windowMs: QUARTER_HOUR, max: 20 });
const loginLimit = rateLimit({ windowMs: QUARTER_HOUR, max: 30 });
const forgotLimit = rateLimit({ windowMs: HOUR, max: 10 });

function fail(res: Response, status: number, error: string, message: string) {
  return res.status(status).json({ success: false, error, message });
}

function serverError(res: Response, label: string, err: unknown) {
  console.error(`[email-auth] ${label}:`, err);
  return fail(res, 500, "SERVER_ERROR", "Something went wrong. Please try again.");
}

function cleanName(value: unknown, email: string): string {
  const name = String(value ?? "").replace(/\s+/g, " ").trim().slice(0, 80);
  return name || email.split("@")[0];
}

const GENERIC_SIGNUP_REPLY = {
  success: true,
  message: "If this email can be registered, we have sent a 6-digit code to it.",
};

// ---------------------------------------------------------------- sign up
emailPasswordRouter.post("/signup", signupLimit, async (req: Request, res: Response) => {
  try {
    const email = normalizeEmail(req.body?.email);
    const password = req.body?.password;
    if (!isValidEmail(email)) {
      return fail(res, 400, "INVALID_EMAIL", "Please enter a valid email address.");
    }
    const passwordProblem = validatePassword(password, email);
    if (passwordProblem) return fail(res, 400, "WEAK_PASSWORD", passwordProblem);

    const existing = await prisma.user.findUnique({ where: { email } });

    if (existing && existing.emailVerifiedAt) {
      // Already a real account: change nothing, tell the owner of the inbox, and answer like a normal sign-up.
      void sendAccountExistsNotice(email);
      return res.json(GENERIC_SIGNUP_REPLY);
    }

    const passwordHash = await hashPassword(password);
    const fullName = cleanName(req.body?.fullName, email);

    if (existing) {
      // An earlier, never-verified attempt: the new password replaces the old one.
      await prisma.user.update({
        where: { id: existing.id },
        data: { passwordHash, fullName },
      });
    } else {
      await prisma.user.create({ data: { email, fullName, passwordHash } });
    }

    try {
      const code = await issueCode(email, "EMAIL_VERIFY");
      const sent = await sendVerificationCode(email, code);
      if (!sent && process.env.NODE_ENV !== "production") {
        console.warn(`[email-auth] (development) verification code for ${email}: ${code}`);
      }
    } catch (err) {
      if (!(err instanceof CodeCooldownError)) throw err;
    }
    return res.json(GENERIC_SIGNUP_REPLY);
  } catch (err) {
    return serverError(res, "signup", err);
  }
});

// ------------------------------------------------------- verify the email
emailPasswordRouter.post("/verify-email", codeLimit, async (req: Request, res: Response) => {
  try {
    const email = normalizeEmail(req.body?.email);
    const code = String(req.body?.code ?? "").trim();
    if (!isValidEmail(email) || !/^\d{6}$/.test(code)) {
      return fail(res, 400, "INVALID_INPUT", "Enter the 6-digit code from your email.");
    }
    const result = await consumeCode(email, "EMAIL_VERIFY", code);
    if (result === "EXPIRED") {
      return fail(res, 400, "CODE_EXPIRED", "This code has expired. Please request a new one.");
    }
    if (result === "TOO_MANY_ATTEMPTS") {
      return fail(res, 429, "TOO_MANY_ATTEMPTS", `Too many wrong tries (${CODE_MAX_ATTEMPTS} allowed). Please request a new code.`);
    }
    if (result !== "OK") {
      return fail(res, 400, "WRONG_CODE", "That code is not correct.");
    }

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) return fail(res, 400, "WRONG_CODE", "That code is not correct.");

    await prisma.user.update({
      where: { id: user.id },
      data: { emailVerifiedAt: user.emailVerifiedAt ?? new Date(), failedLoginCount: 0, lockedUntil: null },
    });
    const fresh = await prisma.user.findUnique({ where: { id: user.id }, include: USER_INCLUDE });
    const accessToken = await startSession(req, res, fresh);
    return res.json({ success: true, data: { user: await serializeUser(fresh), accessToken } });
  } catch (err) {
    return serverError(res, "verify-email", err);
  }
});

emailPasswordRouter.post("/resend-code", codeLimit, async (req: Request, res: Response) => {
  try {
    const email = normalizeEmail(req.body?.email);
    if (isValidEmail(email)) {
      const user = await prisma.user.findUnique({ where: { email } });
      if (user && !user.emailVerifiedAt && user.passwordHash) {
        try {
          const code = await issueCode(email, "EMAIL_VERIFY");
          await sendVerificationCode(email, code);
        } catch (err) {
          if (!(err instanceof CodeCooldownError)) throw err;
        }
      }
    }
    return res.json({ success: true, message: "If a code is needed, we have sent one." });
  } catch (err) {
    return serverError(res, "resend-code", err);
  }
});

// -------------------------------------------------------------------- log in
emailPasswordRouter.post("/login", loginLimit, async (req: Request, res: Response) => {
  try {
    const email = normalizeEmail(req.body?.email);
    const password = typeof req.body?.password === "string" ? req.body.password : "";
    const badLogin = () =>
      fail(
        res,
        401,
        "INVALID_CREDENTIALS",
        "Incorrect email or password, or too many attempts. If you usually sign in with Google, use that button or choose Forgot password."
      );

    if (!isValidEmail(email) || !password || password.length > 128) return badLogin();

    const user = await prisma.user.findUnique({ where: { email } });
    const locked = !!user?.lockedUntil && user.lockedUntil.getTime() > Date.now();
    if (!user || !user.passwordHash || locked) {
      await burnPasswordCheck(password); // same work for unknown accounts, so timing gives nothing away
      return badLogin();
    }

    const ok = await verifyPassword(password, user.passwordHash);
    if (!ok) {
      const fails = user.failedLoginCount + 1;
      const lockNow = fails >= LOGIN_MAX_FAILS;
      await prisma.user.update({
        where: { id: user.id },
        data: {
          failedLoginCount: lockNow ? 0 : fails,
          lockedUntil: lockNow ? new Date(Date.now() + LOGIN_LOCK_MS) : null,
        },
      });
      return badLogin();
    }

    if (!user.emailVerifiedAt) {
      // Correct password, but the address was never confirmed: send a fresh code.
      try {
        const code = await issueCode(email, "EMAIL_VERIFY");
        await sendVerificationCode(email, code);
      } catch (err) {
        if (!(err instanceof CodeCooldownError)) throw err;
      }
      return fail(res, 403, "EMAIL_NOT_VERIFIED", "Please confirm your email first. We sent a new 6-digit code.");
    }

    await prisma.user.update({ where: { id: user.id }, data: { failedLoginCount: 0, lockedUntil: null } });
    const fresh = await prisma.user.findUnique({ where: { id: user.id }, include: USER_INCLUDE });
    const accessToken = await startSession(req, res, fresh);
    return res.json({ success: true, data: { user: await serializeUser(fresh), accessToken } });
  } catch (err) {
    return serverError(res, "login", err);
  }
});

// ------------------------------------------------------------ forgot password
emailPasswordRouter.post("/forgot-password", forgotLimit, async (req: Request, res: Response) => {
  const reply = { success: true, message: "If an account exists for this email, we have sent a 6-digit reset code." };
  try {
    const email = normalizeEmail(req.body?.email);
    if (isValidEmail(email)) {
      const user = await prisma.user.findUnique({ where: { email } });
      if (user) {
        try {
          const code = await issueCode(email, "PASSWORD_RESET");
          const sent = await sendPasswordResetCode(email, code);
          if (!sent && process.env.NODE_ENV !== "production") {
            console.warn(`[email-auth] (development) reset code for ${email}: ${code}`);
          }
        } catch (err) {
          if (!(err instanceof CodeCooldownError)) throw err;
        }
      }
    }
    return res.json(reply); // identical whether or not the account exists
  } catch (err) {
    console.error("[email-auth] forgot-password:", err);
    return res.json(reply);
  }
});

emailPasswordRouter.post("/reset-password", codeLimit, async (req: Request, res: Response) => {
  try {
    const email = normalizeEmail(req.body?.email);
    const code = String(req.body?.code ?? "").trim();
    const newPassword = req.body?.newPassword;
    if (!isValidEmail(email) || !/^\d{6}$/.test(code)) {
      return fail(res, 400, "INVALID_INPUT", "Enter the 6-digit code from your email.");
    }
    const passwordProblem = validatePassword(newPassword, email);
    if (passwordProblem) return fail(res, 400, "WEAK_PASSWORD", passwordProblem);

    const result = await consumeCode(email, "PASSWORD_RESET", code);
    if (result === "EXPIRED") {
      return fail(res, 400, "CODE_EXPIRED", "This code has expired. Please request a new one.");
    }
    if (result === "TOO_MANY_ATTEMPTS") {
      return fail(res, 429, "TOO_MANY_ATTEMPTS", `Too many wrong tries (${CODE_MAX_ATTEMPTS} allowed). Please request a new code.`);
    }
    if (result !== "OK") {
      return fail(res, 400, "WRONG_CODE", "That code is not correct.");
    }

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) return fail(res, 400, "WRONG_CODE", "That code is not correct.");

    const now = new Date();
    await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash: await hashPassword(newPassword),
        emailVerifiedAt: user.emailVerifiedAt ?? now, // the code proves they own this inbox
        refreshTokenHash: null, // signs out every device
        sessionsValidFrom: now, // and cancels access tokens issued before this moment
        failedLoginCount: 0,
        lockedUntil: null,
      },
    });
    return res.json({ success: true, message: "Your password has been changed. Please sign in." });
  } catch (err) {
    return serverError(res, "reset-password", err);
  }
});
