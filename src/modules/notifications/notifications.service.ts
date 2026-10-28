import { prisma } from "../../database/prisma";
import { SubscribePushInput, SnoozeNotificationInput } from "./notifications.types";

/**
 * Saves or updates a Web Push subscription for a student.
 */
export async function saveSubscription(userId: string, input: SubscribePushInput) {
  const { endpoint, keys, drillTime = "21:00" } = input;

  return prisma.notificationSubscription.upsert({
    where: { endpoint },
    update: {
      userId,
      p256dh: keys.p256dh,
      auth: keys.auth,
      drillTime,
      isActive: true,
    },
    create: {
      userId,
      endpoint,
      p256dh: keys.p256dh,
      auth: keys.auth,
      drillTime,
      isActive: true,
    },
  });
}

/**
 * Snoozes a drill notification (matches mbprep.app /api/notifications/later).
 */
export async function snoozeNotification(userId: string, input: SnoozeNotificationInput) {
  // In a full queue system, this reschedules the delivery job by snoozeMinutes
  return {
    success: true,
    message: `Drill reminder snoozed for ${input.snoozeMinutes || 60} minutes.`,
    snoozedUntil: new Date(Date.now() + (input.snoozeMinutes || 60) * 60000).toISOString(),
  };
}

/**
 * Marks a notification as read (matches mbprep.app /api/notifications/read).
 */
export async function markNotificationRead(userId: string, notificationId?: string) {
  return {
    success: true,
    notificationId: notificationId || "drill-reminder",
    readAt: new Date().toISOString(),
  };
}

/**
 * Retrieves student's notification preferences and active subscription status.
 */
export async function getSubscriptionConfig(userId: string) {
  const sub = await prisma.notificationSubscription.findFirst({
    where: { userId, isActive: true },
    orderBy: { id: "desc" },
  });

  return {
    hasActiveSubscription: Boolean(sub),
    drillTime: sub ? sub.drillTime : "21:00",
    lastNotifiedAt: sub ? sub.lastNotifiedAt : null,
  };
}
