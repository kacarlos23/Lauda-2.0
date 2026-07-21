const SENSITIVE_KEY_PARTS = [
  "authorization",
  "cookie",
  "password",
  "passwd",
  "secret",
  "token",
  "pin",
  "invitecode",
  "resetcode",
  "resetpassword",
  "hash",
  "body",
  "email",
  "phone",
  "notes",
  "comment",
  "profile",
  "avatar",
];

const JWT_PATTERN = /\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g;
const BEARER_PATTERN = /\bBearer\s+[^\s,;]+/gi;
const EMAIL_PATTERN = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;
const SECRET_ASSIGNMENT_PATTERN = /\b(password|secret|token|api[_-]?key|pin)\s*[=:]\s*[^\s,;]+/gi;

export const REDACTED = "[REDACTED]";

function normalizeKey(key: string): string {
  return key.toLowerCase().replace(/[^a-z0-9]/g, "");
}

export function isSensitiveField(key: string): boolean {
  const normalized = normalizeKey(key);
  return SENSITIVE_KEY_PARTS.some((part) => normalized.includes(part));
}

function redactString(value: string): string {
  return value
    .replace(BEARER_PATTERN, REDACTED)
    .replace(JWT_PATTERN, REDACTED)
    .replace(EMAIL_PATTERN, REDACTED)
    .replace(SECRET_ASSIGNMENT_PATTERN, REDACTED);
}

export function redactSensitive(value: unknown, key = ""): unknown {
  if (key && isSensitiveField(key)) return REDACTED;
  if (value === undefined) return undefined;
  if (value === null || typeof value === "number" || typeof value === "boolean") return value;
  if (typeof value === "string") return redactString(value);
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) {
    return value.map((item) => redactSensitive(item)).filter((item) => item !== undefined);
  }
  if (typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .map(([childKey, childValue]) => [childKey, redactSensitive(childValue, childKey)] as const)
        .filter(([, childValue]) => childValue !== undefined),
    );
  }
  return String(value);
}
