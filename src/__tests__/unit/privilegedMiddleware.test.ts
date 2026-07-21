import { Request } from "express";
import { Role } from "@prisma/client";
import { config } from "../../config/unifiedConfig";
import { requireRecentStepUp } from "../../middlewares/authMiddleware";

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
