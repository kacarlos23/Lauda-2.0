import { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Alert, Modal, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, useWindowDimensions, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { CheckCircle2, Database, Edit3, Plus, RefreshCcw, ShieldAlert, Trash2, X, XCircle } from "lucide-react-native";
import { DateTimeInput } from "../../../src/components/DateTimeInput";
import { Button, EmptyState, ErrorBanner, LoadingState, MemberStatusBadge, RichCommentEditor } from "../../../src/components/ui";
import { adminService } from "../../../src/services/adminService";
import { useAuthStore } from "../../../src/store/authStore";
import {
  breakpoints,
  colors,
  controlSizes,
  fontSizes,
  fontWeights,
  iconSizes,
  lineHeights,
  overlays,
  radii,
  screen,
  shadow,
  spacing,
} from "../../../src/theme";
import { GlobalResourceName, GlobalTenant, Permission, PermissionEffect, PermissionKey, Role } from "../../../src/types";
import { isGlobalAdmin } from "../../../src/utils/permissions";
import { effectivePermissionsFromOverrides, nextPermissionEffect, PermissionOverrideMap } from "../../../src/utils/permissionOverrides";

type Row = Record<string, any>;
type FieldType = "text" | "textarea" | "richtext" | "number" | "boolean" | "role" | "status" | "tenant" | "user" | "ministry" | "instrument" | "artist" | "song" | "schedule" | "datetime";
type FieldConfig = { key: string; label: string; type?: FieldType; createOnly?: boolean; optional?: boolean };
type ResourceConfig = {
  name: GlobalResourceName;
  label: string;
  titleField: string;
  subtitle?: (row: Row) => string;
  fields: FieldConfig[];
  columns: Array<{ key: string; label: string; render?: (row: Row) => string }>;
  readOnly?: boolean;
};

const roles: Role[] = ["GLOBAL_ADMIN", "TENANT_ADMIN", "MINISTRY_LEADER", "MEMBER"];
const statuses = ["PENDING", "ACTIVE", "INACTIVE", "ACCEPTED", "DECLINED"];

const resources: ResourceConfig[] = [
  {
    name: "tenants",
    label: "Igrejas",
    titleField: "name",
    fields: [
      { key: "name", label: "Nome" },
      { key: "domain", label: "Domínio", optional: true },
      { key: "comments", label: "Comentários", type: "richtext", optional: true },
    ],
    columns: [
      { key: "name", label: "Nome" },
      { key: "domain", label: "Domínio" },
      { key: "_count", label: "Resumo", render: (row) => `${row._count?.users ?? 0} usuários · ${row._count?.ministries ?? 0} ministérios` },
    ],
  },
  {
    name: "users",
    label: "Usuários",
    titleField: "name",
    subtitle: (row) => row.email,
    fields: [
      { key: "name", label: "Nome" },
      { key: "email", label: "E-mail" },
      { key: "phone", label: "Telefone", optional: true },
      { key: "comments", label: "Comentários", type: "richtext", optional: true },
      { key: "password", label: "Nova senha", optional: true },
      { key: "role", label: "Nível de acesso", type: "role" },
      { key: "tenantId", label: "Igreja", type: "tenant", optional: true },
    ],
    columns: [
      { key: "name", label: "Nome" },
      { key: "email", label: "E-mail" },
      { key: "role", label: "Acesso" },
      { key: "tenant", label: "Igreja", render: (row) => row.tenant?.name ?? "Sem igreja" },
    ],
  },
  {
    name: "ministries",
    label: "Ministérios",
    titleField: "name",
    fields: [
      { key: "name", label: "Nome" },
      { key: "description", label: "Descrição", type: "textarea", optional: true },
      { key: "comments", label: "Comentários", type: "richtext", optional: true },
      { key: "tenantId", label: "Igreja", type: "tenant" },
    ],
    columns: [
      { key: "name", label: "Nome" },
      { key: "tenant", label: "Igreja", render: (row) => row.tenant?.name ?? "" },
      { key: "_count", label: "Resumo", render: (row) => `${row._count?.members ?? 0} membros · ${row._count?.schedules ?? 0} escalas` },
    ],
  },
  {
    name: "ministry-members",
    label: "Membros de ministérios",
    titleField: "role",
    fields: [
      { key: "tenantId", label: "Igreja", type: "tenant" },
      { key: "userId", label: "Usuário", type: "user" },
      { key: "ministryId", label: "Ministério", type: "ministry" },
      { key: "role", label: "Função", optional: true },
      { key: "isLeader", label: "Líder", type: "boolean" },
      { key: "notes", label: "Notas", type: "textarea", optional: true },
    ],
    columns: [
      { key: "user", label: "Usuário", render: (row) => row.user?.name ?? "" },
      { key: "ministry", label: "Ministério", render: (row) => row.ministry?.name ?? "" },
      { key: "role", label: "Função" },
      { key: "status", label: "Status" },
    ],
  },
  {
    name: "member-invites",
    label: "Convites",
    titleField: "code",
    fields: [
      { key: "tenantId", label: "Igreja", type: "tenant" },
      { key: "ministryId", label: "Ministério", type: "ministry", optional: true },
      { key: "code", label: "Código" },
      { key: "active", label: "Ativo", type: "boolean" },
      { key: "expiresAt", label: "Expira em ISO", type: "datetime", optional: true },
    ],
    columns: [
      { key: "code", label: "Código" },
      { key: "tenant", label: "Igreja", render: (row) => row.tenant?.name ?? "" },
      { key: "ministry", label: "Ministério", render: (row) => row.ministry?.name ?? "Geral" },
      { key: "active", label: "Convite", render: (row) => row.active ? "Ativo" : "Inativo" },
    ],
  },
  {
    name: "instruments",
    label: "Instrumentos",
    titleField: "name",
    fields: [
      { key: "name", label: "Nome" },
      { key: "colorHex", label: "Cor HEX", optional: true },
      { key: "tenantId", label: "Igreja", type: "tenant" },
    ],
    columns: [
      { key: "name", label: "Nome" },
      { key: "colorHex", label: "Cor" },
      { key: "tenant", label: "Igreja", render: (row) => row.tenant?.name ?? "" },
    ],
  },
  {
    name: "user-instruments",
    label: "Instrumentos de usuários",
    titleField: "id",
    fields: [
      { key: "tenantId", label: "Igreja", type: "tenant" },
      { key: "userId", label: "Usuário", type: "user" },
      { key: "instrumentId", label: "Instrumento", type: "instrument" },
    ],
    columns: [
      { key: "user", label: "Usuário", render: (row) => row.user?.name ?? "" },
      { key: "instrument", label: "Instrumento", render: (row) => row.instrument?.name ?? "" },
      { key: "tenant", label: "Igreja", render: (row) => row.tenant?.name ?? "" },
    ],
  },
  {
    name: "artists",
    label: "Artistas",
    titleField: "name",
    fields: [
      { key: "name", label: "Nome" },
      { key: "imageUrl", label: "Imagem URL", optional: true },
      { key: "tenantId", label: "Igreja", type: "tenant" },
    ],
    columns: [
      { key: "name", label: "Nome" },
      { key: "tenant", label: "Igreja", render: (row) => row.tenant?.name ?? "" },
    ],
  },
  {
    name: "songs",
    label: "Músicas",
    titleField: "title",
    fields: [
      { key: "title", label: "Título" },
      { key: "artistId", label: "Artista", type: "artist" },
      { key: "composer", label: "Compositor", optional: true },
      { key: "originalKey", label: "Tom original" },
      { key: "bpm", label: "BPM", type: "number", optional: true },
      { key: "content", label: "Cifra", type: "textarea" },
      { key: "comments", label: "Comentários", type: "richtext", optional: true },
      { key: "cifraUrl", label: "Link cifra", optional: true },
      { key: "letraUrl", label: "Link letra", optional: true },
      { key: "audioUrl", label: "Link áudio", optional: true },
      { key: "videoUrl", label: "Link vídeo", optional: true },
    ],
    columns: [
      { key: "title", label: "Título" },
      { key: "artist", label: "Artista", render: (row) => row.artist?.name ?? "" },
      { key: "originalKey", label: "Tom" },
      { key: "tenant", label: "Igreja", render: (row) => row.tenant?.name ?? "" },
    ],
  },
  {
    name: "ministry-songs",
    label: "Músicas por ministério",
    titleField: "id",
    fields: [
      { key: "tenantId", label: "Igreja", type: "tenant" },
      { key: "ministryId", label: "Ministério", type: "ministry" },
      { key: "comments", label: "Comentários", type: "richtext", optional: true },
      { key: "songId", label: "Música", type: "song" },
    ],
    columns: [
      { key: "ministry", label: "Ministério", render: (row) => row.ministry?.name ?? "" },
      { key: "song", label: "Música", render: (row) => row.song?.title ?? "" },
      { key: "tenant", label: "Igreja", render: (row) => row.tenant?.name ?? "" },
    ],
  },
  {
    name: "schedules",
    label: "Escalas",
    titleField: "title",
    fields: [
      { key: "title", label: "Nome" },
      { key: "date", label: "Data ISO", type: "datetime" },
      { key: "tenantId", label: "Igreja", type: "tenant" },
      { key: "ministryId", label: "Ministério", type: "ministry" },
    ],
    columns: [
      { key: "title", label: "Nome" },
      { key: "date", label: "Data", render: (row) => formatDate(row.date) },
      { key: "ministry", label: "Ministério", render: (row) => row.ministry?.name ?? "" },
      { key: "tenant", label: "Igreja", render: (row) => row.tenant?.name ?? "" },
    ],
  },
  {
    name: "schedule-songs",
    label: "Músicas da escala",
    titleField: "id",
    fields: [
      { key: "tenantId", label: "Igreja", type: "tenant" },
      { key: "scheduleId", label: "Escala", type: "schedule" },
      { key: "songId", label: "Música", type: "song" },
      { key: "order", label: "Ordem", type: "number" },
    ],
    columns: [
      { key: "schedule", label: "Escala", render: (row) => row.schedule?.title ?? "" },
      { key: "song", label: "Música", render: (row) => row.song?.title ?? "" },
      { key: "order", label: "Ordem" },
    ],
  },
  {
    name: "schedule-assignments",
    label: "Membros escalados",
    titleField: "role",
    fields: [
      { key: "tenantId", label: "Igreja", type: "tenant" },
      { key: "scheduleId", label: "Escala", type: "schedule" },
      { key: "userId", label: "Usuário", type: "user" },
      { key: "role", label: "Função" },
      { key: "status", label: "Status", type: "status" },
    ],
    columns: [
      { key: "schedule", label: "Escala", render: (row) => row.schedule?.title ?? "" },
      { key: "user", label: "Usuário", render: (row) => row.user?.name ?? "" },
      { key: "role", label: "Função" },
      { key: "status", label: "Status" },
    ],
  },
  {
    name: "audit-logs",
    label: "Logs",
    titleField: "action",
    readOnly: true,
    fields: [],
    columns: [
      { key: "createdAt", label: "Data", render: (row) => formatDate(row.createdAt) },
      { key: "action", label: "Ação" },
      { key: "resource", label: "Recurso" },
      { key: "actorRole", label: "Perfil" },
    ],
  },
];

const resourceByName = Object.fromEntries(resources.map((resource) => [resource.name, resource])) as Record<GlobalResourceName, ResourceConfig>;

function formatDate(value?: string): string {
  if (!value) return "";
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(value));
}

function getRowTitle(config: ResourceConfig, row: Row): string {
  return String(row[config.titleField] ?? row.name ?? row.title ?? row.id ?? "");
}

function rowStatus(row: Row): "active" | "inactive" {
  return row.isActive === false || row.deletedAt ? "inactive" : "active";
}

function getErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

async function loadAllReferenceItems(resource: GlobalResourceName): Promise<Row[]> {
  const items: Row[] = [];
  let page = 1;
  let totalPages = 1;

  do {
    const response = await adminService.getResource(resource, { page, limit: 100 });
    items.push(...response.items);
    totalPages = response.pagination.totalPages;
    page += 1;
  } while (page <= totalPages);

  return items;
}

export default function GlobalAdminScreen() {
  const { user } = useAuthStore();
  const viewport = typeof useWindowDimensions === "function" ? useWindowDimensions() : { width: 1280, height: 800 };
  const compactLayout = viewport.width < breakpoints.adminCompact;
  const [activeResource, setActiveResource] = useState<GlobalResourceName>("tenants");
  const [tenantFilter, setTenantFilter] = useState<string | undefined>();
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [items, setItems] = useState<Row[]>([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 25, total: 0, totalPages: 1 });
  const [references, setReferences] = useState<Record<string, Row[]>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [modal, setModal] = useState<{ mode: "create" | "edit"; row?: Row } | null>(null);
  const [permissionUser, setPermissionUser] = useState<Row | null>(null);

  const config = resourceByName[activeResource];

  const loadReferences = useCallback(async () => {
    try {
      const [tenants, users, ministries, instruments, artists, songs, schedules] = await Promise.all([
        loadAllReferenceItems("tenants"),
        loadAllReferenceItems("users"),
        loadAllReferenceItems("ministries"),
        loadAllReferenceItems("instruments"),
        loadAllReferenceItems("artists"),
        loadAllReferenceItems("songs"),
        loadAllReferenceItems("schedules"),
      ]);
      setReferences({
        tenants,
        users,
        ministries,
        instruments,
        artists,
        songs,
        schedules,
      });
    } catch (referenceError) {
      setError(getErrorMessage(referenceError, "Não foi possível carregar os dados auxiliares do painel global."));
    }
  }, []);

  const loadRows = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await adminService.getResource(activeResource, { tenantId: tenantFilter, search, page, limit: 25 });
      setItems(response.items);
      setPagination(response.pagination);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Não foi possível carregar dados.");
    } finally {
      setLoading(false);
    }
  }, [activeResource, page, search, tenantFilter]);

  useEffect(() => {
    if (isGlobalAdmin(user)) void loadReferences();
  }, [loadReferences, user?.role]);

  useEffect(() => {
    if (isGlobalAdmin(user)) void loadRows();
  }, [loadRows, user?.role]);

  function switchResource(resource: GlobalResourceName) {
    setActiveResource(resource);
    setPage(1);
    setSearch("");
  }

  async function reloadAll() {
    try {
      await Promise.all([loadRows(), loadReferences()]);
    } catch (reloadError) {
      setError(getErrorMessage(reloadError, "Não foi possível atualizar o painel global."));
    }
  }

  async function lifecycle(row: Row, action: "activate" | "deactivate" | "delete") {
    const title = getRowTitle(config, row);
    const message = action === "delete"
      ? `Excluir permanentemente "${title}"? Esta ação não pode ser desfeita.`
      : `${action === "activate" ? "Ativar" : "Inativar"} "${title}"?`;
    const execute = async () => {
      try {
        if (action === "activate") await adminService.activateResource(activeResource, row.id);
        if (action === "deactivate") await adminService.deactivateResource(activeResource, row.id);
        if (action === "delete") await adminService.deleteResource(activeResource, row.id);
        await reloadAll();
      } catch (actionError) {
        Alert.alert("Ação não realizada", actionError instanceof Error ? actionError.message : "Erro desconhecido.");
      }
    };

    const webConfirm = (globalThis as typeof globalThis & { confirm?: (message?: string) => boolean }).confirm;
    if (Platform.OS === "web" && typeof webConfirm === "function") {
      if (webConfirm(message)) void execute();
      return;
    }

    Alert.alert("Confirmar ação", message, [
      { text: "Cancelar", style: "cancel" },
      {
        text: action === "delete" ? "Excluir" : "Confirmar",
        style: action === "delete" ? "destructive" : "default",
        onPress: execute,
      },
    ]);
  }

  if (!isGlobalAdmin(user)) {
    return (
      <SafeAreaView style={styles.safe} edges={["left", "right"]}>
        <View style={styles.denied}>
          <ShieldAlert color={colors.danger} size={iconSizes.s30} strokeWidth={2.4} />
          <Text style={styles.deniedTitle}>Acesso negado</Text>
          <Text style={styles.deniedText}>Esta área é exclusiva para administradores globais.</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={["left", "right"]}>
      <View style={[styles.shell, compactLayout && styles.shellCompact]}>
        <ScrollView
          horizontal={compactLayout}
          style={[styles.sidebar, compactLayout && styles.sidebarCompact]}
          contentContainerStyle={[styles.sidebarContent, compactLayout && styles.sidebarContentCompact]}
          showsHorizontalScrollIndicator={false}
        >
          <Text style={styles.sidebarTitle}>Operação global</Text>
          {resources.map((resource) => (
            <TouchableOpacity
              key={resource.name}
              style={[styles.menuItem, compactLayout && styles.menuItemCompact, activeResource === resource.name && styles.menuItemActive]}
              onPress={() => switchResource(resource.name)}
              testID={`global-resource-${resource.name}`}
            >
              <Database color={colors.primaryDark} size={iconSizes.s16} strokeWidth={2.4} />
              <Text style={[styles.menuText, activeResource === resource.name && styles.menuTextActive]}>{resource.label}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        <ScrollView style={styles.main} contentContainerStyle={styles.mainContent}>
          <View style={styles.header}>
            <View style={styles.headerText}>
              <Text style={styles.title}>{config.label}</Text>
              <Text style={styles.subtitle}>CRUD global com busca, filtro por igreja e ciclo de vida.</Text>
            </View>
            <View style={styles.headerActions}>
              <TouchableOpacity style={styles.secondaryButton} onPress={reloadAll}>
                <RefreshCcw color={colors.primary} size={iconSizes.s16} strokeWidth={2.4} />
                <Text style={styles.secondaryButtonText}>Atualizar</Text>
              </TouchableOpacity>
              {!config.readOnly ? (
                <TouchableOpacity style={styles.primaryButton} onPress={() => setModal({ mode: "create" })}>
                  <Plus color={colors.white} size={iconSizes.s16} strokeWidth={2.4} />
                  <Text style={styles.primaryButtonText}>Novo</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          </View>

          <View style={styles.filters}>
            <TextInput style={styles.searchInput} placeholder="Buscar..." placeholderTextColor={colors.muted} value={search} onChangeText={(value) => { setSearch(value); setPage(1); }} />
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
              <Chip label="Todas as igrejas" active={!tenantFilter} onPress={() => { setTenantFilter(undefined); setPage(1); }} />
              {(references.tenants as GlobalTenant[] | undefined)?.map((tenant) => (
                <Chip key={tenant.id} label={tenant.name} active={tenantFilter === tenant.id} onPress={() => { setTenantFilter(tenant.id); setPage(1); }} />
              ))}
            </ScrollView>
          </View>

          <ErrorBanner
            message={error}
            style={styles.errorText}
            action={error ? (
              <Button
                title="Tentar novamente"
                variant="secondary"
                size="sm"
                style={styles.retryButton}
                onPress={() => void reloadAll()}
                accessibilityLabel="Tentar carregar painel global novamente"
              />
            ) : null}
          />
          {loading ? (
            <LoadingState centered={false} message="Carregando registros..." style={styles.loadingBox} />
          ) : (
            <View style={styles.table}>
              {!compactLayout ? <View style={styles.tableHeader}>
                {config.columns.map((column) => <Text key={column.key} style={styles.th}>{column.label}</Text>)}
                <Text style={styles.actionTh}>Ações</Text>
              </View> : null}
              {items.length === 0 ? (
                <EmptyState
                  title="Nenhum registro encontrado"
                  description="Altere os filtros ou crie um novo registro quando este recurso permitir."
                  style={styles.emptyState}
                />
              ) : items.map((row) => (
                <View
                  key={row.id}
                  style={[styles.tableRow, compactLayout && styles.tableRowCompact]}
                  testID={`global-admin-row-${row.id}`}
                >
                  {config.columns.map((column) => (
                    <View
                      key={column.key}
                      style={[styles.cell, compactLayout && styles.cellCompact]}
                      testID={`global-admin-cell-${row.id}-${column.key}`}
                    >
                      {compactLayout ? <Text style={styles.cellLabel}>{column.label}</Text> : null}
                      <Text style={styles.td} numberOfLines={compactLayout ? undefined : 2}>
                        {column.render ? column.render(row) : String(row[column.key] ?? "")}
                      </Text>
                    </View>
                  ))}
                  <View style={[styles.actions, compactLayout && styles.actionsCompact]}>
                    <StatusPill status={rowStatus(row)} />
                    {!config.readOnly ? (
                      <>
                        <IconButton label="Editar" icon="edit" onPress={() => setModal({ mode: "edit", row })} />
                        {activeResource === "users" && row.id !== user?.id && row.role !== "GLOBAL_ADMIN" ? (
                          <PermissionButton onPress={() => setPermissionUser(row)} />
                        ) : null}
                        {rowStatus(row) === "active" ? (
                          <IconButton label="Inativar" icon="deactivate" onPress={() => lifecycle(row, "deactivate")} />
                        ) : (
                          <IconButton label="Ativar" icon="activate" onPress={() => lifecycle(row, "activate")} />
                        )}
                        <IconButton label="Excluir" icon="delete" danger onPress={() => lifecycle(row, "delete")} />
                      </>
                    ) : null}
                  </View>
                </View>
              ))}
            </View>
          )}

          <View style={styles.pagination}>
            <TouchableOpacity style={styles.secondaryButton} disabled={page <= 1} onPress={() => setPage((current) => Math.max(1, current - 1))}>
              <Text style={styles.secondaryButtonText}>Anterior</Text>
            </TouchableOpacity>
            <Text style={styles.pageText}>Página {pagination.page} de {pagination.totalPages} · {pagination.total} registros</Text>
            <TouchableOpacity style={styles.secondaryButton} disabled={page >= pagination.totalPages} onPress={() => setPage((current) => current + 1)}>
              <Text style={styles.secondaryButtonText}>Próxima</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </View>

      <ResourceModal
        visible={Boolean(modal)}
        config={config}
        mode={modal?.mode ?? "create"}
        row={modal?.row}
        references={references}
        onClose={() => setModal(null)}
        onSave={async (payload) => {
          try {
            if (modal?.mode === "edit" && modal.row?.id) await adminService.updateResource(activeResource, modal.row.id, payload);
            else await adminService.createResource(activeResource, payload);
            setModal(null);
            await reloadAll();
          } catch (saveError) {
            Alert.alert("Não foi possível salvar", saveError instanceof Error ? saveError.message : "Erro desconhecido.");
          }
        }}
      />
      <PermissionModal
        visible={Boolean(permissionUser)}
        user={permissionUser}
        onClose={() => setPermissionUser(null)}
        onSaved={reloadAll}
      />
    </SafeAreaView>
  );
}

function ResourceModal({
  visible,
  config,
  mode,
  row,
  references,
  onClose,
  onSave,
}: {
  visible: boolean;
  config: ResourceConfig;
  mode: "create" | "edit";
  row?: Row;
  references: Record<string, Row[]>;
  onClose: () => void;
  onSave: (payload: Row) => Promise<void>;
}) {
  const [form, setForm] = useState<Row>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!visible) return;
    const initial: Row = {};
    for (const field of config.fields) {
      initial[field.key] = mode === "edit" ? row?.[field.key] ?? "" : defaultValue(field);
    }
    setForm(initial);
  }, [config, mode, row, visible]);

  function setValue(key: string, value: unknown) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function submit() {
    setSaving(true);
    try {
      const payload: Row = {};
      for (const field of config.fields) {
        if (field.createOnly && mode === "edit") continue;
        const value = form[field.key];
        if (mode === "edit" && field.key === "password" && (value === "" || value === undefined || value === null)) continue;
        if ((value === "" || value === undefined) && field.optional) payload[field.key] = null;
        else if (field.type === "number") payload[field.key] = value === "" || value === null ? null : Number(value);
        else payload[field.key] = value;
      }
      await onSave(payload);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.modalBackdrop}>
        <View style={styles.modalCard}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{mode === "edit" ? "Editar" : "Novo"} · {config.label}</Text>
            <TouchableOpacity onPress={onClose}><X color={colors.text} size={iconSizes.s22} /></TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={styles.modalBody}>
            {config.fields.map((field) => (
              <FieldInput key={field.key} field={field} value={form[field.key]} references={references} onChange={(value) => setValue(field.key, value)} />
            ))}
          </ScrollView>
          <View style={styles.modalFooter}>
            <TouchableOpacity style={styles.secondaryButton} onPress={onClose}><Text style={styles.secondaryButtonText}>Cancelar</Text></TouchableOpacity>
            <TouchableOpacity style={[styles.primaryButton, saving && styles.disabled]} onPress={submit} disabled={saving}>
              <Text style={styles.primaryButtonText}>{saving ? "Salvando..." : "Salvar"}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

function FieldInput({ field, value, references, onChange }: { field: FieldConfig; value: any; references: Record<string, Row[]>; onChange: (value: unknown) => void }) {
  const type = field.type ?? "text";
  if (type === "richtext") {
    return <View style={styles.field}><RichCommentEditor value={value === null || value === undefined ? "" : String(value)} onChange={onChange} label={field.label} /></View>;
  }
  if (["tenant", "user", "ministry", "instrument", "artist", "song", "schedule", "role", "status", "boolean"].includes(type)) {
    const options = getOptions(type, references);
    return (
      <View style={styles.field}>
        <Text style={styles.fieldLabel}>{field.label}</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
          {field.optional ? <Chip label="Nenhum" active={value === null || value === "" || value === undefined} onPress={() => onChange(null)} /> : null}
          {options.map((option) => <Chip key={String(option.value)} label={option.label} active={value === option.value} onPress={() => onChange(option.value)} />)}
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{field.label}</Text>
      {type === "datetime" ? (
        <DateTimeInput
          type="date"
          value={value === null || value === undefined ? "" : String(value)}
          onChange={onChange}
          placeholder="2026-07-08T20:00:00.000Z"
          keyboardType="default"
          maskInput={false}
        />
      ) : (
        <TextInput
          style={[styles.input, type === "textarea" && styles.textArea]}
          value={value === null || value === undefined ? "" : String(value)}
          onChangeText={onChange}
          multiline={type === "textarea"}
          keyboardType={type === "number" ? "numeric" : "default"}
          placeholderTextColor={colors.muted}
        />
      )}
    </View>
  );
}

function getOptions(type: FieldType, references: Record<string, Row[]>) {
  if (type === "role") return roles.map((role) => ({ value: role, label: roleLabel(role) }));
  if (type === "status") return statuses.map((status) => ({ value: status, label: status }));
  if (type === "boolean") return [{ value: true, label: "Sim" }, { value: false, label: "Não" }];
  const resourceMap: Record<string, string> = {
    tenant: "tenants",
    user: "users",
    ministry: "ministries",
    instrument: "instruments",
    artist: "artists",
    song: "songs",
    schedule: "schedules",
  };
  return (references[resourceMap[type]] ?? []).map((item) => ({ value: item.id, label: item.name ?? item.title ?? item.email ?? item.id }));
}

function defaultValue(field: FieldConfig) {
  if (field.type === "boolean") return true;
  if (field.type === "role") return "MEMBER";
  if (field.type === "status") return field.key === "status" ? "PENDING" : "";
  if (field.type === "number") return "";
  return "";
}

function roleLabel(role: Role) {
  const labels: Record<Role, string> = {
    GLOBAL_ADMIN: "Admin global",
    TENANT_ADMIN: "Admin igreja",
    MINISTRY_LEADER: "Líder",
    MEMBER: "Membro",
  };
  return labels[role];
}

function Chip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <TouchableOpacity style={[styles.chip, active && styles.chipActive]} onPress={onPress}>
      <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
    </TouchableOpacity>
  );
}

function StatusPill({ status }: { status: "active" | "inactive" | string }) {
  return (
    <MemberStatusBadge
      status={status === "active" ? "ACTIVE" : status === "inactive" ? "INACTIVE" : status}
      label={status === "active" ? "Ativo" : status === "inactive" ? "Inativo" : undefined}
    />
  );
}

function PermissionModal({
  visible,
  user,
  onClose,
  onSaved,
}: {
  visible: boolean;
  user: Row | null;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const [catalog, setCatalog] = useState<Permission[]>([]);
  const [baselineKeys, setBaselineKeys] = useState<PermissionKey[]>([]);
  const [overrideByKey, setOverrideByKey] = useState<PermissionOverrideMap>({});
  const [effectiveKeys, setEffectiveKeys] = useState<PermissionKey[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (!visible || !user?.id) return;
    const userId = String(user.id);
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const [permissions, userPermissions] = await Promise.all([
          adminService.listPermissions(),
          adminService.listUserPermissions(userId),
        ]);
        if (cancelled) return;
        setCatalog(permissions);
        setBaselineKeys(userPermissions.baseline);
        setOverrideByKey(Object.fromEntries(
          userPermissions.overrides.map((override) => [override.permission.key, override.effect])
        ) as PermissionOverrideMap);
        setEffectiveKeys(userPermissions.effective);
      } catch (loadError) {
        if (!cancelled) {
          setError(`${getErrorMessage(loadError, "Não foi possível carregar permissões do usuário.")} Verifique se o backend publicado já possui os endpoints /admin/permissions e /admin/users/:id/permissions.`);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [user?.id, visible]);

  function cyclePermission(key: PermissionKey) {
    setOverrideByKey((current) => {
      const effect = current[key];
      const next = nextPermissionEffect(effect);
      const updated = { ...current };
      if (next) updated[key] = next;
      else delete updated[key];
      setEffectiveKeys(effectivePermissionsFromOverrides(baselineKeys, updated));
      return updated;
    });
  }

  async function save() {
    if (!user?.id) return;
    setSaving(true);
    setError(null);
    try {
      const overrides = Object.entries(overrideByKey).map(([permissionKey, effect]) => ({
        permissionKey: permissionKey as PermissionKey,
        effect: effect as PermissionEffect,
      }));
      const userPermissions = await adminService.setUserPermissions(String(user.id), overrides);
      setBaselineKeys(userPermissions.baseline);
      setOverrideByKey(Object.fromEntries(
        userPermissions.overrides.map((override) => [override.permission.key, override.effect])
      ) as PermissionOverrideMap);
      setEffectiveKeys(userPermissions.effective);
      await onSaved();
      onClose();
    } catch (saveError) {
      setError(getErrorMessage(saveError, "Não foi possível salvar permissões."));
    } finally {
      setSaving(false);
    }
  }

  const grouped = catalog.reduce<Record<string, Permission[]>>((acc, permission) => {
    acc[permission.category] = [...(acc[permission.category] ?? []), permission];
    return acc;
  }, {});

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.modalBackdrop}>
        <View style={styles.modalCard}>
          <View style={styles.modalHeader}>
            <View style={styles.headerText}>
              <Text style={styles.modalTitle}>Permissões granulares</Text>
              <Text style={styles.subtitle}>{user?.name ?? "Usuário"} · {user?.email ?? ""}</Text>
            </View>
            <TouchableOpacity onPress={onClose} accessibilityRole="button" accessibilityLabel="Fechar permissões"><X color={colors.text} size={iconSizes.s22} /></TouchableOpacity>
          </View>
          {loading ? (
            <LoadingState centered={false} message="Carregando permissões..." style={styles.loadingBox} />
          ) : (
            <ScrollView contentContainerStyle={styles.modalBody}>
              <ErrorBanner message={error} />
              <Text style={styles.mutedText}>
                Permissões explícitas são aplicadas ao tenant do usuário quando houver igreja vinculada.
              </Text>
              {effectiveKeys.length ? (
                <Text style={styles.mutedText}>
                  Efetivas atualmente: {effectiveKeys.length}. Marque abaixo as permissões explícitas deste usuário.
                </Text>
              ) : null}
              <Text style={styles.mutedText}>Toque para alternar: Herdado → Permitido → Negado.</Text>
              {Object.entries(grouped).map(([category, permissions]) => (
                <View key={category} style={styles.permissionGroup}>
                  <Text style={styles.fieldLabel}>{category}</Text>
                  <View style={styles.permissionGrid}>
                    {permissions.filter((permission) => permission.assignable).map((permission) => {
                      const effect = overrideByKey[permission.key];
                      const active = effectiveKeys.includes(permission.key);
                      const stateLabel = effect === "ALLOW" ? "Permitido" : effect === "DENY" ? "Negado" : "Herdado";
                      return (
                        <TouchableOpacity
                          key={permission.key}
                          style={[
                            styles.permissionOption,
                            effect === undefined && styles.permissionOptionInherited,
                            active && styles.permissionOptionActive,
                          ]}
                          onPress={() => cyclePermission(permission.key)}
                          accessibilityRole="checkbox"
                          accessibilityState={{ checked: active }}
                          accessibilityLabel={permission.description}
                        >
                          <Text style={[styles.permissionOptionTitle, active && styles.permissionOptionTitleActive]}>
                            {permission.description}
                          </Text>
                          <Text style={[styles.permissionOptionKey, active && styles.permissionOptionKeyActive]}>
                            {permission.key}
                          </Text>
                          <Text style={styles.mutedText}>{stateLabel}</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>
              ))}
            </ScrollView>
          )}
          <View style={styles.modalFooter}>
            <TouchableOpacity style={styles.secondaryButton} onPress={onClose}><Text style={styles.secondaryButtonText}>Cancelar</Text></TouchableOpacity>
            <TouchableOpacity style={[styles.primaryButton, saving && styles.disabled]} onPress={save} disabled={saving || loading}>
              <Text style={styles.primaryButtonText}>{saving ? "Salvando..." : "Salvar permissões"}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

function PermissionButton({ onPress }: { onPress: () => void }) {
  return (
    <TouchableOpacity style={styles.iconButton} onPress={onPress} accessibilityRole="button" accessibilityLabel="Gerenciar permissões granulares">
      <ShieldAlert color={colors.primary} size={iconSizes.s14} strokeWidth={2.5} />
      <Text style={styles.iconButtonText}>Permissões</Text>
    </TouchableOpacity>
  );
}

function IconButton({ label, icon, danger, onPress }: { label: string; icon: "edit" | "activate" | "deactivate" | "delete"; danger?: boolean; onPress: () => void }) {
  const Icon = icon === "edit" ? Edit3 : icon === "activate" ? CheckCircle2 : icon === "deactivate" ? XCircle : Trash2;
  return (
    <TouchableOpacity style={[styles.iconButton, danger && styles.iconButtonDanger]} onPress={onPress}>
      <Icon color={danger ? colors.danger : colors.primary} size={iconSizes.s14} strokeWidth={2.5} />
      <Text style={[styles.iconButtonText, danger && styles.iconButtonTextDanger]}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  shell: { flex: 1, flexDirection: "row", width: "100%", maxWidth: screen.listMaxWidth, alignSelf: "center" },
  shellCompact: { flexDirection: "column" },
  sidebar: {
    width: 176,
    minWidth: 176,
    maxWidth: 176,
    flexBasis: 176,
    flexGrow: 0,
    flexShrink: 0,
    backgroundColor: colors.surface,
    borderRightWidth: 1,
    borderRightColor: colors.line,
  },
  sidebarCompact: { width: "100%", minWidth: "100%", maxWidth: "100%", flexBasis: "auto", flexGrow: 0, borderRightWidth: 0, borderBottomWidth: 1, borderBottomColor: colors.line },
  sidebarContent: { padding: spacing.sm, gap: spacing.xs },
  sidebarContentCompact: { flexDirection: "row", alignItems: "center" },
  sidebarTitle: { color: colors.ink, fontSize: fontSizes.s13, fontWeight: fontWeights.black, marginBottom: spacing.sm },
  menuItem: { minHeight: controlSizes.default, borderLeftWidth: 3, borderLeftColor: "transparent", paddingHorizontal: spacing.sm, flexDirection: "row", alignItems: "center", gap: spacing.sm },
  menuItemCompact: { borderLeftWidth: 0, borderBottomWidth: 3, borderBottomColor: "transparent" },
  menuItemActive: { backgroundColor: colors.primarySoft, borderLeftColor: colors.accent, borderBottomColor: colors.accent },
  menuText: { color: colors.text, fontSize: fontSizes.s12, fontWeight: fontWeights.extrabold, flex: 1, flexShrink: 1, lineHeight: lineHeights.h15 },
  menuTextActive: { color: colors.primaryDark },
  main: { flex: 1 },
  mainContent: { padding: spacing.lg, paddingBottom: screen.contentBottomPadding, gap: spacing.lg },
  header: { flexDirection: "row", justifyContent: "space-between", gap: spacing.md, alignItems: "flex-start", flexWrap: "wrap" },
  headerText: { flex: 1, minWidth: 220 },
  title: { color: colors.ink, fontSize: fontSizes.s30, fontWeight: fontWeights.black },
  subtitle: { color: colors.muted, fontSize: fontSizes.s14, fontWeight: fontWeights.bold, marginTop: spacing.xs },
  headerActions: { flexDirection: "row", gap: spacing.sm, flexWrap: "wrap", justifyContent: "flex-end", flexShrink: 0 },
  primaryButton: { minHeight: 42, borderRadius: radii.md, backgroundColor: colors.primary, paddingHorizontal: spacing.md, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm },
  primaryButtonText: { color: colors.white, fontSize: fontSizes.s13, fontWeight: fontWeights.black },
  secondaryButton: { minHeight: 42, borderRadius: radii.md, backgroundColor: colors.primarySoft, paddingHorizontal: spacing.md, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm },
  secondaryButtonText: { color: colors.primary, fontSize: fontSizes.s13, fontWeight: fontWeights.black },
  filters: { backgroundColor: "transparent", borderTopWidth: 1, borderBottomWidth: 1, borderColor: colors.line, paddingVertical: spacing.md, gap: spacing.md },
  searchInput: { minHeight: controlSizes.default, borderWidth: 1, borderColor: colors.line, borderRadius: radii.md, backgroundColor: colors.background, paddingHorizontal: spacing.md, color: colors.ink, fontSize: fontSizes.s14, fontWeight: fontWeights.bold },
  chips: { gap: spacing.sm, alignItems: "center" },
  chip: { borderRadius: radii.pill, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surfaceMuted, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { color: colors.text, fontSize: fontSizes.s12, fontWeight: fontWeights.black },
  chipTextActive: { color: colors.white },
  table: { backgroundColor: colors.surface, borderTopWidth: 1, borderBottomWidth: 1, borderColor: colors.line, overflow: "hidden" },
  tableHeader: { flexDirection: "row", backgroundColor: colors.surfaceMuted, padding: spacing.md, gap: spacing.md, alignItems: "center" },
  th: { flex: 1, color: colors.text, fontSize: fontSizes.s12, fontWeight: fontWeights.black },
  actionTh: { width: 165, color: colors.text, fontSize: fontSizes.s12, fontWeight: fontWeights.black },
  tableRow: { flexDirection: "row", padding: spacing.md, gap: spacing.md, borderTopWidth: 1, borderTopColor: colors.line, alignItems: "center" },
  tableRowCompact: { flexDirection: "column", alignItems: "stretch", gap: spacing.md },
  cell: { flex: 1 },
  cellCompact: {
    width: "100%",
    flexGrow: 0,
    flexShrink: 0,
    flexBasis: "auto",
    gap: spacing.xs,
  },
  cellLabel: { color: colors.muted, fontSize: fontSizes.s11, lineHeight: lineHeights.h15, fontWeight: fontWeights.black, letterSpacing: 0.6, textTransform: "uppercase" },
  td: { color: colors.ink, fontSize: fontSizes.s13, lineHeight: lineHeights.h18, fontWeight: fontWeights.bold, flexShrink: 1 },
  actions: { width: 165, flexDirection: "row", gap: spacing.xs, flexWrap: "wrap", alignItems: "center" },
  actionsCompact: { width: "100%", marginTop: spacing.xs },
  iconButton: { minHeight: 30, borderRadius: radii.sm, backgroundColor: colors.surfaceMuted, paddingHorizontal: spacing.sm, flexDirection: "row", alignItems: "center", gap: spacing.xs },
  iconButtonDanger: { backgroundColor: colors.dangerSoft },
  iconButtonText: { color: colors.primary, fontSize: fontSizes.s11, fontWeight: fontWeights.black },
  iconButtonTextDanger: { color: colors.danger },
  pagination: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: spacing.md, flexWrap: "wrap" },
  pageText: { color: colors.muted, fontSize: fontSizes.s13, fontWeight: fontWeights.extrabold },
  loadingBox: { padding: spacing.xl, alignItems: "center" },
  mutedText: { color: colors.muted, fontSize: fontSizes.s14, fontWeight: fontWeights.bold },
  errorText: { marginBottom: spacing.sm },
  retryButton: { alignSelf: "flex-start" },
  emptyState: { borderWidth: 0, shadowOpacity: 0, elevation: 0 },
  modalBackdrop: { flex: 1, backgroundColor: overlays.modalWarm, alignItems: "center", justifyContent: "center", padding: spacing.lg },
  modalCard: { width: "100%", maxWidth: screen.listMaxWidth, maxHeight: "90%", backgroundColor: colors.surface, borderRadius: radii.lg, borderWidth: 1, borderColor: colors.line, ...shadow },
  modalHeader: { padding: spacing.lg, borderBottomWidth: 1, borderBottomColor: colors.line, flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  modalTitle: { color: colors.ink, fontSize: fontSizes.s18, fontWeight: fontWeights.black },
  modalBody: { padding: spacing.lg, gap: spacing.md },
  modalFooter: { padding: spacing.lg, borderTopWidth: 1, borderTopColor: colors.line, flexDirection: "row", justifyContent: "flex-end", gap: spacing.sm },
  field: { gap: spacing.xs },
  fieldLabel: { color: colors.text, fontSize: fontSizes.s12, fontWeight: fontWeights.black },
  input: { minHeight: 42, borderWidth: 1, borderColor: colors.line, borderRadius: radii.md, backgroundColor: colors.background, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, color: colors.ink, fontSize: fontSizes.s14, fontWeight: fontWeights.bold },
  textArea: { minHeight: 140, textAlignVertical: "top" },
  permissionGroup: { gap: spacing.sm },
  permissionGrid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  permissionOption: {
    width: "48%",
    minWidth: 220,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surfaceMuted,
    padding: spacing.md,
  },
  permissionOptionActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft,
  },
  permissionOptionInherited: {
    borderColor: colors.line,
    backgroundColor: colors.surface,
    opacity: 0.72,
  },
  permissionOptionTitle: { color: colors.ink, fontSize: fontSizes.s13, fontWeight: fontWeights.black },
  permissionOptionTitleActive: { color: colors.primaryDark },
  permissionOptionKey: { color: colors.muted, fontSize: fontSizes.s11, fontWeight: fontWeights.bold, marginTop: spacing.xs },
  permissionOptionKeyActive: { color: colors.primary },
  disabled: { opacity: 0.6 },
  denied: { flex: 1, padding: spacing.xl, alignItems: "center", justifyContent: "center", gap: spacing.sm },
  deniedTitle: { color: colors.ink, fontSize: fontSizes.s22, fontWeight: fontWeights.black },
  deniedText: { color: colors.muted, fontSize: fontSizes.s15, fontWeight: fontWeights.bold, textAlign: "center" },
});
