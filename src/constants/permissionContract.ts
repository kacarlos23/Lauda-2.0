export const permissionDefinitions = [
  { key: "schedule:create", description: "Criar escalas", category: "Escalas", assignable: true },
  { key: "schedule:view", description: "Visualizar escalas", category: "Escalas", assignable: true },
  { key: "schedule:edit", description: "Editar escalas", category: "Escalas", assignable: true },
  { key: "schedule:delete", description: "Excluir escalas", category: "Escalas", assignable: true },
  { key: "schedule:assign_members", description: "Escalar membros", category: "Escalas", assignable: true },
  { key: "schedule:respond", description: "Responder escalas próprias", category: "Escalas", assignable: true },
  { key: "schedule:view_reports", description: "Visualizar relatórios de escalas", category: "Escalas", assignable: true },
  { key: "song:create", description: "Criar músicas", category: "Músicas", assignable: true },
  { key: "song:view", description: "Visualizar músicas", category: "Músicas", assignable: true },
  { key: "song:edit", description: "Editar músicas", category: "Músicas", assignable: true },
  { key: "song:delete", description: "Excluir músicas", category: "Músicas", assignable: true },
  { key: "song:attach_to_schedule", description: "Anexar músicas a escalas", category: "Músicas", assignable: true },
  { key: "member:create", description: "Criar membros", category: "Membros", assignable: true },
  { key: "member:view", description: "Visualizar membros", category: "Membros", assignable: true },
  { key: "member:edit", description: "Editar membros", category: "Membros", assignable: true },
  { key: "member:delete", description: "Inativar membros", category: "Membros", assignable: true },
  { key: "member:invite", description: "Convidar membros", category: "Membros", assignable: true },
  { key: "member:assign_ministry", description: "Atribuir ministérios a membros", category: "Membros", assignable: true },
  { key: "member:manage_access", description: "Gerenciar papel e vínculos do membro", category: "Membros", assignable: true },
  { key: "ministry:create", description: "Criar ministérios", category: "Ministérios", assignable: true },
  { key: "ministry:view", description: "Visualizar ministérios", category: "Ministérios", assignable: true },
  { key: "ministry:edit", description: "Editar ministérios", category: "Ministérios", assignable: true },
  { key: "ministry:delete", description: "Excluir ministérios", category: "Ministérios", assignable: true },
  { key: "ministry:assign_members", description: "Atribuir membros a ministérios", category: "Ministérios", assignable: true },
  { key: "instrument:create", description: "Criar instrumentos/cargos", category: "Instrumentos/cargos", assignable: true },
  { key: "instrument:view", description: "Visualizar instrumentos/cargos", category: "Instrumentos/cargos", assignable: true },
  { key: "instrument:edit", description: "Editar instrumentos/cargos", category: "Instrumentos/cargos", assignable: true },
  { key: "instrument:delete", description: "Excluir instrumentos/cargos", category: "Instrumentos/cargos", assignable: true },
  { key: "permissions:manage", description: "Gerenciar permissões granulares", category: "Admin", assignable: false },
  { key: "tenant:manage", description: "Gerenciar dados da igreja", category: "Admin", assignable: true },
] as const;

export type PermissionKey = (typeof permissionDefinitions)[number]["key"];
export type PermissionEffect = "ALLOW" | "DENY";
export type PermissionRole = "GLOBAL_ADMIN" | "TENANT_ADMIN" | "MINISTRY_LEADER" | "MEMBER";

export const permissionKeys = permissionDefinitions.map((permission) => permission.key) as PermissionKey[];
export const assignablePermissionKeys = permissionDefinitions.filter((permission) => permission.assignable).map((permission) => permission.key) as PermissionKey[];

export const rolePermissionMap: Record<PermissionRole, PermissionKey[]> = {
  GLOBAL_ADMIN: [...permissionKeys],
  TENANT_ADMIN: [...assignablePermissionKeys],
  MINISTRY_LEADER: [
    "schedule:create", "schedule:respond", "song:create", "song:view", "song:edit",
    "song:attach_to_schedule", "ministry:view", "instrument:view",
  ],
  MEMBER: ["schedule:respond", "song:view", "ministry:view", "instrument:view"],
};

export const legacyPermissionAliases: Record<string, PermissionKey> = {
  "member:assign_permissions": "member:manage_access",
};

export function normalizePermissionKey(value: string): PermissionKey | null {
  const normalized = legacyPermissionAliases[value] ?? value;
  return permissionKeys.includes(normalized as PermissionKey) ? normalized as PermissionKey : null;
}

export function isAssignablePermissionKey(value: string): value is PermissionKey {
  const normalized = normalizePermissionKey(value);
  return Boolean(normalized && assignablePermissionKeys.includes(normalized));
}
