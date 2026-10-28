import { Router, Response } from "express";
import { requireAuth, optionalAuth, AuthenticatedRequest } from "../../auth/auth.middleware";
import { SubscribePushSchema, SnoozeNotificationSchema } from "./notifications.types";
import {
  saveSubscription,
  snoozeNotification,
  markNotificationRead,
  getSubscriptionConfig,
} from "./notifications.service";

export const notificationsRouter = Router();

/**
 * POST /api/notifications/subscribe
 * Registers browser push credentials.
 */
notificationsRouter.post("/subscribe", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const parseResult = SubscribePushSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        success: false,
        message: "Invalid push subscription payload",
        errors: parseResult.error.issues,
      });
    }

    const userId = req.user!.id;
    const sub = await saveSubscription(userId, parseResult.data);
    res.json({ success: true, data: sub });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * POST /api/notifications/later
 * Snoozes a drill notification (matches mbprep.app behavior).
 */
notificationsRouter.post("/later", optionalAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const parseResult = SnoozeNotificationSchema.safeParse(req.body);
    const userId = req.user?.id || "guest";
    const result = await snoozeNotification(userId, parseResult.success ? parseResult.data : { snoozeMinutes: 60 });
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * POST /api/notifications/read
 * Marks notification as read.
 */
notificationsRouter.post("/read", optionalAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.id || "guest";
    const notificationId = req.body?.notificationId;
    const result = await markNotificationRead(userId, notificationId);
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * GET /api/notifications/config
 * Retrieves student's active drill schedule.
 */
notificationsRouter.get("/config", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const config = await getSubscriptionConfig(userId);
    res.json({ success: true, data: config });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});
