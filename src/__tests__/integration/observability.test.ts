import express from "express";
import request from "supertest";
import app from "../../app";
import { writeAdminAuditEvent } from "../../audit/adminAudit";
import { errorHandler } from "../../middlewares/errorHandler";
import { requestObservability } from "../../middlewares/requestObservability";
import { setLogSinkForTests } from "../../observability/logger";
import { Role } from "@prisma/client";

describe("observability integration", () => {
  const records: string[] = [];

  beforeEach(() => {
    records.length = 0;
    setLogSinkForTests((record) => records.push(record));
  });

  afterAll(() => setLogSinkForTests());

  it("propagates a safe request ID and emits no request secrets on success", async () => {
    const response = await request(app)
      .get("/health?email=person@example.com&token=query-secret")
      .set("X-Request-ID", "stage5-success-001")
      .set("Authorization", "Bearer access-secret")
      .set("Cookie", "refreshToken=refresh-secret")
      .expect(200);

    expect(response.headers["x-request-id"]).toBe("stage5-success-001");
    const serialized = records.join("\n");
    expect(serialized).toContain("stage5-success-001");
    for (const secret of ["person@example.com", "query-secret", "access-secret", "refresh-secret"]) {
      expect(serialized).not.toContain(secret);
    }
  });

  it("keeps the same request ID in API and typed audit data", async () => {
    const captured: Array<Record<string, unknown>> = [];
    const testApp = express();
    testApp.use(requestObservability);
    testApp.post("/admin-action", async (_req, res, next) => {
      try {
        await writeAdminAuditEvent({
          adminAuditLog: {
            create: async ({ data }) => { captured.push(data); return data; },
          },
        }, {
          actorId: "actor-1",
          actorRole: Role.GLOBAL_ADMIN,
          action: "update",
          resource: "users",
          resourceId: "user-1",
          payload: { email: "person@example.com", password: "secret", roleAfter: Role.MEMBER },
        });
        res.status(204).end();
      } catch (error) {
        next(error);
      }
    });
    testApp.use(errorHandler);

    const response = await request(testApp).post("/admin-action").set("X-Request-ID", "stage5-audit-001").expect(204);
    expect(response.headers["x-request-id"]).toBe("stage5-audit-001");
    expect(captured[0]).toMatchObject({ requestId: "stage5-audit-001", action: "update", resourceId: "user-1" });
    expect(JSON.stringify(captured[0])).not.toContain("person@example.com");
    expect(JSON.stringify(captured[0])).not.toContain("secret");
  });

  it("does not emit secrets from unhandled errors or request bodies", async () => {
    const testApp = express();
    testApp.use(requestObservability);
    testApp.use(express.json());
    testApp.post("/boom", (req) => {
      throw new Error(`failure ${req.body.password} ${req.body.email}`);
    });
    testApp.use(errorHandler);

    const response = await request(testApp)
      .post("/boom")
      .set("X-Request-ID", "stage5-error-001")
      .send({ password: "new-secret-password", email: "person@example.com", token: "access-secret" })
      .expect(500);

    expect(response.headers["x-request-id"]).toBe("stage5-error-001");
    const serialized = records.join("\n");
    expect(serialized).toContain("stage5-error-001");
    expect(serialized).toContain("unhandled_request_error");
    for (const secret of ["new-secret-password", "person@example.com", "access-secret"]) {
      expect(serialized).not.toContain(secret);
    }
  });
});
