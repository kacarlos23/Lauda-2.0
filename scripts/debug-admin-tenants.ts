import "dotenv/config";
import { basePrisma } from "../src/config/prisma";

async function main() {
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
