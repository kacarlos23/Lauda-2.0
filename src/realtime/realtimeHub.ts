import crypto from "node:crypto";
import { EventEmitter } from "node:events";
import { createClient, type RedisClientType } from "redis";
import { config } from "../config/unifiedConfig";
import { logger } from "../observability/logger";

const CHANNEL = "lauda:realtime:notifications";
const localEmitter = new EventEmitter();
localEmitter.setMaxListeners(0);

type TicketIdentity = {
  userId: string;
  tenantId: string;
  sessionId: string;
  expiresAt: number;
};

export type RealtimeNotificationEnvelope = {
  version: 1;
  type: "notification.created";
  notificationId: string;
  userId: string;
  tenantId: string;
  occurredAt: string;
  data: Record<string, unknown>;
};

let publisher: RedisClientType | null = null;
let subscriber: RedisClientType | null = null;
let initializing: Promise<void> | null = null;
const localTickets = new Map<string, TicketIdentity>();

function ticketKey(ticket: string) {
  return `lauda:realtime:ticket:${ticket}`;
}

function emitLocally(envelope: RealtimeNotificationEnvelope) {
  localEmitter.emit(`user:${envelope.userId}`, envelope);
}

export async function initializeRealtimeHub(): Promise<void> {
  if (initializing) return initializing;
  initializing = (async () => {
    if (!config.realtime.enabled || !config.realtime.redisUrl) return;
    try {
      publisher = createClient({ url: config.realtime.redisUrl, disableOfflineQueue: true });
      subscriber = publisher.duplicate();
      publisher.on("error", (error) => logger.error("realtime_redis_publisher_error", { component: "realtime", errorName: error.name }));
      subscriber.on("error", (error) => logger.error("realtime_redis_subscriber_error", { component: "realtime", errorName: error.name }));
      await Promise.all([publisher.connect(), subscriber.connect()]);
      await subscriber.subscribe(CHANNEL, (message) => {
        try {
          emitLocally(JSON.parse(message) as RealtimeNotificationEnvelope);
        } catch {
          logger.warn("realtime_invalid_redis_message", { category: "observability", component: "realtime" });
        }
      });
      logger.info("realtime_redis_ready", { category: "observability", component: "realtime", outcome: "ready" });
    } catch (error) {
      publisher = null;
      subscriber = null;
      logger.error("realtime_redis_unavailable", {
        category: "observability",
        component: "realtime",
        outcome: "degraded",
        errorName: error instanceof Error ? error.name : "unknown",
      });
    }
  })();
  return initializing;
}

export async function publishRealtimeNotification(envelope: RealtimeNotificationEnvelope): Promise<void> {
  await initializeRealtimeHub();
  if (publisher?.isReady) {
    await publisher.publish(CHANNEL, JSON.stringify(envelope));
    return;
  }
  emitLocally(envelope);
}

export function subscribeRealtimeUser(
  userId: string,
  listener: (envelope: RealtimeNotificationEnvelope) => void,
): () => void {
  const key = `user:${userId}`;
  localEmitter.on(key, listener);
  return () => localEmitter.off(key, listener);
}

export async function issueRealtimeTicket(identity: Omit<TicketIdentity, "expiresAt">): Promise<string> {
  await initializeRealtimeHub();
  const ticket = crypto.randomBytes(32).toString("base64url");
  const record: TicketIdentity = {
    ...identity,
    expiresAt: Date.now() + config.realtime.ticketTtlSeconds * 1000,
  };
  if (publisher?.isReady) {
    await publisher.set(ticketKey(ticket), JSON.stringify(record), { EX: config.realtime.ticketTtlSeconds, NX: true });
  } else {
    const now = Date.now();
    for (const [key, value] of localTickets) {
      if (value.expiresAt <= now) localTickets.delete(key);
    }
    localTickets.set(ticket, record);
  }
  return ticket;
}

export async function consumeRealtimeTicket(ticket: string): Promise<TicketIdentity | null> {
  await initializeRealtimeHub();
  let record: TicketIdentity | null = null;
  if (publisher?.isReady) {
    const raw = await publisher.getDel(ticketKey(ticket));
    if (raw) record = JSON.parse(raw) as TicketIdentity;
  } else {
    record = localTickets.get(ticket) ?? null;
    localTickets.delete(ticket);
  }
  if (!record || record.expiresAt <= Date.now()) return null;
  return record;
}

export async function closeRealtimeHub(): Promise<void> {
  await Promise.allSettled([
    subscriber?.isOpen ? subscriber.quit() : Promise.resolve(),
    publisher?.isOpen ? publisher.quit() : Promise.resolve(),
  ]);
  subscriber = null;
  publisher = null;
  initializing = null;
}
