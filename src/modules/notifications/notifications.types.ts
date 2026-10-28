import { z } from "zod";

export const SubscribePushSchema = z.object({
  endpoint: z.string().url(),
  keys: z.object({
    p256dh: z.string(),
    auth: z.string(),
  }),
  drillTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/).default("21:00"),
});

export const SnoozeNotificationSchema = z.object({
  notificationId: z.string().optional(),
  snoozeMinutes: z.number().int().min(5).max(1440).default(60),
});

export type SubscribePushInput = z.infer<typeof SubscribePushSchema>;
export type SnoozeNotificationInput = z.infer<typeof SnoozeNotificationSchema>;
