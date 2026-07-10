import { Role } from "@prisma/client";

export const permissionDefinitions = [
  { key: "schedule:create", description: "Criar escalas", category: "Escalas" },
  { key: "schedule:view", description: "Visualizar escalas", category: "Escalas" },
  { key: "schedule:edit", description: "Editar escalas", category: "Escalas" },
  { key: "schedule:delete", description: "Excluir escalas", category: "Escalas" },
  { key: "schedule:assign_members", description: "Escalar membros", category: "Escalas" },
  { key: "schedule:respond", description: "Responder escalas próprias", category: "Escalas" },
  { key: "schedule:view_reports", description: "Visualizar relatórios de escalas", category: "Escalas" },
  { key: "song:create", description: "Criar músicas", category: "Músicas" },
  { key: "song:view", description: "Visualizar músicas", category: "Músicas" },
  { key: "song:edit", description: "Editar músicas", category: "Músicas" },
  { key: "song:delete", description: "Excluir músicas", category: "Músicas" },
  { key: "song:attach_to_schedule", description: "Anexar músicas a escalas", category: "Músicas" },
  { key: "member:create", description: "Criar membros", category: "Membros" },
  { key: "member:view", description: "Visualizar membros", category: "Membros" },
  { key: "member:edit", description: "Editar membros", category: "Membros" },
  { key: "member:delete", description: "Excluir membros", category: "Membros" },
  { key: "member:invite", description: "Convidar membros", category: "Membros" },
  { key: "member:assign_ministry", description: "Atribuir ministérios a membros", category: "Membros" },
  { key: "member:assign_permissions", description: "Atribuir permissões legadas de membros", category: "Membros" },
  { key: "ministry:create", description: "Criar ministérios", category: "Ministérios" },
  { key: "ministry:view", description: "Visualizar ministérios", category: "Ministérios" },
  { key: "ministry:edit", description: "Editar ministérios", category: "Ministérios" },
  { key: "ministry:delete", description: "Excluir ministérios", category: "Ministérios" },
  { key: "ministry:assign_members", description: "Atribuir membros a ministérios", category: "Ministérios" },
  { key: "instrument:create", description: "Criar instrumentos/cargos", category: "Instrumentos/cargos" },
  { key: "instrument:view", description: "Visualizar instrumentos/cargos", category: "Instrumentos/cargos" },
  { key: "instrument:edit", description: "Editar instrumentos/cargos", category: "Instrumentos/cargos" },
  { key: "instrument:delete", description: "Excluir instrumentos/cargos", category: "Instrumentos/cargos" },
  { key: "reports:view", description: "Visualizar relatórios", category: "Relatórios" },
  { key: "permissions:manage", description: "Gerenciar permissões granulares", category: "Admin" },
  { key: "tenant:manage", description: "Gerenciar igrejas/tenants", category: "Admin" },
] as const;

export type PermissionKey = (typeof permissionDefinitions)[number]["key"];

const allPermissionKeys = permissionDefinitions.map((permission) => permission.key);

export const rolePermissionMap: Record<Role, PermissionKey[]> = {
  [Role.GLOBAL_ADMIN]: allPermissionKeys,
  [Role.TENANT_ADMIN]: allPermissionKeys.filter(
    (key) => key !== "permissions:manage" && key !== "tenant:manage" && key !== "member:assign_permissions"
  ),
  [Role.MINISTRY_LEADER]: [
    "schedule:create",
    "schedule:view",
    "schedule:edit",
    "schedule:assign_members",
    "schedule:respond",
    "schedule:view_reports",
    "song:create",
    "song:view",
    "song:edit",
    "song:attach_to_schedule",
    "member:view",
    "ministry:view",
    "ministry:assign_members",
    "instrument:view",
    "reports:view",
  ],
  [Role.MEMBER]: [
    "schedule:respond",
    "song:view",
    "ministry:view",
    "instrument:view",
  ],
};

export function isPermissionKey(value: string): value is PermissionKey {
  return allPermissionKeys.includes(value as PermissionKey);
}

export function rolePermissions(role?: Role | string | null): PermissionKey[] {
  if (!role || !(role in rolePermissionMap)) return [];
  return rolePermissionMap[role as Role];
}
