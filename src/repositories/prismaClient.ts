import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { getTenantContext } from "../context/tenantContext";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });

const tenantScopedModels = new Set([
  "User",
  "Ministry",
  "MinistryMember",
  "Schedule",
  "ScheduleAssignment",
  "Song",
  "MinistrySong",
]);

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

const createOperations = new Set(["create", "createMany", "createManyAndReturn"]);

function addTenantToWhere(args: unknown, tenantId: string) {
  const scopedArgs = (args ?? {}) as { where?: Record<string, unknown> };
  scopedArgs.where = { ...(scopedArgs.where ?? {}), tenantId };
  return scopedArgs;
}

function addTenantToCreate(args: unknown, tenantId: string) {
  const scopedArgs = (args ?? {}) as { data?: unknown };

  if (Array.isArray(scopedArgs.data)) {
    scopedArgs.data = scopedArgs.data.map((entry) => ({ ...entry, tenantId }));
    return scopedArgs;
  }

  scopedArgs.data = { ...((scopedArgs.data as Record<string, unknown>) ?? {}), tenantId };
  return scopedArgs;
}

function addTenantToUpsert(args: unknown, tenantId: string) {
  const scopedArgs = (args ?? {}) as {
    where?: Record<string, unknown>;
    create?: Record<string, unknown>;
  };

  scopedArgs.where = { ...(scopedArgs.where ?? {}), tenantId };
  scopedArgs.create = { ...(scopedArgs.create ?? {}), tenantId };
  return scopedArgs;
}

const basePrisma = new PrismaClient({ adapter });

export const prisma = basePrisma.$extends({
  name: "tenantIsolation",
  query: {
    $allModels: {
      async $allOperations({ model, operation, args, query }) {
        const context = getTenantContext();

        if (!model || !tenantScopedModels.has(model) || !context || context.role === "GLOBAL_ADMIN") {
          return query(args);
        }

        if (whereOperations.has(operation)) {
          return query(addTenantToWhere(args, context.tenantId) as typeof args);
        }

        if (createOperations.has(operation)) {
          return query(addTenantToCreate(args, context.tenantId) as typeof args);
        }

        if (operation === "upsert") {
          return query(addTenantToUpsert(args, context.tenantId) as typeof args);
        }

        return query(args);
      },
    },
  },
});
