import "dotenv/config";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { Role } from "@prisma/client";
import { basePrisma } from "../src/config/prisma";
import { runWithTenantContext } from "../src/context/tenantContext";
import { SongTransferService } from "../src/services/songTransferService";
import { songTransferDocumentSchema } from "../src/validators/songTransfer.schema";

function argument(name: string): string {
  const index = process.argv.indexOf(name);
  const value = index >= 0 ? process.argv[index + 1] : undefined;
  if (!value || value.startsWith("--")) throw new Error(`Informe ${name}`);
  return value;
}

async function main() {
  const filePath = resolve(argument("--file"));
  const tenantName = argument("--tenant");
  const ministryName = argument("--ministry");
  const shouldCommit = process.argv.includes("--commit");
  const document = songTransferDocumentSchema.parse(JSON.parse(await readFile(filePath, "utf8")));

  const tenants = await basePrisma.tenant.findMany({
    where: { name: { equals: tenantName, mode: "insensitive" }, isActive: true, deletedAt: null },
    select: { id: true, name: true },
  });
  if (tenants.length !== 1) throw new Error(`Esperado 1 tenant ativo chamado "${tenantName}"; encontrados: ${tenants.length}`);
  const tenant = tenants[0];

  const ministries = await basePrisma.ministry.findMany({
    where: { tenantId: tenant.id, name: { equals: ministryName, mode: "insensitive" }, isActive: true, deletedAt: null },
    select: { id: true, name: true },
  });
  if (ministries.length !== 1) throw new Error(`Esperado 1 ministério ativo chamado "${ministryName}"; encontrados: ${ministries.length}`);
  const ministry = ministries[0];

  const actor = await basePrisma.user.findFirst({
    where: { tenantId: tenant.id, role: Role.TENANT_ADMIN, isActive: true, deletedAt: null },
    orderBy: { createdAt: "asc" },
    select: { id: true, role: true, tenantId: true },
  });
  if (!actor?.tenantId) throw new Error("Nenhum administrador ativo encontrado para registrar a importação");
  const actorUser = { id: actor.id, role: actor.role, tenantId: actor.tenantId };

  const result = await runWithTenantContext(
    { userId: actorUser.id, role: actorUser.role, tenantId: actorUser.tenantId },
    async () => {
      const service = new SongTransferService(actorUser);
      const preview = await service.preview({ ministryId: ministry.id, document });
      if (!shouldCommit) return { mode: "preview", tenant, ministry, preview };
      const imported = await service.commit({ ministryId: ministry.id, document, documentHash: preview.documentHash });
      return { mode: "commit", tenant, ministry, preview: { total: preview.total, counts: preview.counts }, imported };
    },
  );
  console.log(JSON.stringify(result, null, 2));
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => basePrisma.$disconnect());
