import "dotenv/config";
import { Prisma, PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { getTenantContext } from "../context/tenantContext";
import { UnauthorizedError } from "../errors/AppError";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });

const tenantScopedModels = new Set(
  [
    "User",
    "Ministry",
    "MemberInvite",
    "MinistryMember",
    "Schedule",
    "ScheduleAssignment",
    "ScheduleSong",
    "Song",
    "Artist",
    "MinistrySong",
    "Instrument",
    "UserInstrument",
    "UserPermission",
    "DomainEventOutbox",
    "Notification",
    "PushDevice",
  ].map((model) => model.toLowerCase())
);

const whereOperations = new Set([
  "findUnique",
  "findUniqueOrThrow",
  "findFirst",
  "findFirstOrThrow",
  "findMany",
  "count",
  "aggregate",
  "groupBy",
  "update",
  "updateMany",
  "updateManyAndReturn",
  "delete",
  "deleteMany",
  "upsert",
]);

const uniqueWhereOperations = new Set(["findUnique", "findUniqueOrThrow", "update", "delete", "upsert"]);

type QueryArgs = Record<string, unknown>;

/**
 * Creates a shallow mutable copy of Prisma query args.
 *
 * @param args Original Prisma args received by the extension.
 * @returns A query args object that can be safely rewritten.
 */
function asQueryArgs(args: unknown): QueryArgs {
  return { ...((args as QueryArgs | undefined) ?? {}) };
}

/**
 * Adds the active tenant to a Prisma where clause.
 *
 * @param args Original Prisma query args.
 * @param tenantId Tenant extracted from the authenticated request context.
 * @param keepTopLevel Whether the model operation requires unique fields at top-level.
 * @returns Prisma args scoped to the tenant.
 */
function addTenantToWhere(args: unknown, tenantId: string, keepTopLevel = false): QueryArgs {
  const scopedArgs = asQueryArgs(args);
  const currentWhere = (scopedArgs.where as Record<string, unknown> | undefined) ?? {};

  scopedArgs.where = keepTopLevel
    ? { ...currentWhere, tenantId }
    : { AND: [currentWhere, { tenantId }] };

  return scopedArgs;
}

function tenantOwnedData(value: unknown, tenantId: string): unknown {
  if (Array.isArray(value)) return value.map((item) => tenantOwnedData(item, tenantId));
  if (!value || typeof value !== "object") return value;
  return { ...(value as Record<string, unknown>), tenantId };
}

function addTenantToWrite(args: unknown, operation: string, tenantId: string): QueryArgs {
  const scopedArgs = asQueryArgs(args);
  if (["create", "createMany", "createManyAndReturn", "update", "updateMany", "updateManyAndReturn"].includes(operation)) {
    scopedArgs.data = tenantOwnedData(scopedArgs.data, tenantId);
  }
  if (operation === "upsert") {
    scopedArgs.create = tenantOwnedData(scopedArgs.create, tenantId);
    scopedArgs.update = tenantOwnedData(scopedArgs.update, tenantId);
  }
  return scopedArgs;
}

/**
 * Applies tenant isolation to every read/update/delete operation for tenant-owned models.
 *
 * @param baseClient Prisma client to extend.
 * @returns Prisma client with tenant isolation enabled.
 */
export function withTenantIsolation(baseClient: PrismaClient) {
  return baseClient.$extends(
    Prisma.defineExtension({
      name: "tenantIsolation",
      query: {
        $allModels: {
          async $allOperations({ model, operation, args, query }) {
            if (!model || !tenantScopedModels.has(model.toLowerCase())) {
              return query(args);
            }

            const context = getTenantContext();
            if (!context) {
              return query(args);
            }

            if (!context.tenantId) {
              throw new UnauthorizedError("TenantId ausente no contexto autenticado");
            }

            let scopedArgs: unknown = args;
            if (whereOperations.has(operation)) {
              scopedArgs = addTenantToWhere(scopedArgs, context.tenantId, uniqueWhereOperations.has(operation));
            }
            scopedArgs = addTenantToWrite(scopedArgs, operation, context.tenantId);
            return query(scopedArgs as typeof args);
          },
        },
      },
    })
  );
}

export const basePrisma = new PrismaClient({ adapter });

export const prisma = withTenantIsolation(basePrisma);
