import { Request } from "express";
import { Role } from "@prisma/client";
import { config } from "../../config/unifiedConfig";
import { requireRecentStepUp } from "../../middlewares/authMiddleware";
import { requireSupportAccess } from "../../middlewares/supportAccessMiddleware";

const user = (overrides: Partial<NonNullable<Request["user"]>> = {}): NonNullable<Request["user"]> => ({
  id: "user-1",
  sessionId: "session-1",
  role: Role.GLOBAL_ADMIN,
  tenantId: "",
  permissions: [],
  mfaVerifiedAt: new Date(),
  stepUpExpiresAt: new Date(Date.now() + 60_000),
  ...overrides,
});

describe("privileged step-up middleware", () => {
  const original = config.privilegedAccess.enforceStepUp;
  beforeEach(() => { config.privilegedAccess.enforceStepUp = true; });
  afterAll(() => { config.privilegedAccess.enforceStepUp = original; });

  it("allows a current MFA step-up", () => {
    const next = jest.fn();
    requireRecentStepUp({ user: user() } as Request, {} as any, next);
    expect(next).toHaveBeenCalledWith();
  });

  it("rejects missing or expired assurance", () => {
    for (const requestUser of [
      user({ mfaVerifiedAt: null }),
      user({ stepUpExpiresAt: new Date(Date.now() - 1_000) }),
    ]) {
      const next = jest.fn();
      requireRecentStepUp({ user: requestUser } as Request, {} as any, next);
      expect(next.mock.calls[0][0]).toMatchObject({ statusCode: 403 });
    }
  });
});

describe("support access middleware", () => {
  it("rejects missing or malformed x-support-access-id with 403", async () => {
    for (const grantId of [undefined, "not-a-uuid"]) {
      const next = jest.fn();
      const req = {
        user: user({ role: Role.MEMBER }),
        header: (name: string) => (name.toLowerCase() === "x-support-access-id" ? grantId : undefined),
        params: { resource: "songs" },
      } as unknown as Request;
      await requireSupportAccess("read")(req, {} as any, next);
      expect(next.mock.calls[0][0]).toMatchObject({ statusCode: 403 });
    }
  });

  it("rejects invalid support resource with 400", async () => {
    const next = jest.fn();
    const req = {
      user: user({ role: Role.MEMBER }),
      header: (name: string) => (name.toLowerCase() === "x-support-access-id" ? "11111111-1111-4111-8111-111111111111" : undefined),
      params: { resource: "invalid-resource" },
    } as unknown as Request;
    await requireSupportAccess("read")(req, {} as any, next);
    expect(next.mock.calls[0][0]).toMatchObject({ statusCode: 400 });
  });
});
