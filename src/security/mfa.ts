import crypto from "node:crypto";
import { config } from "../config/unifiedConfig";

const BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
const TOTP_PERIOD_SECONDS = 30;
const TOTP_DIGITS = 6;

function encodeBase32(value: Buffer): string {
  let bits = "";
  for (const byte of value) bits += byte.toString(2).padStart(8, "0");
  let encoded = "";
  for (let index = 0; index < bits.length; index += 5) {
    encoded += BASE32_ALPHABET[parseInt(bits.slice(index, index + 5).padEnd(5, "0"), 2)];
  }
  return encoded;
}

function decodeBase32(value: string): Buffer {
  const normalized = value.toUpperCase().replace(/=+$/g, "").replace(/\s+/g, "");
  let bits = "";
  for (const character of normalized) {
    const index = BASE32_ALPHABET.indexOf(character);
    if (index < 0) throw new Error("Invalid base32 secret");
    bits += index.toString(2).padStart(5, "0");
  }
  const bytes: number[] = [];
  for (let index = 0; index + 8 <= bits.length; index += 8) {
    bytes.push(parseInt(bits.slice(index, index + 8), 2));
  }
  return Buffer.from(bytes);
}

function encryptionKey(): Buffer {
  return crypto.createHash("sha256").update(config.auth.mfa.encryptionKey, "utf8").digest();
}

export function generateMfaSecret(): string {
  return encodeBase32(crypto.randomBytes(20));
}

export function encryptMfaSecret(secret: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(secret, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return ["v1", iv.toString("base64url"), tag.toString("base64url"), encrypted.toString("base64url")].join(".");
}

export function decryptMfaSecret(value: string): string {
  const [version, ivValue, tagValue, encryptedValue] = value.split(".");
  if (version !== "v1" || !ivValue || !tagValue || !encryptedValue) throw new Error("Invalid encrypted MFA secret");
  const decipher = crypto.createDecipheriv("aes-256-gcm", encryptionKey(), Buffer.from(ivValue, "base64url"));
  decipher.setAuthTag(Buffer.from(tagValue, "base64url"));
  return Buffer.concat([
    decipher.update(Buffer.from(encryptedValue, "base64url")),
    decipher.final(),
  ]).toString("utf8");
}

export function totpCode(secret: string, timestamp = Date.now()): string {
  const counter = Math.floor(timestamp / 1000 / TOTP_PERIOD_SECONDS);
  const counterBuffer = Buffer.alloc(8);
  counterBuffer.writeBigUInt64BE(BigInt(counter));
  const digest = crypto.createHmac("sha1", decodeBase32(secret)).update(counterBuffer).digest();
  const offset = digest[digest.length - 1] & 0x0f;
  const binary = (digest.readUInt32BE(offset) & 0x7fffffff) % 10 ** TOTP_DIGITS;
  return binary.toString().padStart(TOTP_DIGITS, "0");
}

export function verifyTotpCode(secret: string, code: string, timestamp = Date.now(), window = 1): boolean {
  if (!/^\d{6}$/.test(code)) return false;
  for (let offset = -window; offset <= window; offset += 1) {
    const candidate = totpCode(secret, timestamp + offset * TOTP_PERIOD_SECONDS * 1000);
    if (crypto.timingSafeEqual(Buffer.from(candidate), Buffer.from(code))) return true;
  }
  return false;
}

export function mfaOtpAuthUrl(email: string, secret: string): string {
  const issuer = "Lauda";
  const label = encodeURIComponent(`${issuer}:${email}`);
  return `otpauth://totp/${label}?secret=${secret}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=6&period=30`;
}
