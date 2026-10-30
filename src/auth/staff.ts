import { Router, Request, Response, NextFunction } from "express";
import { prisma } from "../database/prisma";
import { AuthenticatedRequest, authenticateToken } from "./auth.middleware";
import {
  MAX_EXTRA_ADMINS,
  normalizeEmail,
  isValidEmail,
  isGmailAddress,
  remainingAdminSlots,
  canAddAnotherAdmin,
} from "./staffRules";

export type StaffRole = "owner" | "admin";

/**
 * The owner is the address in OWNER_EMAIL (set it on Render and in your local .env).
 * The owner can add up to MAX_EXTRA_ADMINS more admins from inside the app (stored in StaffMember).
 * If OWNER_EMAIL is not set, nobody is an owner and only stored admins have access (fail closed).
 */
export function getOwnerEmail(): string | null {
  const value = normalizeEmail(process.env.OWNER_EMAIL);
  return value || null;
}

/**
 * Staff access needs a VERIFIED email: Google confirmed it, or the person typed the code we emailed.
 * That stops anyone from gaining admin rights by simply registering an admin's address.
 */
export async function getStaffRole(user: {
  email?: string | null;
  emailVerifiedAt?: Date | null;
}): Promise<StaffRole | null> {
  if (!user || !user.email || !user.emailVerifiedAt) return null;
  const email = normalizeEmail(user.email);
  if (email === getOwnerEmail()) return "owner";
  const member = await prisma.staffMember.findUnique({ where: { email } });
  return member ? "admin" : null;
}

/** Guards admin-only routes. Always re-reads the user from the database; never trusts token claims or the fallback store. */
export async function requireAdmin(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const authed = await authenticateToken(req, res);
    if (!authed) {
      return res.status(401).json({
        success: false,
        error: "UNAUTHORIZED",
        message: "Please sign in to continue.",
      });
    }
    const dbUser = await prisma.user.findUnique({
      where: { id: authed.id },
      select: { email: true, emailVerifiedAt: true },
    });
    const role = dbUser ? await getStaffRole(dbUser) : null;
    if (!role) {
      return res.status(403).json({
        success: false,
        error: "FORBIDDEN",
        message: "This area is only for BlastExams admins.",
      });
    }
    (req as any).staffRole = role;
    (req as any).staffEmail = normalizeEmail(dbUser?.email);
    return next();
  } catch (err) {
    console.error("[requireAdmin] check failed:", err);
    return res.status(500).json({ success: false, error: "SERVER_ERROR", message: "Could not verify admin access." });
  }
}

export const staffRouter = Router();

// GET /api/admin/staff - who the admins are and how many slots are left
staffRouter.get("/", requireAdmin, async (req: Request, res: Response) => {
  try {
    const members = await prisma.staffMember.findMany({ orderBy: { createdAt: "asc" } });
    return res.json({
      success: true,
      data: {
        owner: getOwnerEmail(),
        admins: members.map((m) => ({ id: m.id, email: m.email, addedBy: m.addedBy, createdAt: m.createdAt })),
        maxExtraAdmins: MAX_EXTRA_ADMINS,
        remainingSlots: remainingAdminSlots(members.length),
        yourRole: (req as any).staffRole as StaffRole,
        canRemove: (req as any).staffRole === "owner",
      },
    });
  } catch (err) {
    console.error("[staff] list failed:", err);
    return res.status(500).json({ success: false, error: "SERVER_ERROR", message: "Could not load the admin list." });
  }
});

// POST /api/admin/staff { email } - add another admin (Gmail address), up to MAX_EXTRA_ADMINS
staffRouter.post("/", requireAdmin, async (req: Request, res: Response) => {
  const email = normalizeEmail(req.body?.email);
  if (!isValidEmail(email) || !isGmailAddress(email)) {
    return res.status(400).json({
      success: false,
      error: "INVALID_EMAIL",
      message: "Enter a valid Gmail address (name@gmail.com).",
    });
  }
  if (email === getOwnerEmail()) {
    return res.status(409).json({ success: false, error: "ALREADY_ADMIN", message: "That person is already the owner." });
  }

  try {
    const created = await prisma.$transaction(
      async (tx) => {
        const existing = await tx.staffMember.findUnique({ where: { email } });
        if (existing) return { kind: "EXISTS" as const };
        const count = await tx.staffMember.count();
        if (!canAddAnotherAdmin(count)) return { kind: "LIMIT" as const };
        const member = await tx.staffMember.create({
          data: { email, addedBy: (req as any).staffEmail || "unknown" },
        });
        return { kind: "OK" as const, member };
      },
      { isolationLevel: "Serializable" }
    );

    if (created.kind === "EXISTS") {
      return res.status(409).json({ success: false, error: "ALREADY_ADMIN", message: "That person is already an admin." });
    }
    if (created.kind === "LIMIT") {
      return res.status(409).json({
        success: false,
        error: "LIMIT_REACHED",
        message: `You can have at most ${MAX_EXTRA_ADMINS} extra admins. Remove one first.`,
      });
    }
    console.log(`[staff] ${(req as any).staffEmail} added admin ${email}`);
    return res.status(201).json({
      success: true,
      data: { id: created.member.id, email: created.member.email, addedBy: created.member.addedBy, createdAt: created.member.createdAt },
    });
  } catch (err) {
    console.error("[staff] add failed:", err);
    return res.status(500).json({ success: false, error: "SERVER_ERROR", message: "Could not add the admin. Please try again." });
  }
});

// DELETE /api/admin/staff/:id - only the owner can remove an admin
staffRouter.delete("/:id", requireAdmin, async (req: Request, res: Response) => {
  if ((req as any).staffRole !== "owner") {
    return res.status(403).json({ success: false, error: "FORBIDDEN", message: "Only the owner can remove admins." });
  }
  try {
    const removed = await prisma.staffMember.deleteMany({ where: { id: String(req.params.id) } });
    if (removed.count === 0) {
      return res.status(404).json({ success: false, error: "NOT_FOUND", message: "That admin was not found." });
    }
    console.log(`[staff] ${(req as any).staffEmail} removed admin ${req.params.id}`);
    return res.json({ success: true });
  } catch (err) {
    console.error("[staff] remove failed:", err);
    return res.status(500).json({ success: false, error: "SERVER_ERROR", message: "Could not remove the admin." });
  }
});
