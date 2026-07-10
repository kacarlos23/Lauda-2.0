import { Permission, PermissionKey, Role, User } from "../types";

export const permissionDefinitions: Permission[] = [
  { id: "schedule:create", key: "schedule:create", description: "Criar escalas", category: "Escalas" },
  { id: "schedule:view", key: "schedule:view", description: "Visualizar escalas", category: "Escalas" },
  { id: "schedule:edit", key: "schedule:edit", description: "Editar escalas", category: "Escalas" },
  { id: "schedule:delete", key: "schedule:delete", description: "Excluir escalas", category: "Escalas" },
  { id: "schedule:assign_members", key: "schedule:assign_members", description: "Escalar membros", category: "Escalas" },
  { id: "schedule:respond", key: "schedule:respond", description: "Responder escalas próprias", category: "Escalas" },
  { id: "schedule:view_reports", key: "schedule:view_reports", description: "Visualizar relatórios de escalas", category: "Escalas" },
  { id: "song:create", key: "song:create", description: "Criar músicas", category: "Músicas" },
  { id: "song:view", key: "song:view", description: "Visualizar músicas", category: "Músicas" },
  { id: "song:edit", key: "song:edit", description: "Editar músicas", category: "Músicas" },
  { id: "song:delete", key: "song:delete", description: "Excluir músicas", category: "Músicas" },
  { id: "song:attach_to_schedule", key: "song:attach_to_schedule", description: "Anexar músicas a escalas", category: "Músicas" },
  { id: "member:create", key: "member:create", description: "Criar membros", category: "Membros" },
  { id: "member:view", key: "member:view", description: "Visualizar membros", category: "Membros" },
  { id: "member:edit", key: "member:edit", description: "Editar membros", category: "Membros" },
  { id: "member:delete", key: "member:delete", description: "Excluir membros", category: "Membros" },
  { id: "member:invite", key: "member:invite", description: "Convidar membros", category: "Membros" },
  { id: "member:assign_ministry", key: "member:assign_ministry", description: "Atribuir ministérios a membros", category: "Membros" },
  { id: "member:assign_permissions", key: "member:assign_permissions", description: "Atribuir acesso legado de membros", category: "Membros" },
  { id: "ministry:create", key: "ministry:create", description: "Criar ministérios", category: "Ministérios" },
  { id: "ministry:view", key: "ministry:view", description: "Visualizar ministérios", category: "Ministérios" },
  { id: "ministry:edit", key: "ministry:edit", description: "Editar ministérios", category: "Ministérios" },
  { id: "ministry:delete", key: "ministry:delete", description: "Excluir ministérios", category: "Ministérios" },
  { id: "ministry:assign_members", key: "ministry:assign_members", description: "Atribuir membros a ministérios", category: "Ministérios" },
  { id: "instrument:create", key: "instrument:create", description: "Criar instrumentos/cargos", category: "Instrumentos/cargos" },
  { id: "instrument:view", key: "instrument:view", description: "Visualizar instrumentos/cargos", category: "Instrumentos/cargos" },
  { id: "instrument:edit", key: "instrument:edit", description: "Editar instrumentos/cargos", category: "Instrumentos/cargos" },
  { id: "instrument:delete", key: "instrument:delete", description: "Excluir instrumentos/cargos", category: "Instrumentos/cargos" },
  { id: "reports:view", key: "reports:view", description: "Visualizar relatórios", category: "Relatórios" },
  { id: "permissions:manage", key: "permissions:manage", description: "Gerenciar permissões granulares", category: "Admin" },
  { id: "tenant:manage", key: "tenant:manage", description: "Gerenciar igrejas/tenants", category: "Admin" },
];

const allPermissionKeys: PermissionKey[] = permissionDefinitions.map((permission) => permission.key);

const tenantAdminPermissions = allPermissionKeys.filter(
  (key) => key !== "permissions:manage" && key !== "tenant:manage" && key !== "member:assign_permissions"
);

export const rolePermissionMap: Record<Role, PermissionKey[]> = {
  GLOBAL_ADMIN: allPermissionKeys,
  TENANT_ADMIN: tenantAdminPermissions,
  MINISTRY_LEADER: [
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
  MEMBER: ["schedule:respond", "song:view", "ministry:view", "instrument:view"],
};

type PermissionSubject = Pick<User, "role" | "permissions"> | Role | string | null | undefined;

function subjectRole(subject?: PermissionSubject): Role | string | undefined {
  if (typeof subject === "string") return subject;
  return subject?.role;
}

export function can(subject: PermissionSubject, permission: PermissionKey): boolean {
  const role = subjectRole(subject);
  if (role === "GLOBAL_ADMIN") return true;
  if (typeof subject === "object" && Array.isArray(subject?.permissions)) {
    return subject.permissions.includes(permission);
  }
  if (!role || !(role in rolePermissionMap)) return false;
  return rolePermissionMap[role as Role].includes(permission);
}

export function isGlobalAdmin(user?: { role?: Role | string } | null): boolean {
  return user?.role === "GLOBAL_ADMIN";
}

export function isTenantAdmin(user?: { role?: Role | string } | null): boolean {
  return user?.role === "TENANT_ADMIN";
}

export function isChurchAdmin(user?: PermissionSubject): boolean {
  return canManageMembers(user);
}

export function canAccessGlobalAdminArea(subject?: PermissionSubject): boolean {
  return subjectRole(subject) === "GLOBAL_ADMIN";
}

export function canAccessChurchAdmin(subject?: PermissionSubject): boolean {
  return subjectRole(subject) === "TENANT_ADMIN";
}

export function canManageChurch(subject?: PermissionSubject): boolean {
  return can(subject, "ministry:create") || can(subject, "tenant:manage");
}

export function canManageMembers(subject?: PermissionSubject): boolean {
  return can(subject, "member:create") || can(subject, "member:invite") || can(subject, "member:assign_ministry");
}

export function canViewMembers(subject?: PermissionSubject): boolean {
  return can(subject, "member:view");
}

export function formatRoleLabel(role?: Role | string): string {
  const labels: Record<string, string> = {
    GLOBAL_ADMIN: "Administrador global",
    TENANT_ADMIN: "Administrador da igreja",
    MINISTRY_LEADER: "Líder de ministério",
    MEMBER: "Membro",
  };
  return labels[role ?? ""] ?? "";
}
