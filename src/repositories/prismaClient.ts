import "dotenv/config";
import { Prisma, PrismaClient } from "@prisma/client";
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
const uniqueWhereOperations = new Set(["findUnique", "findUniqueOrThrow", "update", "delete"]);

type QueryArgs = Record<string, unknown>;

function asQueryArgs(args: unknown): QueryArgs {
  return { ...((args as QueryArgs | undefined) ?? {}) };
}

function addTenantToWhere(args: unknown, tenantId: string, keepUniqueFieldsAtTopLevel = false) {
  const scopedArgs = asQueryArgs(args);
  const currentWhere = (scopedArgs.where as Record<string, unknown> | undefined) ?? {};

  if (keepUniqueFieldsAtTopLevel) {
    scopedArgs.where = { ...currentWhere, tenantId };
    return scopedArgs;
  }

  scopedArgs.where = {
    AND: [currentWhere, { tenantId }],
  };

  return scopedArgs;
}

function addTenantToCreate(args: unknown, tenantId: string) {
  const scopedArgs = asQueryArgs(args);

  if (Array.isArray(scopedArgs.data)) {
    scopedArgs.data = scopedArgs.data.map((entry) => ({
      ...((entry as Record<string, unknown>) ?? {}),
      tenantId,
    }));
    return scopedArgs;
  }

  scopedArgs.data = { ...((scopedArgs.data as Record<string, unknown>) ?? {}), tenantId };
  return scopedArgs;
}

function addTenantToUpsert(args: unknown, tenantId: string) {
  const scopedArgs = addTenantToWhere(args, tenantId, true);
  const currentCreate = (scopedArgs.create as Record<string, unknown> | undefined) ?? {};

  scopedArgs.create = { ...currentCreate, tenantId };
  return scopedArgs;
}

const basePrisma = new PrismaClient({ adapter });

const tenantIsolationExtension = Prisma.defineExtension({
  name: "tenantIsolation",
  query: {
    $allModels: {
      async $allOperations({ model, operation, args, query }) {
        const context = getTenantContext();

        if (!model || !tenantScopedModels.has(model) || !context || context.role === "GLOBAL_ADMIN") {
          return query(args);
        }

        if (whereOperations.has(operation)) {
          return query(
            addTenantToWhere(args, context.tenantId, uniqueWhereOperations.has(operation)) as typeof args
          );
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

export const prisma = basePrisma.$extends(tenantIsolationExtension);
