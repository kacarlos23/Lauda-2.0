import { NotificationType, Prisma, PushDeliveryStatus } from "@prisma/client";
import { basePrisma } from "../config/prisma";
import { config } from "../config/unifiedConfig";
import { logger } from "../observability/logger";
import { publishRealtimeNotification } from "../realtime/realtimeHub";

export type NotificationDraft = {
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  payload?: Record<string, unknown>;
};

export type DomainEventInput = {
  tenantId: string;
  actorId?: string | null;
  type: string;
  aggregateType: string;
  aggregateId: string;
  notifications: NotificationDraft[];
  payload?: Record<string, unknown>;
};

type OutboxPayload = {
  notifications: NotificationDraft[];
  data?: Record<string, unknown>;
};

type PrismaWriter = Prisma.TransactionClient | typeof basePrisma;

export function enqueueDomainEvent(writer: PrismaWriter, input: DomainEventInput) {
  const uniqueNotifications = Array.from(
    new Map(input.notifications.map((notification) => [notification.userId, notification])).values(),
  );
  return writer.domainEventOutbox.create({
    data: {
      tenantId: input.tenantId,
      actorId: input.actorId ?? null,
      type: input.type,
      aggregateType: input.aggregateType,
      aggregateId: input.aggregateId,
      payload: {
        notifications: uniqueNotifications,
        data: input.payload ?? {},
      } as Prisma.InputJsonValue,
    },
  });
}

function notificationExpiresAt() {
  const expiresAt = new Date();
  expiresAt.setUTCDate(expiresAt.getUTCDate() + config.notifications.retentionDays);
  return expiresAt;
}

function retryAt(attempts: number) {
  const delayMs = Math.min(60_000, 1_000 * (2 ** Math.min(attempts, 6)));
  return new Date(Date.now() + delayMs);
}

async function projectEvent(event: {
  id: string;
  tenantId: string;
  actorId: string | null;
  type: string;
  aggregateType: string;
  aggregateId: string;
  occurredAt: Date;
  payload: Prisma.JsonValue;
}) {
  const payload = event.payload as unknown as OutboxPayload;
  const drafts = Array.isArray(payload.notifications) ? payload.notifications : [];
  const notifications = await basePrisma.$transaction(async (tx) => {
    const projected = [];
    for (const draft of drafts) {
      const notification = await tx.notification.upsert({
        where: { eventId_userId: { eventId: event.id, userId: draft.userId } },
        update: {},
        create: {
          tenantId: event.tenantId,
          userId: draft.userId,
          actorId: event.actorId,
          eventId: event.id,
          type: draft.type,
          resourceType: event.aggregateType,
          resourceId: event.aggregateId,
          title: draft.title,
          body: draft.body,
          payload: (draft.payload ?? {}) as Prisma.InputJsonValue,
          expiresAt: notificationExpiresAt(),
        },
        include: { actor: { select: { id: true, name: true } } },
      });
      const devices = config.notifications.pushEnabled
        ? await tx.pushDevice.findMany({
            where: { tenantId: event.tenantId, userId: draft.userId, enabled: true, disabledAt: null },
            select: { id: true },
          })
        : [];
      if (devices.length) {
        await tx.pushDelivery.createMany({
          data: devices.map((device) => ({ notificationId: notification.id, pushDeviceId: device.id })),
          skipDuplicates: true,
        });
      }
      projected.push(notification);
    }
    return projected;
  });

  for (const notification of notifications) {
    await publishRealtimeNotification({
      version: 1,
      type: "notification.created",
      notificationId: notification.id,
      userId: notification.userId,
      tenantId: notification.tenantId,
      occurredAt: event.occurredAt.toISOString(),
      data: {
        id: notification.id,
        type: notification.type,
        title: notification.title,
        body: notification.body,
        resourceType: notification.resourceType,
        resourceId: notification.resourceId,
        payload: notification.payload,
        readAt: notification.readAt?.toISOString() ?? null,
        createdAt: notification.createdAt.toISOString(),
        actor: notification.actor,
      },
    });
  }
}

async function processPushDeliveries() {
  if (!config.notifications.pushEnabled) return;
  const deliveries = await basePrisma.pushDelivery.findMany({
    where: {
      status: { in: [PushDeliveryStatus.PENDING, PushDeliveryStatus.FAILED] },
      nextAttemptAt: { lte: new Date() },
      attempts: { lt: 8 },
      pushDevice: { enabled: true, disabledAt: null },
    },
    take: 100,
    orderBy: { createdAt: "asc" },
    include: { pushDevice: true, notification: true },
  });
  if (!deliveries.length) return;

  let response: Response;
  try {
    response = await fetch("https://exp.host/--/api/v2/push/send", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(config.notifications.expoAccessToken
          ? { Authorization: `Bearer ${config.notifications.expoAccessToken}` }
          : {}),
      },
      body: JSON.stringify(deliveries.map((delivery) => ({
        to: delivery.pushDevice.expoPushToken,
        title: "Atualização no Lauda",
        body: "Abra o aplicativo para consultar uma nova atualização.",
        sound: "default",
        channelId: "schedules",
        data: {
          notificationId: delivery.notificationId,
          type: delivery.notification.type,
          resourceType: delivery.notification.resourceType,
          resourceId: delivery.notification.resourceId,
        },
      }))),
    });
    if (!response.ok) throw new Error(`Expo push respondeu ${response.status}`);
  } catch (error) {
    await Promise.all(deliveries.map((delivery) => basePrisma.pushDelivery.update({
      where: { id: delivery.id },
      data: {
        status: "FAILED",
        attempts: { increment: 1 },
        nextAttemptAt: retryAt(delivery.attempts + 1),
        lastError: (error instanceof Error ? error.message : "Falha temporária no Expo Push").slice(0, 500),
      },
    })));
    logger.warn("push_batch_failed", {
      category: "observability",
      component: "expo-push",
      outcome: "retry_scheduled",
      deliveries: deliveries.length,
      failures: deliveries.length,
      errorName: error instanceof Error ? error.name : "unknown",
    });
    return;
  }
  const result = await response.json() as { data?: Array<{ status: "ok" | "error"; id?: string; message?: string; details?: { error?: string } }> };
  const tickets = result.data ?? [];
  await Promise.all(deliveries.map(async (delivery, index) => {
    const ticket = tickets[index];
    if (ticket?.status === "ok" && ticket.id) {
      await basePrisma.pushDelivery.update({
        where: { id: delivery.id },
        data: { status: "SENT", ticketId: ticket.id, attempts: { increment: 1 }, sentAt: new Date(), lastError: null },
      });
      return;
    }
    const invalid = ticket?.details?.error === "DeviceNotRegistered";
    await basePrisma.$transaction([
      basePrisma.pushDelivery.update({
        where: { id: delivery.id },
        data: {
          status: invalid ? "DEVICE_INVALID" : "FAILED",
          attempts: { increment: 1 },
          nextAttemptAt: retryAt(delivery.attempts + 1),
          lastError: (ticket?.message ?? "Falha no envio Expo").slice(0, 500),
        },
      }),
      ...(invalid ? [basePrisma.pushDevice.update({
        where: { id: delivery.pushDeviceId },
        data: { enabled: false, disabledAt: new Date() },
      })] : []),
    ]);
  }));
  const failures = tickets.filter((ticket) => ticket?.status === "error").length;
  logger.info("push_batch_processed", {
    category: "observability",
    component: "expo-push",
    outcome: failures ? "partial" : "sent",
    deliveries: deliveries.length,
    failures,
  });
}

async function checkPushReceipts() {
  if (!config.notifications.pushEnabled) return;
  const cutoff = new Date(Date.now() - 15 * 60 * 1000);
  const deliveries = await basePrisma.pushDelivery.findMany({
    where: { status: "SENT", receiptCheckedAt: null, ticketId: { not: null }, sentAt: { lte: cutoff } },
    take: 1000,
    include: { pushDevice: true },
  });
  if (!deliveries.length) return;
  const response = await fetch("https://exp.host/--/api/v2/push/getReceipts", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(config.notifications.expoAccessToken
        ? { Authorization: `Bearer ${config.notifications.expoAccessToken}` }
        : {}),
    },
    body: JSON.stringify({ ids: deliveries.map((delivery) => delivery.ticketId) }),
  });
  if (!response.ok) throw new Error(`Expo receipts respondeu ${response.status}`);
  const result = await response.json() as { data?: Record<string, { status: "ok" | "error"; message?: string; details?: { error?: string } }> };
  for (const delivery of deliveries) {
    const receipt = delivery.ticketId ? result.data?.[delivery.ticketId] : undefined;
    if (!receipt) continue;
    const invalid = receipt.details?.error === "DeviceNotRegistered";
    await basePrisma.$transaction([
      basePrisma.pushDelivery.update({
        where: { id: delivery.id },
        data: {
          status: receipt.status === "ok" ? "DELIVERED" : invalid ? "DEVICE_INVALID" : "FAILED",
          receiptCheckedAt: new Date(),
          lastError: receipt.status === "error" ? (receipt.message ?? "Falha no recibo Expo").slice(0, 500) : null,
        },
      }),
      ...(invalid ? [basePrisma.pushDevice.update({
        where: { id: delivery.pushDeviceId },
        data: { enabled: false, disabledAt: new Date() },
      })] : []),
    ]);
  }
  const resolvedReceipts = deliveries.filter((delivery) => delivery.ticketId && result.data?.[delivery.ticketId]).length;
  const failures = deliveries.filter((delivery) => {
    const receipt = delivery.ticketId ? result.data?.[delivery.ticketId] : undefined;
    return receipt?.status === "error";
  }).length;
  logger.info("push_receipts_processed", {
    category: "observability",
    component: "expo-push",
    outcome: failures ? "partial" : "processed",
    receipts: resolvedReceipts,
    failures,
  });
}

let activeRun: Promise<void> | null = null;
let followUpRequested = false;
let timer: NodeJS.Timeout | null = null;

async function claimOutboxEvents() {
  return basePrisma.$transaction(async (tx) => {
    const rows = await tx.$queryRaw<Array<{ id: string }>>(Prisma.sql`
      SELECT "id"
      FROM "DomainEventOutbox"
      WHERE "publishedAt" IS NULL AND "nextAttemptAt" <= NOW()
      ORDER BY "occurredAt" ASC
      FOR UPDATE SKIP LOCKED
      LIMIT 25
    `);
    const ids = rows.map((row) => row.id);
    if (!ids.length) return [];
    await tx.domainEventOutbox.updateMany({
      where: { id: { in: ids }, publishedAt: null },
      data: { nextAttemptAt: new Date(Date.now() + 2 * 60_000), attempts: { increment: 1 } },
    });
    return tx.domainEventOutbox.findMany({ where: { id: { in: ids } }, orderBy: { occurredAt: "asc" } });
  });
}

async function processOutboxBatch() {
  try {
    const events = await claimOutboxEvents();
    if (events.length) {
      const backlog = await basePrisma.domainEventOutbox.count({ where: { publishedAt: null } });
      logger.info("outbox_batch_claimed", {
        category: "observability",
        component: "outbox-dispatcher",
        outcome: "processing",
        backlog,
        attempts: events.reduce((total, event) => total + event.attempts, 0),
        latencyMs: Date.now() - events[0].occurredAt.getTime(),
      });
    }
    for (const event of events) {
      try {
        await projectEvent(event);
        await basePrisma.domainEventOutbox.update({
          where: { id: event.id },
          data: { publishedAt: new Date(), lastError: null },
        });
      } catch (error) {
        await basePrisma.domainEventOutbox.update({
          where: { id: event.id },
          data: {
            nextAttemptAt: retryAt(event.attempts),
            lastError: (error instanceof Error ? error.message : "Falha desconhecida").slice(0, 1000),
          },
        });
      }
    }
    await processPushDeliveries();
    await checkPushReceipts();
    await basePrisma.notification.deleteMany({ where: { expiresAt: { lte: new Date() } } });
  } catch (error) {
    logger.error("outbox_dispatch_failed", {
      category: "observability",
      component: "outbox-dispatcher",
      outcome: "failed",
      errorName: error instanceof Error ? error.name : "unknown",
    });
  }
}

export async function processOutboxOnce() {
  if (activeRun) {
    followUpRequested = true;
    await activeRun;
    return;
  }

  const runPromise = (async () => {
    do {
      followUpRequested = false;
      await processOutboxBatch();
    } while (followUpRequested);
  })().finally(() => {
    if (activeRun === runPromise) activeRun = null;
  });

  activeRun = runPromise;
  await runPromise;
}

export function startOutboxDispatcher() {
  if (timer) return;
  void processOutboxOnce();
  timer = setInterval(() => void processOutboxOnce(), config.realtime.outboxPollMs);
  timer.unref();
}

export function stopOutboxDispatcher() {
  if (timer) clearInterval(timer);
  timer = null;
}
