import React, { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Alert, Modal, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { AppBackButton } from "../../../../src/components/AppBackButton";
import { memberService } from "../../../../src/services/memberService";
import { ministryApi } from "../../../../src/services/ministryApi";
import { musicService } from "../../../../src/services/musicService";
import { useAuthStore } from "../../../../src/store/authStore";
import { useScheduleStore } from "../../../../src/store/scheduleStore";
import { Member, Ministry, MinistryMember, ScheduleAssignment, Song } from "../../../../src/types";
import { colors, radii, screen, shadow, spacing } from "../../../../src/theme";
import { combineDisplayDateTimeToIso, maskDateInput, maskTimeInput, toDisplayDate } from "../../../../src/utils/dateTimeInput";

function canManageSchedules(role?: string | null) {
  return role === "GLOBAL_ADMIN" || role === "TENANT_ADMIN" || role === "MINISTRY_LEADER";
}

function timeValue(value: string) {
  const date = new Date(value);
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

export default function EditScheduleScreen() {
  const params = useLocalSearchParams<{ id?: string | string[] }>();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const { allSchedules, loadSchedules, updateSchedule, saving, error } = useScheduleStore();
  const schedule = allSchedules.find((item) => item.id === id);
  const [title, setTitle] = useState("");
  const [date, setDate] = useState("");
  const [hour, setHour] = useState("19:00");
  const [ministries, setMinistries] = useState<Ministry[]>([]);
  const [ministryId, setMinistryId] = useState("");
  const [members, setMembers] = useState<Member[]>([]);
  const [ministryMembers, setMinistryMembers] = useState<MinistryMember[]>([]);
  const [songs, setSongs] = useState<Song[]>([]);
  const [selectedMembers, setSelectedMembers] = useState<Array<{ userId: string; role: string; status?: ScheduleAssignment["status"] }>>([]);
  const [selectedSongIds, setSelectedSongIds] = useState<string[]>([]);
  const [membersModal, setMembersModal] = useState(false);
  const [songsModal, setSongsModal] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void loadSchedules();
  }, [loadSchedules]);

  useEffect(() => {
    if (!schedule) return;
    const scheduleDate = new Date(schedule.date);
    setTitle(schedule.title);
    setDate(toDisplayDate(scheduleDate));
    setHour(timeValue(schedule.date));
    setMinistryId(schedule.ministryId);
    setSelectedSongIds(schedule.songs?.map((entry) => entry.songId) ?? []);
    setSelectedMembers(schedule.assignments?.map((entry) => ({ userId: entry.userId, role: entry.role, status: entry.status })) ?? []);
  }, [schedule?.id]);

  useEffect(() => {
    if (!canManageSchedules(user?.role)) return;
    let mounted = true;
    Promise.all([ministryApi.getMinistries(), memberService.listMembers(), musicService.listSongs("", 1, 100)])
      .then(([ministryResult, memberResult, songResult]) => {
        if (!mounted) return;
        setMinistries(ministryResult);
        setMembers(memberResult);
        setSongs(songResult.items);
      })
      .catch((reason) => Alert.alert("Erro", reason instanceof Error ? reason.message : "Não foi possível carregar dados da escala."))
      .finally(() => { if (mounted) setLoading(false); });
    return () => { mounted = false; };
  }, [user?.role]);

  useEffect(() => {
    if (!ministryId) {
      setMinistryMembers([]);
      return;
    }
    void ministryApi.listMembers(ministryId, { status: "ACTIVE", limit: 100 }).then((result) => setMinistryMembers(result.items)).catch(() => setMinistryMembers([]));
  }, [ministryId]);

  const availableMembers = useMemo(() => {
    if (user?.role === "MINISTRY_LEADER") {
      const ids = new Set(ministryMembers.map((item) => item.userId));
      return members.filter((member) => ids.has(member.id));
    }
    return members;
  }, [members, ministryMembers, user?.role]);

  const selectedMemberDetails = useMemo(
    () => selectedMembers.map((entry) => ({ ...entry, member: members.find((member) => member.id === entry.userId) })).filter((entry) => entry.member),
    [members, selectedMembers]
  );
  const selectedSongs = useMemo(() => selectedSongIds.map((songId) => songs.find((song) => song.id === songId)).filter(Boolean) as Song[], [selectedSongIds, songs]);

  const toggleSong = (songId: string) => setSelectedSongIds((current) => current.includes(songId) ? current.filter((item) => item !== songId) : [...current, songId]);
  const toggleMember = (userId: string) => setSelectedMembers((current) => current.some((item) => item.userId === userId)
    ? current.filter((item) => item.userId !== userId)
    : [...current, { userId, role: "Membro", status: "PENDING" }]);

  const save = async () => {
    if (!id) return;
    if (!title.trim()) return Alert.alert("Dados incompletos", "Informe o nome da escala.");
    const isoDate = combineDisplayDateTimeToIso(date, hour);
    if (!isoDate) return Alert.alert("Data ou horário inválido", "Informe data no formato DD/MM/AAAA e horário no formato HH:mm.");
    try {
      await updateSchedule(id, {
        title: title.trim(),
        date: isoDate,
        ministryId,
        songIds: selectedSongIds,
        assignments: selectedMembers.map((entry) => ({ userId: entry.userId, role: entry.role, status: entry.status ?? "PENDING" })),
      });
      router.replace("/schedules" as never);
    } catch (reason) {
      Alert.alert("Erro", reason instanceof Error ? reason.message : "Não foi possível atualizar a escala.");
    }
  };

  if (!canManageSchedules(user?.role)) {
    return <View style={styles.center}><Text style={styles.error}>Você não tem permissão para editar escalas.</Text><AppBackButton href="/schedules" /></View>;
  }

  if (loading || !schedule) {
    return <View style={styles.center}><ActivityIndicator color={colors.primary} /></View>;
  }

  return (
    <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      <Modal visible={songsModal} transparent animationType="fade" onRequestClose={() => setSongsModal(false)}>
        <View style={styles.backdrop}><View style={styles.modalCard}>
          <Text style={styles.modalTitle}>Editar músicas</Text>
          <ScrollView style={styles.modalList}>
            {songs.map((song) => {
              const selected = selectedSongIds.includes(song.id);
              return <TouchableOpacity key={song.id} style={[styles.option, selected && styles.optionSelected]} onPress={() => toggleSong(song.id)}>
                <Text style={styles.optionTitle}>{song.title}</Text>
                <Text style={styles.optionMeta}>{song.artist.name} · Tom {song.originalKey}</Text>
              </TouchableOpacity>;
            })}
          </ScrollView>
          <TouchableOpacity style={styles.primaryButton} onPress={() => setSongsModal(false)}><Text style={styles.primaryText}>Concluir</Text></TouchableOpacity>
        </View></View>
      </Modal>

      <Modal visible={membersModal} transparent animationType="fade" onRequestClose={() => setMembersModal(false)}>
        <View style={styles.backdrop}><View style={styles.modalCard}>
          <Text style={styles.modalTitle}>Editar membros</Text>
          <ScrollView style={styles.modalList}>
            {availableMembers.map((member) => {
              const selected = selectedMembers.some((entry) => entry.userId === member.id);
              return <TouchableOpacity key={member.id} style={[styles.option, selected && styles.optionSelected]} onPress={() => toggleMember(member.id)}>
                <Text style={styles.optionTitle}>{member.name}</Text>
                <Text style={styles.optionMeta}>{selected ? "Selecionado" : "Toque para selecionar"}</Text>
              </TouchableOpacity>;
            })}
          </ScrollView>
          <TouchableOpacity style={styles.primaryButton} onPress={() => setMembersModal(false)}><Text style={styles.primaryText}>Concluir</Text></TouchableOpacity>
        </View></View>
      </Modal>

      <View style={styles.backRow}><AppBackButton href="/schedules" /></View>
      <Text style={styles.title}>Editar Escala</Text>
      <Text style={styles.subtitle}>Atualize os dados, músicas e membros da escala.</Text>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <View style={styles.card}>
        <Text style={styles.label}>Nome da escala *</Text>
        <TextInput style={styles.input} value={title} onChangeText={setTitle} placeholder="Ex: Culto de Domingo" placeholderTextColor={colors.muted} />
        <Text style={styles.label}>Ministério *</Text>
        <View style={styles.chips}>{ministries.map((ministry) => (
          <TouchableOpacity key={ministry.id} style={[styles.chip, ministryId === ministry.id && styles.chipActive]} onPress={() => { setMinistryId(ministry.id); setSelectedMembers([]); }}>
            <Text style={[styles.chipText, ministryId === ministry.id && styles.chipTextActive]}>{ministry.name}</Text>
          </TouchableOpacity>
        ))}</View>
        <View style={styles.rowFields}>
          <View style={styles.field}><Text style={styles.label}>Dia *</Text><TextInput style={styles.input} value={date} onChangeText={(value) => setDate(maskDateInput(value))} placeholder="DD/MM/AAAA" placeholderTextColor={colors.muted} maxLength={10} /></View>
          <View style={styles.field}><Text style={styles.label}>Horário *</Text><TextInput style={styles.input} value={hour} onChangeText={(value) => setHour(maskTimeInput(value))} placeholder="HH:mm" placeholderTextColor={colors.muted} maxLength={5} /></View>
        </View>
        <View style={styles.sectionHeader}><View><Text style={styles.sectionTitle}>Músicas</Text><Text style={styles.helper}>{selectedSongs.length ? selectedSongs.map((song) => song.title).join(", ") : "Nenhuma música adicionada."}</Text></View><TouchableOpacity style={styles.secondaryButton} onPress={() => setSongsModal(true)}><Text style={styles.secondaryText}>Editar músicas</Text></TouchableOpacity></View>
        <View style={styles.sectionHeader}><View><Text style={styles.sectionTitle}>Membros</Text><Text style={styles.helper}>{selectedMemberDetails.length ? `${selectedMemberDetails.length} membro(s) selecionado(s)` : "Nenhum membro adicionado."}</Text></View><TouchableOpacity style={styles.secondaryButton} onPress={() => setMembersModal(true)}><Text style={styles.secondaryText}>Editar membros</Text></TouchableOpacity></View>
        <View style={styles.selectedList}>{selectedMemberDetails.map((entry) => <View key={entry.userId} style={styles.selectedChip}><Text style={styles.selectedChipTitle}>{entry.member?.name}</Text><Text style={styles.selectedChipMeta}>{entry.role}</Text></View>)}</View>
        <TouchableOpacity style={[styles.primaryButton, saving && styles.disabled]} onPress={() => void save()} disabled={saving}><Text style={styles.primaryText}>{saving ? "Salvando..." : "Salvar alterações"}</Text></TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { width: "100%", maxWidth: screen.listMaxWidth, alignSelf: "center", padding: spacing.xl, paddingBottom: 100 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.background, padding: spacing.xl },
  backRow: { marginBottom: spacing.lg },
  title: { color: colors.ink, fontSize: 30, fontWeight: "900" },
  subtitle: { color: colors.muted, fontSize: 15, fontWeight: "600", marginTop: spacing.xs, marginBottom: spacing.lg },
  card: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, borderRadius: radii.lg, padding: spacing.lg, ...shadow },
  label: { color: colors.text, fontSize: 13, fontWeight: "900", marginTop: spacing.lg, marginBottom: spacing.sm },
  input: { minHeight: 48, borderWidth: 1, borderColor: colors.line, borderRadius: radii.sm, backgroundColor: colors.surfaceMuted, color: colors.ink, paddingHorizontal: spacing.md, fontSize: 15 },
  rowFields: { flexDirection: "row", gap: spacing.md },
  field: { flex: 1 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  chip: { minHeight: 38, borderRadius: radii.pill, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surfaceMuted, justifyContent: "center", paddingHorizontal: spacing.md },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { color: colors.text, fontWeight: "800" },
  chipTextActive: { color: colors.surface },
  sectionHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.md, marginTop: spacing.xl },
  sectionTitle: { color: colors.ink, fontSize: 17, fontWeight: "900" },
  helper: { color: colors.muted, fontSize: 13, lineHeight: 19, marginTop: spacing.xs },
  secondaryButton: { minHeight: 40, borderRadius: radii.sm, backgroundColor: colors.primarySoft, justifyContent: "center", alignItems: "center", paddingHorizontal: spacing.md },
  secondaryText: { color: colors.primary, fontSize: 13, fontWeight: "900" },
  primaryButton: { minHeight: 48, marginTop: spacing.xl, borderRadius: radii.sm, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center", paddingHorizontal: spacing.lg },
  primaryText: { color: colors.surface, fontSize: 14, fontWeight: "900" },
  disabled: { opacity: 0.65 },
  error: { color: colors.danger, fontSize: 13, fontWeight: "700", backgroundColor: "#FDECEC", padding: spacing.md, borderRadius: radii.sm, marginBottom: spacing.md },
  selectedList: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, marginTop: spacing.md },
  selectedChip: { borderWidth: 1, borderColor: colors.line, borderRadius: radii.sm, backgroundColor: colors.surfaceMuted, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  selectedChipTitle: { color: colors.ink, fontSize: 13, fontWeight: "900" },
  selectedChipMeta: { color: colors.muted, fontSize: 12, fontWeight: "700", marginTop: 2 },
  backdrop: { flex: 1, backgroundColor: "rgba(15, 23, 42, 0.46)", alignItems: "center", justifyContent: "center", padding: spacing.lg },
  modalCard: { width: "100%", maxWidth: 680, maxHeight: "88%", backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, borderRadius: radii.lg, padding: spacing.lg, ...shadow },
  modalTitle: { color: colors.ink, fontSize: 22, fontWeight: "900" },
  modalList: { maxHeight: 440, marginTop: spacing.md },
  option: { borderWidth: 1, borderColor: colors.line, borderRadius: radii.md, backgroundColor: colors.surfaceMuted, padding: spacing.md, marginBottom: spacing.sm },
  optionSelected: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  optionTitle: { color: colors.ink, fontSize: 15, fontWeight: "900" },
  optionMeta: { color: colors.muted, fontSize: 12, fontWeight: "700", marginTop: spacing.xs },
});
