import React from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { Copy, Download, Edit3 } from "lucide-react-native";
import { Button, Card, RichCommentView, ScheduleStatusBadge } from "../ui";
import { colors, radii, spacing, typography } from "../../theme";
import { Schedule, ScheduleAssignment } from "../../types";

const weekday = new Intl.DateTimeFormat("pt-BR", { weekday: "short" });
const time = new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit" });

type ScheduleCardProps = {
  schedule: Schedule;
  assignment?: ScheduleAssignment;
  canManage?: boolean;
  updating?: boolean;
  exporting?: boolean;
  exportingSongs?: boolean;
  duplicating?: boolean;
  onEdit?: () => void;
  onDuplicate?: () => void;
  onExport?: () => void;
  onExportSongs?: () => void;
  onAccept?: () => void;
  onDecline?: () => void;
  onRequestSubstitute?: () => void;
  onResolveSubstitution?: (assignment: ScheduleAssignment) => void;
};

function statusCounts(schedule: Schedule) {
  return (schedule.assignments ?? []).reduce(
    (result, assignment) => ({
      pending: result.pending + (assignment.status === "PENDING" ? 1 : 0),
      accepted: result.accepted + (assignment.status === "ACCEPTED" ? 1 : 0),
      declined: result.declined + (assignment.status === "DECLINED" ? 1 : 0),
    }),
    { pending: 0, accepted: 0, declined: 0 }
  );
}

export function ScheduleCard({
  schedule,
  assignment,
  canManage = false,
  updating = false,
  exporting = false,
  exportingSongs = false,
  duplicating = false,
  onEdit,
  onDuplicate,
  onExport,
  onExportSongs,
  onAccept,
  onDecline,
  onRequestSubstitute,
  onResolveSubstitution,
}: ScheduleCardProps) {
  const date = new Date(schedule.date);
  const counts = statusCounts(schedule);
  const isPending = assignment?.status === "PENDING";

  return (
    <Card style={styles.card}>
      <Pressable
        style={({ hovered, pressed }: any) => [
          styles.pressArea,
          canManage && styles.clickable,
          hovered && canManage && styles.hover,
          pressed && canManage && styles.pressed,
        ]}
        onPress={canManage ? onEdit : undefined}
        accessibilityRole={canManage ? "button" : undefined}
        accessibilityLabel={canManage ? `Editar escala ${schedule.title}` : undefined}
      >
        <View style={styles.summaryDate}>
          <Text style={styles.dayNumber}>{date.getDate()}</Text>
          <Text style={styles.weekday}>{weekday.format(date).replace(".", "")}</Text>
        </View>
        <View style={styles.body}>
          <View style={styles.titleRow}>
            <View style={styles.titleText}>
              <Text style={styles.cardTime}>{time.format(date)}</Text>
              <Text style={styles.cardTitle}>{schedule.title}</Text>
            </View>
            {assignment ? <ScheduleStatusBadge status={assignment.status} /> : null}
          </View>
          <Text style={styles.detail}>Ministério: {schedule.ministry?.name ?? "Não informado"}</Text>
          <Text style={styles.detail}>Membros escalados: {schedule.assignments?.length ?? 0}</Text>
          <View style={styles.statusSummary}>
            <Text style={styles.statusText}>Pendentes: {counts.pending}</Text>
            <Text style={styles.statusText}>Aceites: {counts.accepted}</Text>
            <Text style={styles.statusText}>Recusas: {counts.declined}</Text>
          </View>
          {schedule.songs?.length ? (
            <Text style={styles.detail}>Musicas: {schedule.songs.map((entry) => entry.song.title).join(", ")}</Text>
          ) : null}
          {schedule.comments ? <View style={styles.comments}><Text style={styles.commentsTitle}>Comentários</Text><RichCommentView value={schedule.comments} numberOfLines={5} /></View> : null}
          {schedule.assignments?.length ? (
            <View style={styles.membersList}>
              {schedule.assignments.map((item) => (
                <View key={item.id} style={styles.memberRow}>
                  <Text style={styles.memberName}>{item.user?.name ?? "Membro"}</Text>
                  <Text style={styles.memberRole}>{item.role}</Text>
                  <ScheduleStatusBadge status={item.status} />
                  {item.declineReason ? <Text style={styles.reason}>Motivo: {item.declineReason}</Text> : null}
                  {item.substituteRequestedAt && !item.substituteResolvedAt ? (
                    <View style={styles.substitutionRow}>
                      <Text style={styles.substitutionText}>Substituto solicitado</Text>
                      {canManage && onResolveSubstitution ? (
                        <Button title="Resolver" variant="secondary" size="sm" onPress={() => onResolveSubstitution(item)} accessibilityLabel={`Resolver substituição de ${item.user?.name ?? "membro"}`} />
                      ) : null}
                    </View>
                  ) : null}
                </View>
              ))}
            </View>
          ) : null}
          {assignment ? (
            <Text style={styles.status}>Minha atribuicao: {assignment.role}</Text>
          ) : null}
        </View>
      </Pressable>

      <View style={styles.actions}>
        {canManage ? (
          <>
            <Button title="Editar" icon={<Edit3 color={colors.primary} size={16} />} variant="secondary" size="sm" onPress={onEdit} accessibilityLabel={`Editar escala ${schedule.title}`} />
            <Button title={duplicating ? "Duplicando..." : "Duplicar"} icon={duplicating ? <ActivityIndicator color={colors.primary} /> : <Copy color={colors.primary} size={16} />} variant="secondary" size="sm" disabled={duplicating} onPress={onDuplicate} accessibilityLabel={`Duplicar escala ${schedule.title}`} />
          </>
        ) : null}
        {onExport ? (
          <Button title={exporting ? "Gerando..." : "Relatório"} icon={<Download color={colors.primary} size={16} />} loading={exporting} variant="secondary" size="sm" onPress={onExport} accessibilityLabel={`Gerar relatório da escala ${schedule.title}`} />
        ) : null}
        {onExportSongs ? (
          <Button title={exportingSongs ? "Gerando..." : "Cifras"} icon={<Download color={colors.primary} size={16} />} loading={exportingSongs} variant="secondary" size="sm" onPress={onExportSongs} accessibilityLabel={`Exportar cifras da escala ${schedule.title}`} />
        ) : null}
      </View>

      {isPending && assignment ? (
        <View style={styles.responseActions}>
          <Button title={updating ? "Atualizando..." : "Aceitar"} size="sm" disabled={updating} onPress={onAccept} accessibilityLabel="Aceitar escala" />
          <Button title="Recusar" variant="ghost" size="sm" disabled={updating} onPress={onDecline} accessibilityLabel="Recusar escala" />
          <Button title="Solicitar substituto" variant="secondary" size="sm" disabled={updating} onPress={onRequestSubstitute} accessibilityLabel="Solicitar substituto" />
        </View>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: spacing.lg,
    marginBottom: 0,
    borderRadius: 0,
    borderTopWidth: 0,
    borderLeftWidth: 0,
    borderRightWidth: 0,
  },
  pressArea: { flexDirection: "row", borderRadius: radii.sm },
  clickable: { cursor: "pointer" } as any,
  hover: { backgroundColor: colors.primarySoft },
  pressed: { opacity: 0.86 },
  summaryDate: { width: 58, alignItems: "center", paddingTop: spacing.xs },
  dayNumber: { color: colors.primary, fontSize: 28, fontWeight: "700", lineHeight: 33 },
  weekday: { ...typography.badge, color: colors.muted, textTransform: "uppercase" },
  body: { flex: 1 },
  titleRow: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: spacing.sm },
  titleText: { flex: 1 },
  cardTime: { ...typography.label, color: colors.primary },
  cardTitle: { ...typography.cardTitle, color: colors.ink, marginTop: spacing.xs, marginBottom: spacing.xs },
  detail: { ...typography.metadata, color: colors.text, marginTop: 2 },
  comments: { marginTop: spacing.md, padding: spacing.md, borderRadius: radii.md, backgroundColor: colors.surfaceMuted },
  commentsTitle: { ...typography.label, color: colors.ink, marginBottom: spacing.xs },
  status: { ...typography.badge, color: colors.primary, marginTop: spacing.xs },
  statusSummary: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, marginTop: spacing.sm },
  statusText: { ...typography.badge, color: colors.text },
  membersList: { gap: spacing.xs, marginTop: spacing.md },
  memberRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, flexWrap: "wrap" },
  memberName: { ...typography.label, color: colors.ink },
  memberRole: { ...typography.metadata, color: colors.text },
  reason: { ...typography.metadata, color: colors.danger, width: "100%" },
  substitutionRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, width: "100%", flexWrap: "wrap" },
  substitutionText: { ...typography.badge, color: colors.warning },
  actions: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, marginLeft: 58, marginTop: spacing.md },
  responseActions: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, marginLeft: 58, marginTop: spacing.md },
});
