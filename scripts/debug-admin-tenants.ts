import "dotenv/config";
import { basePrisma } from "../src/config/prisma";

async function main() {
  if (process.env.NODE_ENV === "production") {
    throw new Error("Diagnóstico global por script é bloqueado em produção.");
  }
  const reasonIndex = process.argv.indexOf("--reason");
  const confirmIndex = process.argv.indexOf("--confirm");
  const reason = reasonIndex >= 0 ? process.argv[reasonIndex + 1]?.trim() : "";
  const confirmation = confirmIndex >= 0 ? process.argv[confirmIndex + 1]?.trim() : "";
  if (!reason || reason.length < 10 || confirmation !== "DEBUG TENANTS") {
    throw new Error('Informe --reason com ao menos 10 caracteres e --confirm "DEBUG TENANTS".');
  }
  const [tenantCount, userCount, tenants] = await Promise.all([
    basePrisma.tenant.count(),
    basePrisma.user.count(),
    basePrisma.tenant.findMany({
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        _count: {
          select: {
            users: true,
            ministries: true,
            schedules: true,
            instruments: true,
          },
        },
      },
    }),
  ]);

  console.log(`Total de igrejas: ${tenantCount}`);
  console.log(`Total de usuários: ${userCount}`);

  for (const tenant of tenants) {
    console.log(
      `${tenant.name} (${tenant.id}) - usuários: ${tenant._count.users}, ministérios: ${tenant._count.ministries}, escalas: ${tenant._count.schedules}, instrumentos: ${tenant._count.instruments}`
    );
  }
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : "Falha ao consultar tenants globais.");
    process.exitCode = 1;
  })
  .finally(async () => {
    await basePrisma.$disconnect();
  });
