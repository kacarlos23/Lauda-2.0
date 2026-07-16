import crypto from "node:crypto";

export function createPasswordResetChallengeId(): string {
  return crypto.randomBytes(32).toString("base64url");
}

export function createPasswordResetPin(): string {
  return crypto.randomInt(0, 1_000_000).toString().padStart(6, "0");
}

export function passwordResetHmac(input: {
  pepper: string;
  challengeId: string;
  userId: string;
  pin: string;
}): string {
  return crypto
    .createHmac("sha256", input.pepper)
    .update(`${input.challengeId}:${input.userId}:${input.pin}`, "utf8")
    .digest("base64url");
}

export function constantTimeEqual(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left, "utf8");
  const rightBuffer = Buffer.from(right, "utf8");
  return leftBuffer.length === rightBuffer.length && crypto.timingSafeEqual(leftBuffer, rightBuffer);
}
