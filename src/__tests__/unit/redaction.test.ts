import { buildLogRecord, LOG_FIELD_ALLOWLIST } from "../../observability/logger";
import { REDACTED, redactSensitive } from "../../observability/redaction";
import { sanitizeAdminAuditPayload } from "../../audit/adminAudit";

describe("central sensitive-data redaction", () => {
  it("redacts forbidden keys and sensitive string patterns recursively", () => {
    const value = redactSensitive({
      authorization: "Bearer access-secret",
      nested: {
        password: "new-secret-password",
        email: "person@example.com",
        comments: "Acompanhamento pastoral reservado",
        harmless: "token=inline-secret person@example.com",
      },
      cookies: ["session=secret"],
    });

    expect(value).toEqual({
      authorization: REDACTED,
      nested: { password: REDACTED, email: REDACTED, comments: REDACTED, harmless: `${REDACTED} ${REDACTED}` },
      cookies: REDACTED,
    });
  });

  it("applies a category allowlist before serializing structured logs", () => {
    const record = buildLogRecord("info", "request_ok", {
      category: "access",
      method: "POST",
      route: "/api/auth/login",
      statusCode: 200,
      body: { email: "person@example.com", password: "secret" },
      authorization: "Bearer secret",
      arbitrary: "must-not-pass",
    });

    expect(record).toMatchObject({ event: "request_ok", category: "access", method: "POST", statusCode: 200 });
    expect(record).not.toHaveProperty("body");
    expect(record).not.toHaveProperty("authorization");
    expect(record).not.toHaveProperty("arbitrary");
    expect(Object.keys(record).every((key) => LOG_FIELD_ALLOWLIST.access.has(key))).toBe(true);
  });

  it("stores only the typed administrative event payload allowlist", () => {
    expect(sanitizeAdminAuditPayload("update", {
      email: "person@example.com",
      password: "secret",
      notes: "private note",
      roleBefore: "MEMBER",
      roleAfter: "TENANT_ADMIN",
    })).toEqual({
      changedFields: ["email", "notes", "password", "roleAfter", "roleBefore"],
      roleBefore: "MEMBER",
      roleAfter: "TENANT_ADMIN",
    });
  });
});
