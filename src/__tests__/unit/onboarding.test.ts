import {
  CURRENT_ONBOARDING_VERSION,
  fromPrismaOnboardingStatus,
  toOnboardingStateView,
  toPrismaOnboardingStatus,
} from "../../constants/onboarding";
import { getMyOnboardingQuerySchema, updateMyOnboardingSchema } from "../../validators/member.schema";

describe("onboarding constants and schemas", () => {
  it("mapeia ausência de registro como conta existente sem autoabertura", () => {
    expect(toOnboardingStateView(null)).toEqual({
      version: CURRENT_ONBOARDING_VERSION,
      status: "not_started",
      shouldAutoStart: false,
      completedAt: null,
      dismissedAt: null,
      updatedAt: null,
    });
  });

  it("habilita autoabertura apenas para registros novos com status NOT_STARTED", () => {
    const updatedAt = new Date("2026-11-19T12:00:00.000Z");
    expect(
      toOnboardingStateView({
        version: "v1",
        status: "NOT_STARTED",
        completedAt: null,
        dismissedAt: null,
        updatedAt,
      })
    ).toEqual({
      version: "v1",
      status: "not_started",
      shouldAutoStart: true,
      completedAt: null,
      dismissedAt: null,
      updatedAt: "2026-11-19T12:00:00.000Z",
    });

    expect(
      toOnboardingStateView({
        version: "v1",
        status: "DISMISSED",
        completedAt: null,
        dismissedAt: updatedAt,
        updatedAt,
      }).shouldAutoStart
    ).toBe(false);

    expect(
      toOnboardingStateView({
        version: "v1",
        status: "COMPLETED",
        completedAt: updatedAt,
        dismissedAt: null,
        updatedAt,
      })
    ).toEqual({
      version: "v1",
      status: "completed",
      shouldAutoStart: false,
      completedAt: "2026-11-19T12:00:00.000Z",
      dismissedAt: null,
      updatedAt: "2026-11-19T12:00:00.000Z",
    });
  });

  it("converte estados entre contrato HTTP e Prisma", () => {
    expect(toPrismaOnboardingStatus("not_started")).toBe("NOT_STARTED");
    expect(toPrismaOnboardingStatus("dismissed")).toBe("DISMISSED");
    expect(toPrismaOnboardingStatus("completed")).toBe("COMPLETED");
    expect(fromPrismaOnboardingStatus("NOT_STARTED")).toBe("not_started");
    expect(fromPrismaOnboardingStatus("DISMISSED")).toBe("dismissed");
    expect(fromPrismaOnboardingStatus("COMPLETED")).toBe("completed");
  });

  it("valida schemas de consulta e atualização do onboarding", () => {
    expect(getMyOnboardingQuerySchema.parse({})).toEqual({ version: "v1" });
    expect(updateMyOnboardingSchema.parse({ status: "completed" })).toEqual({
      version: "v1",
      status: "completed",
    });
    expect(() => updateMyOnboardingSchema.parse({ status: "invalid" })).toThrow();
    expect(() => getMyOnboardingQuerySchema.parse({ version: "../bad" })).toThrow();
  });
});
