import crypto from "crypto";
import { prisma } from "../database/prisma";

export type CodePurpose = "EMAIL_VERIFY" | "PASSWORD_RESET";

export const CODE_TTL_MS = 15 * 60 * 1000; // codes last 15 minutes
export const CODE_COOLDOWN_MS = 45 * 1000; // one new code per 45 seconds per email+purpose
export const CODE_MAX_ATTEMPTS = 5; // wrong guesses allowed per code

function getSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.trim() === "") {
    if (process.env.NODE_ENV === "production") {
      throw new Error("JWT_SECRET environment variable is required in production mode.");
    }
    return "dev-only-jwt-secret-do-not-use-in-production";
  }
  return secret;
}

export function generateCode(): string {
  return String(crypto.randomInt(0, 1_000_000)).padStart(6, "0");
}

export function hashCode(email: string, purpose: CodePurpose, code: string): string {
  return crypto.createHmac("sha256", getSecret()).update(`${purpose}:${email}:${code}`).digest("hex");
}

export class CodeCooldownError extends Error {
  constructor() {
    super("Please wait a moment before requesting another code.");
  }
}

/** Creates a fresh code (retiring older unused ones). Throws CodeCooldownError if asked too soon. */
export async function issueCode(email: string, purpose: CodePurpose): Promise<string> {
  const latest = await prisma.authCode.findFirst({
    where: { email, purpose },
    orderBy: { createdAt: "desc" },
    select: { createdAt: true },
  });
  if (latest && Date.now() - latest.createdAt.getTime() < CODE_COOLDOWN_MS) {
    throw new CodeCooldownError();
  }

  await prisma.authCode.updateMany({
    where: { email, purpose, usedAt: null },
    data: { usedAt: new Date() },
  });

  const code = generateCode();
  await prisma.authCode.create({
    data: {
      email,
      purpose,
      codeHash: hashCode(email, purpose, code),
      expiresAt: new Date(Date.now() + CODE_TTL_MS),
    },
  });
  return code;
}

export type ConsumeResult = "OK" | "INVALID" | "EXPIRED" | "TOO_MANY_ATTEMPTS";

/** Checks a code. A correct code is used up; a wrong one counts against the attempt limit. */
export async function consumeCode(email: string, purpose: CodePurpose, code: string): Promise<ConsumeResult> {
  const record = await prisma.authCode.findFirst({
    where: { email, purpose, usedAt: null },
    orderBy: { createdAt: "desc" },
  });
  if (!record) return "INVALID";
  if (record.expiresAt.getTime() < Date.now()) return "EXPIRED";
  if (record.attempts >= CODE_MAX_ATTEMPTS) return "TOO_MANY_ATTEMPTS";

  const given = Buffer.from(hashCode(email, purpose, code), "hex");
  const expected = Buffer.from(record.codeHash, "hex");
  const matches = given.length === expected.length && crypto.timingSafeEqual(given, expected);

  if (!matches) {
    await prisma.authCode.update({
      where: { id: record.id },
      data: { attempts: { increment: 1 } },
    });
    return "INVALID";
  }

  // Mark used only if nobody else used it first (guards against a double submit).
  const claimed = await prisma.authCode.updateMany({
    where: { id: record.id, usedAt: null },
    data: { usedAt: new Date() },
  });
  return claimed.count === 1 ? "OK" : "INVALID";
}
