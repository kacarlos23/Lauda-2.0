import { getRequestContext } from "./requestContext";
import { redactSensitive } from "./redaction";

export type LogCategory = "access" | "security" | "audit" | "observability";
export type LogLevel = "debug" | "info" | "warn" | "error";

const commonFields = [
  "timestamp", "level", "category", "event", "service", "environment", "requestId",
] as const;

export const LOG_FIELD_ALLOWLIST: Record<LogCategory, ReadonlySet<string>> = {
  access: new Set([...commonFields, "method", "route", "statusCode", "durationMs", "outcome"]),
  security: new Set([...commonFields, "actorId", "tenantId", "resource", "resourceId", "outcome", "errorName"]),
  audit: new Set([...commonFields, "actorId", "tenantId", "resource", "resourceId", "outcome"]),
  observability: new Set([
    ...commonFields,
    "component", "statusCode", "durationMs", "outcome", "errorName",
    "backlog", "attempts", "latencyMs", "connections", "reconnections", "deliveries", "failures", "receipts",
  ]),
};

type LogFields = Record<string, unknown> & { category?: LogCategory };
type LogSink = (serializedRecord: string) => void;

let testSink: LogSink | undefined;

export function setLogSinkForTests(nextSink?: LogSink): void {
  testSink = nextSink;
}

export function buildLogRecord(level: LogLevel, event: string, fields: LogFields = {}): Record<string, unknown> {
  const category = fields.category ?? "observability";
  const candidate: Record<string, unknown> = {
    timestamp: new Date().toISOString(),
    level,
    category,
    event,
    service: "lauda-api",
    environment: process.env.NODE_ENV || "development",
    requestId: fields.requestId ?? getRequestContext()?.requestId,
    ...fields,
  };
  const allowed = LOG_FIELD_ALLOWLIST[category];
  return Object.fromEntries(
    Object.entries(candidate)
      .filter(([key, value]) => allowed.has(key) && value !== undefined)
      .map(([key, value]) => [key, redactSensitive(value, key)]),
  );
}

function emit(level: LogLevel, event: string, fields?: LogFields): void {
  const serialized = JSON.stringify(buildLogRecord(level, event, fields));
  if (testSink) {
    testSink(serialized);
    return;
  }
  if (process.env.NODE_ENV === "test") return;
  process.stdout.write(`${serialized}\n`);
}

export const logger = {
  debug: (event: string, fields?: LogFields) => emit("debug", event, fields),
  info: (event: string, fields?: LogFields) => emit("info", event, fields),
  warn: (event: string, fields?: LogFields) => emit("warn", event, fields),
  error: (event: string, fields?: LogFields) => emit("error", event, fields),
};
