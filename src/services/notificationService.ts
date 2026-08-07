import { prisma } from "../config/prisma";
import { NotFoundError, ValidationError } from "../errors/AppError";
import { issueRealtimeTicket } from "../realtime/realtimeHub";
import type { ListNotificationsInput, RegisterPushDeviceInput } from "../validators/notification.validator";

type NotificationUser = { id: string; tenantId: string; sessionId: string };

type Cursor = { createdAt: string; id: string };

function encodeCursor(cursor: Cursor) {
  return Buffer.from(JSON.stringify(cursor), "utf8").toString("base64url");
}

function decodeCursor(value?: string): Cursor | null {
  if (!value) return null;
  try {
    const cursor = JSON.parse(Buffer.from(value, "base64url").toString("utf8")) as Cursor;
    if (!cursor.id || Number.isNaN(new Date(cursor.createdAt).getTime())) throw new Error("invalid");
    return cursor;
  } catch {
    throw new ValidationError("Cursor de notificações inválido");
  }
}

export class NotificationService {
  async list(user: NotificationUser, input: ListNotificationsInput) {
    const cursor = decodeCursor(input.cursor);
    const now = new Date();
    const where = {
      tenantId: user.tenantId,
      userId: user.id,
      expiresAt: { gt: now },
      ...(input.unreadOnly ? { readAt: null } : {}),
      ...(cursor ? {
        OR: [
          { createdAt: { lt: new Date(cursor.createdAt) } },
          { createdAt: new Date(cursor.createdAt), id: { lt: cursor.id } },
        ],
      } : {}),
    };
    const [items, unreadCount] = await Promise.all([
      prisma.notification.findMany({
        where,
        take: input.limit + 1,
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        include: { actor: { select: { id: true, name: true } } },
      }),
      prisma.notification.count({
        where: { tenantId: user.tenantId, userId: user.id, readAt: null, expiresAt: { gt: now } },
      }),
    ]);
    const hasMore = items.length > input.limit;
    const page = items.slice(0, input.limit);
    const last = page.at(-1);
    return {
      items: page,
      unreadCount,
      nextCursor: hasMore && last ? encodeCursor({ createdAt: last.createdAt.toISOString(), id: last.id }) : null,
    };
  }

  async markRead(user: NotificationUser, notificationId: string) {
    const result = await prisma.notification.updateMany({
      where: { id: notificationId, tenantId: user.tenantId, userId: user.id, expiresAt: { gt: new Date() } },
      data: { readAt: new Date() },
    });
    if (result.count === 0) throw new NotFoundError("Notificação não encontrada");
    return prisma.notification.findUnique({ where: { id: notificationId } });
  }

  async markAllRead(user: NotificationUser) {
    const result = await prisma.notification.updateMany({
      where: { tenantId: user.tenantId, userId: user.id, readAt: null, expiresAt: { gt: new Date() } },
      data: { readAt: new Date() },
    });
    return { updated: result.count };
  }

  async registerDevice(user: NotificationUser, input: RegisterPushDeviceInput) {
    const device = await prisma.pushDevice.upsert({
      where: { expoPushToken: input.expoPushToken },
      update: {
        tenantId: user.tenantId,
        userId: user.id,
        platform: input.platform,
        appVersion: input.appVersion,
        enabled: true,
        disabledAt: null,
        lastSeenAt: new Date(),
      },
      create: {
        tenantId: user.tenantId,
        userId: user.id,
        expoPushToken: input.expoPushToken,
        platform: input.platform,
        appVersion: input.appVersion,
      },
      select: { id: true, platform: true, appVersion: true, enabled: true, lastSeenAt: true },
    });
    return device;
  }

  async removeDevice(user: NotificationUser, deviceId: string) {
    const result = await prisma.pushDevice.updateMany({
      where: { id: deviceId, tenantId: user.tenantId, userId: user.id },
      data: { enabled: false, disabledAt: new Date() },
    });
    if (result.count === 0) throw new NotFoundError("Dispositivo não encontrado");
    return { removed: true };
  }

  async issueTicket(user: NotificationUser) {
    const ticket = await issueRealtimeTicket({ userId: user.id, tenantId: user.tenantId, sessionId: user.sessionId });
    return { ticket };
  }
}
