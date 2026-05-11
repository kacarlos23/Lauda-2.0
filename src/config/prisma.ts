import "dotenv/config";
import { Prisma, PrismaClient, Role } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { getTenantContext } from "../context/tenantContext";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });

const tenantScopedModels = new Set(
  [
    "User",
    "Ministry",
    "MemberInvite",
    "MinistryMember",
    "Schedule",
    "ScheduleAssignment",
    "Song",
    "MinistrySong",
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
]);

const uniqueWhereOperations = new Set(["findUnique", "findUniqueOrThrow", "update", "delete"]);

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
              throw new Error("TenantId ausente no contexto autenticado");
            }

            if (context.role === Role.GLOBAL_ADMIN) {
              return query(args);
            }

            if (whereOperations.has(operation)) {
              return query(
                addTenantToWhere(args, context.tenantId, uniqueWhereOperations.has(operation)) as typeof args
              );
            }

            // Creates are intentionally left untouched: controllers/services must set tenantId
            // from req.user so API input cannot forge cross-tenant ownership.
            return query(args);
          },
        },
      },
    })
  );
}

const basePrisma = new PrismaClient({ adapter });

export const prisma = withTenantIsolation(basePrisma);
