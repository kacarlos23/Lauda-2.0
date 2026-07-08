import { AsyncLocalStorage } from "node:async_hooks";
import { Role } from "@prisma/client";

export interface TenantContext {
  userId: string;
  role: Role;
  tenantId: string | null;
}

const tenantStorage = new AsyncLocalStorage<TenantContext>();

export function runWithTenantContext<T>(context: TenantContext, callback: () => T): T {
  return tenantStorage.run(context, callback);
}

export function getTenantContext() {
  return tenantStorage.getStore();
}
