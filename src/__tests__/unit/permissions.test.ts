import { Role } from "@prisma/client";
import {
  canManageTenant,
  canViewTenantData,
  isGlobalAdmin,
  isMember,
  isMinistryLeader,
  isTenantAdmin,
} from "../../utils/permissions";

describe("permission helpers", () => {
  it("reconhece cada role principal", () => {
    expect(isGlobalAdmin({ role: Role.GLOBAL_ADMIN })).toBe(true);
    expect(isTenantAdmin({ role: Role.TENANT_ADMIN })).toBe(true);
    expect(isMinistryLeader({ role: Role.MINISTRY_LEADER })).toBe(true);
    expect(isMember({ role: Role.MEMBER })).toBe(true);
  });

  it("não confunde roles comuns com permissão global", () => {
    expect(isGlobalAdmin({ role: Role.TENANT_ADMIN })).toBe(false);
    expect(isGlobalAdmin({ role: Role.MINISTRY_LEADER })).toBe(false);
    expect(isGlobalAdmin({ role: Role.MEMBER })).toBe(false);
  });

  it("limita TENANT_ADMIN ao próprio tenant e libera GLOBAL_ADMIN", () => {
    expect(canManageTenant({ role: Role.GLOBAL_ADMIN }, "tenant-b")).toBe(true);
    expect(canManageTenant({ role: Role.TENANT_ADMIN, tenantId: "tenant-a" }, "tenant-a")).toBe(true);
    expect(canManageTenant({ role: Role.TENANT_ADMIN, tenantId: "tenant-a" }, "tenant-b")).toBe(false);
    expect(canViewTenantData({ role: Role.MEMBER, tenantId: "tenant-a" }, "tenant-b")).toBe(false);
  });
});
