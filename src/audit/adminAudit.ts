import { Prisma, Role } from "@prisma/client";
import { getRequestContext } from "../observability/requestContext";
import { redactSensitive } from "../observability/redaction";

export const ADMIN_EVENT_TYPES = [
  "create", "update", "activate", "deactivate", "delete",
  "set_permission_override", "remove_permission_override", "set_permission_overrides",
  "support_access_granted", "support_access_revoked", "support_access_used",
  "global_admin_promoted_bootstrap",
] as const;

export type AdminEventType = (typeof ADMIN_EVENT_TYPES)[number];

const PAYLOAD_ALLOWLIST: Record<AdminEventType, ReadonlySet<string>> = {
  create: new Set(["changedFields"]),
  update: new Set(["changedFields", "roleBefore", "roleAfter", "tenantIdBefore", "tenantIdAfter", "permissionOverridesCleared", "ticketReference"]),
  activate: new Set(),
  deactivate: new Set(),
  delete: new Set(),
  set_permission_override: new Set(["permissionKey", "effect"]),
  remove_permission_override: new Set(["permissionKey"]),
  set_permission_overrides: new Set(["permissionKeys", "changeCount"]),
  support_access_granted: new Set(["granteeId", "resource", "targetResourceId", "scopes", "ticketReference", "expiresAt"]),
  support_access_revoked: new Set(["ticketReference"]),
  support_access_used: new Set(["grantId", "ticketReference", "scope", "sessionId"]),
  global_admin_promoted_bootstrap: new Set(["ticketReference"]),
};

export interface AdminAuditEvent {
  actorId: string;
  actorRole: Role;
  action: AdminEventType;
  resource: string;
  resourceId?: string | null;
  tenantId?: string | null;
  payload?: Record<string, unknown>;
  requestId?: string | null;
}

export function sanitizeAdminAuditPayload(action: AdminEventType, payload: Record<string, unknown> = {}): Prisma.InputJsonObject {
  const source = action === "create" || action === "update"
    ? { ...payload, changedFields: payload.changedFields ?? Object.keys(payload).sort() }
    : payload;
  const allowed = PAYLOAD_ALLOWLIST[action];
  return Object.fromEntries(
    Object.entries(source)
      .filter(([key, value]) => allowed.has(key) && value !== undefined)
      .map(([key, value]) => [key, redactSensitive(value, key)]),
  ) as Prisma.InputJsonObject;
}

export function buildAdminAuditData(event: AdminAuditEvent) {
  return {
    actorId: event.actorId,
    actorRole: event.actorRole,
    action: event.action,
    resource: event.resource,
    resourceId: event.resourceId ?? null,
    tenantId: event.tenantId ?? null,
    requestId: event.requestId ?? getRequestContext()?.requestId ?? null,
    payload: sanitizeAdminAuditPayload(event.action, event.payload),
  };
}

type AuditClient = {
  adminAuditLog: {
    create(args: { data: ReturnType<typeof buildAdminAuditData> }): Promise<unknown>;
  };
};

export function writeAdminAuditEvent(client: AuditClient, event: AdminAuditEvent): Promise<unknown> {
  return client.adminAuditLog.create({ data: buildAdminAuditData(event) });
}
