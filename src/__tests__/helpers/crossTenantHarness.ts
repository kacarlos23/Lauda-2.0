export type RegisteredTenant = {
  accessToken: string;
  user: { id: string; email: string; tenantId: string };
  tenant: { id: string; name: string };
};

export async function createCrossTenantHarness<TResource>(options: {
  seed: string;
  registerTenant(seed: string): Promise<RegisteredTenant>;
  seedResource(tenant: RegisteredTenant, label: "A" | "B"): Promise<TResource>;
}) {
  const tenantA = await options.registerTenant(`${options.seed}-a`);
  const tenantB = await options.registerTenant(`${options.seed}-b`);
  const resourceA = await options.seedResource(tenantA, "A");
  const resourceB = await options.seedResource(tenantB, "B");
  return { tenantA, tenantB, resourceA, resourceB };
}
