import React from "react";
import { StyleProp, TextStyle, ViewStyle } from "react-native";
import { AssignmentStatus, MemberStatus, Role } from "../../types";
import { Badge, BadgeTone } from "./Badge";

type StatusBadgeProps = {
  label?: string;
  status?: string | null;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
  testID?: string;
};

type BadgeConfig = {
  label: string;
  tone: BadgeTone;
};

const scheduleStatusConfig: Record<AssignmentStatus, BadgeConfig> = {
  PENDING: { label: "Pendente", tone: "warning" },
  ACCEPTED: { label: "Aceita", tone: "success" },
  DECLINED: { label: "Recusada", tone: "danger" },
};

const roleStatusConfig: Record<Role, BadgeConfig> = {
  GLOBAL_ADMIN: { label: "Admin global", tone: "info" },
  TENANT_ADMIN: { label: "Admin da igreja", tone: "primary" },
  MINISTRY_LEADER: { label: "Líder", tone: "success" },
  MEMBER: { label: "Membro", tone: "neutral" },
};

const memberStatusConfig: Record<MemberStatus, BadgeConfig> = {
  PENDING: { label: "Vínculo pendente", tone: "warning" },
  ACTIVE: { label: "Ativo", tone: "success" },
  INACTIVE: { label: "Inativo", tone: "danger" },
};

const permissionStatusConfig: Record<string, BadgeConfig> = {
  LINKED: { label: "Vinculado", tone: "success" },
  UNLINKED: { label: "Sem vínculo", tone: "neutral" },
  LEADER: { label: "Líder", tone: "info" },
};

const inviteStatusConfig: Record<string, BadgeConfig> = {
  ACTIVE: { label: "Convite ativo", tone: "success" },
  INACTIVE: { label: "Convite inativo", tone: "danger" },
  LOADING: { label: "Carregando convite", tone: "warning" },
  UNAVAILABLE: { label: "Convite indisponível", tone: "neutral" },
};

function humanizeUnknown(value?: string | null, fallback = "Status desconhecido") {
  if (!value) return fallback;
  return value
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/^\w/, (char) => char.toUpperCase());
}

function resolveStatus(config: Record<string, BadgeConfig>, status?: string | null, fallback = "Status desconhecido"): BadgeConfig {
  if (!status) return { label: fallback, tone: "neutral" };
  return config[status] ?? { label: humanizeUnknown(status, fallback), tone: "neutral" };
}

export function getScheduleStatusBadge(status?: string | null): BadgeConfig {
  return resolveStatus(scheduleStatusConfig, status, "Status da escala desconhecido");
}

export function getRoleBadge(role?: string | null): BadgeConfig {
  return resolveStatus(roleStatusConfig, role, "Papel desconhecido");
}

export function getMemberStatusBadge(status?: string | null): BadgeConfig {
  return resolveStatus(memberStatusConfig, status, "Status do membro desconhecido");
}

export function getInviteStatusBadge(active?: boolean | null, loading = false): BadgeConfig {
  if (loading) return inviteStatusConfig.LOADING;
  if (active === true) return inviteStatusConfig.ACTIVE;
  if (active === false) return inviteStatusConfig.INACTIVE;
  return inviteStatusConfig.UNAVAILABLE;
}

export function getPermissionStatusBadge(status?: string | null): BadgeConfig {
  return resolveStatus(permissionStatusConfig, status, "Permissão desconhecida");
}

export function ScheduleStatusBadge({ status, label, ...props }: StatusBadgeProps) {
  const config = getScheduleStatusBadge(status);
  return <Badge label={label ?? config.label} tone={config.tone} {...props} />;
}

export function RoleBadge({ status, label, ...props }: StatusBadgeProps) {
  const config = getRoleBadge(status);
  return <Badge label={label ?? config.label} tone={config.tone} {...props} />;
}

export function MemberStatusBadge({ status, label, ...props }: StatusBadgeProps) {
  const config = getMemberStatusBadge(status);
  return <Badge label={label ?? config.label} tone={config.tone} {...props} />;
}

export function InviteStatusBadge({
  active,
  loading,
  label,
  ...props
}: Omit<StatusBadgeProps, "status"> & { active?: boolean | null; loading?: boolean }) {
  const config = getInviteStatusBadge(active, loading);
  return <Badge label={label ?? config.label} tone={config.tone} {...props} />;
}

export function PermissionStatusBadge({ status, label, ...props }: StatusBadgeProps) {
  const config = getPermissionStatusBadge(status);
  return <Badge label={label ?? config.label} tone={config.tone} {...props} />;
}
