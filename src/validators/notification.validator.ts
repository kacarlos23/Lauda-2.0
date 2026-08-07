import { z } from "zod";

export const listNotificationsSchema = z.object({
  cursor: z.string().min(1).optional(),
  unreadOnly: z.enum(["true", "false"]).optional().transform((value) => value === "true"),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const notificationIdSchema = z.object({ id: z.string().uuid("ID de notificação inválido") });
export const pushDeviceIdSchema = z.object({ id: z.string().uuid("ID de dispositivo inválido") });

export const registerPushDeviceSchema = z.object({
  expoPushToken: z.string().trim().regex(/^Expo(nent)?PushToken\[[A-Za-z0-9_-]+\]$/, "Token Expo inválido"),
  platform: z.enum(["ANDROID", "IOS"]),
  appVersion: z.string().trim().max(50).optional(),
});

export type ListNotificationsInput = z.infer<typeof listNotificationsSchema>;
export type RegisterPushDeviceInput = z.infer<typeof registerPushDeviceSchema>;
