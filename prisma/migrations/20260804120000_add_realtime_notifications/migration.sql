CREATE TYPE "NotificationType" AS ENUM (
  'SCHEDULE_ASSIGNED',
  'SCHEDULE_UPDATED',
  'SCHEDULE_CANCELLED',
  'ASSIGNMENT_ROLE_CHANGED',
  'ASSIGNMENT_REMOVED',
  'ASSIGNMENT_ACCEPTED',
  'ASSIGNMENT_DECLINED',
  'SUBSTITUTION_REQUESTED',
  'SUBSTITUTION_RESOLVED'
);

CREATE TYPE "PushPlatform" AS ENUM ('ANDROID', 'IOS');
CREATE TYPE "PushDeliveryStatus" AS ENUM ('PENDING', 'SENT', 'DELIVERED', 'FAILED', 'DEVICE_INVALID');

ALTER TABLE "Schedule" ADD COLUMN "createdById" TEXT;
CREATE INDEX "Schedule_createdById_idx" ON "Schedule"("createdById");
ALTER TABLE "Schedule"
  ADD CONSTRAINT "Schedule_createdById_fkey"
  FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "DomainEventOutbox" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "actorId" TEXT,
  "type" TEXT NOT NULL,
  "aggregateType" TEXT NOT NULL,
  "aggregateId" TEXT NOT NULL,
  "payload" JSONB NOT NULL,
  "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "publishedAt" TIMESTAMP(3),
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "nextAttemptAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastError" TEXT,
  CONSTRAINT "DomainEventOutbox_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Notification" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "actorId" TEXT,
  "eventId" TEXT NOT NULL,
  "type" "NotificationType" NOT NULL,
  "resourceType" TEXT NOT NULL,
  "resourceId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "payload" JSONB NOT NULL,
  "readAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PushDevice" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "expoPushToken" TEXT NOT NULL,
  "platform" "PushPlatform" NOT NULL,
  "appVersion" TEXT,
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "disabledAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PushDevice_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PushDelivery" (
  "id" TEXT NOT NULL,
  "notificationId" TEXT NOT NULL,
  "pushDeviceId" TEXT NOT NULL,
  "status" "PushDeliveryStatus" NOT NULL DEFAULT 'PENDING',
  "ticketId" TEXT,
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "nextAttemptAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastError" TEXT,
  "sentAt" TIMESTAMP(3),
  "receiptCheckedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PushDelivery_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Notification_eventId_userId_key" ON "Notification"("eventId", "userId");
CREATE INDEX "Notification_tenantId_userId_createdAt_idx" ON "Notification"("tenantId", "userId", "createdAt");
CREATE INDEX "Notification_userId_readAt_createdAt_idx" ON "Notification"("userId", "readAt", "createdAt");
CREATE INDEX "Notification_expiresAt_idx" ON "Notification"("expiresAt");
CREATE INDEX "DomainEventOutbox_publishedAt_nextAttemptAt_idx" ON "DomainEventOutbox"("publishedAt", "nextAttemptAt");
CREATE INDEX "DomainEventOutbox_tenantId_aggregateType_aggregateId_idx" ON "DomainEventOutbox"("tenantId", "aggregateType", "aggregateId");
CREATE UNIQUE INDEX "PushDevice_expoPushToken_key" ON "PushDevice"("expoPushToken");
CREATE INDEX "PushDevice_tenantId_userId_enabled_idx" ON "PushDevice"("tenantId", "userId", "enabled");
CREATE UNIQUE INDEX "PushDelivery_notificationId_pushDeviceId_key" ON "PushDelivery"("notificationId", "pushDeviceId");
CREATE INDEX "PushDelivery_status_nextAttemptAt_idx" ON "PushDelivery"("status", "nextAttemptAt");
CREATE INDEX "PushDelivery_ticketId_idx" ON "PushDelivery"("ticketId");

ALTER TABLE "DomainEventOutbox" ADD CONSTRAINT "DomainEventOutbox_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DomainEventOutbox" ADD CONSTRAINT "DomainEventOutbox_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "DomainEventOutbox"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PushDevice" ADD CONSTRAINT "PushDevice_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PushDevice" ADD CONSTRAINT "PushDevice_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PushDelivery" ADD CONSTRAINT "PushDelivery_notificationId_fkey" FOREIGN KEY ("notificationId") REFERENCES "Notification"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PushDelivery" ADD CONSTRAINT "PushDelivery_pushDeviceId_fkey" FOREIGN KEY ("pushDeviceId") REFERENCES "PushDevice"("id") ON DELETE CASCADE ON UPDATE CASCADE;
