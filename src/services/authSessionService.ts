import crypto from "node:crypto";
import { Prisma } from "@prisma/client";
import { basePrisma } from "../config/prisma";
import {
  RefreshTokenPayload,
  refreshTokenHash,
  signAccessToken,
  signRefreshToken,
  tokenExpiresAt,
  verifyRefreshToken,
} from "../security/tokenService";

export type SessionMetadata = { userAgent?: string | null; ipAddress?: string | null };
export type SessionIdentity = { id: string; email: string; role: string; tenantId: string | null };
export type SessionAssurance = { mfaVerifiedAt?: Date | null };

type RotationResult =
  | { status: "rotated"; sessionId: string; userId: string; refreshToken: string }
  | { status: "invalid" | "reuse" };

const MAX_USER_AGENT_LENGTH = 255;
const MAX_IP_LENGTH = 64;

function limited(value: string | null | undefined, max: number): string | null {
  const normalized = value?.trim();
  return normalized ? normalized.slice(0, max) : null;
}

function equalHash(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left, "hex");
  const rightBuffer = Buffer.from(right, "hex");
  return leftBuffer.length === rightBuffer.length && crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

async function revokeFamilyInTransaction(
  tx: Prisma.TransactionClient,
  familyId: string,
  sessionId: string,
  reason: string,
  now: Date,
): Promise<void> {
  await tx.refreshToken.updateMany({ where: { familyId, revokedAt: null }, data: { revokedAt: now } });
  await tx.refreshTokenFamily.updateMany({
    where: { id: familyId, revokedAt: null },
    data: { revokedAt: now, revokeReason: reason },
  });
  await tx.authSession.updateMany({
    where: { id: sessionId, revokedAt: null },
    data: { revokedAt: now, revokeReason: reason },
  });
}

export async function createServerSession(
  identity: SessionIdentity,
  metadata: SessionMetadata = {},
  assurance: SessionAssurance = {},
) {
  const sessionId = crypto.randomUUID();
  const familyId = crypto.randomUUID();
  const refreshToken = signRefreshToken(identity.id, sessionId);
  const refreshPayload = verifyRefreshToken(refreshToken);
  const expiresAt = tokenExpiresAt(refreshToken);

  await basePrisma.authSession.create({
    data: {
      id: sessionId,
      userId: identity.id,
      tenantId: identity.tenantId,
      userAgent: limited(metadata.userAgent, MAX_USER_AGENT_LENGTH),
      ipAddress: limited(metadata.ipAddress, MAX_IP_LENGTH),
      expiresAt,
      mfaVerifiedAt: assurance.mfaVerifiedAt ?? null,
      refreshFamily: {
        create: {
          id: familyId,
          tokens: {
            create: {
              jti: refreshPayload.jti,
              tokenHash: refreshTokenHash(refreshToken),
              expiresAt,
            },
          },
        },
      },
    },
  });

  return {
    sessionId,
    accessToken: signAccessToken(identity, sessionId),
    refreshToken,
  };
}

export async function markSessionStepUp(sessionId: string, userId: string, verifiedAt: Date, expiresAt: Date) {
  const result = await basePrisma.authSession.updateMany({
    where: { id: sessionId, userId, revokedAt: null, expiresAt: { gt: verifiedAt } },
    data: { mfaVerifiedAt: verifiedAt, stepUpExpiresAt: expiresAt, lastUsedAt: verifiedAt },
  });
  return result.count === 1;
}

export async function rotateServerSession(rawToken: string, payload: RefreshTokenPayload): Promise<RotationResult> {
  const nextRefreshToken = signRefreshToken(payload.userId, payload.sid);
  const nextPayload = verifyRefreshToken(nextRefreshToken);
  const nextExpiresAt = tokenExpiresAt(nextRefreshToken);
  const presentedHash = refreshTokenHash(rawToken);
  const now = new Date();

  return basePrisma.$transaction(async (tx) => {
    const current = await tx.refreshToken.findUnique({
      where: { jti: payload.jti },
      include: { family: { include: { session: true } } },
    });
    if (
      !current ||
      !equalHash(current.tokenHash, presentedHash) ||
      current.family.sessionId !== payload.sid ||
      current.family.session.userId !== payload.userId
    ) {
      return { status: "invalid" };
    }

    const session = current.family.session;
    if (current.consumedAt || current.replacedByJti) {
      await revokeFamilyInTransaction(tx, current.familyId, session.id, "refresh_reuse", now);
      return { status: "reuse" };
    }
    if (
      current.revokedAt ||
      current.family.revokedAt ||
      session.revokedAt ||
      current.expiresAt <= now ||
      session.expiresAt <= now
    ) {
      return { status: "invalid" };
    }

    const consumed = await tx.refreshToken.updateMany({
      where: { id: current.id, consumedAt: null, revokedAt: null },
      data: { consumedAt: now, replacedByJti: nextPayload.jti },
    });
    if (consumed.count !== 1) {
      await revokeFamilyInTransaction(tx, current.familyId, session.id, "refresh_reuse", now);
      return { status: "reuse" };
    }

    await tx.refreshToken.create({
      data: {
        familyId: current.familyId,
        jti: nextPayload.jti,
        tokenHash: refreshTokenHash(nextRefreshToken),
        expiresAt: nextExpiresAt,
      },
    });
    await tx.authSession.update({
      where: { id: session.id },
      data: { lastUsedAt: now, expiresAt: nextExpiresAt },
    });
    return { status: "rotated", sessionId: session.id, userId: session.userId, refreshToken: nextRefreshToken };
  });
}

export async function revokeSession(sessionId: string, userId: string, reason: string): Promise<void> {
  const now = new Date();
  await basePrisma.$transaction(async (tx) => {
    const family = await tx.refreshTokenFamily.findFirst({ where: { sessionId, session: { userId } } });
    if (family) await revokeFamilyInTransaction(tx, family.id, sessionId, reason, now);
  });
}

export async function revokeUserSessions(userId: string, reason: string): Promise<number> {
  return basePrisma.$transaction(async (tx) => revokeUserSessionsInTransaction(tx, userId, reason));
}

export async function revokeUserSessionsInTransaction(
  tx: Prisma.TransactionClient,
  userId: string,
  reason: string,
): Promise<number> {
  const now = new Date();
  const sessions = await tx.authSession.findMany({
    where: { userId, revokedAt: null },
    select: { id: true, refreshFamily: { select: { id: true } } },
  });
  for (const session of sessions) {
    if (session.refreshFamily) {
      await revokeFamilyInTransaction(tx, session.refreshFamily.id, session.id, reason, now);
    }
  }
  return sessions.length;
}

export async function revokeTenantSessions(tenantId: string, reason: string): Promise<number> {
  return basePrisma.$transaction(async (tx) => {
    const userIds = await tx.user.findMany({ where: { tenantId }, select: { id: true } });
    let count = 0;
    for (const user of userIds) count += await revokeUserSessionsInTransaction(tx, user.id, reason);
    return count;
  });
}
