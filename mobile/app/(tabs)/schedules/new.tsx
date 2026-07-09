import React, { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Alert, Modal, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { useRouter } from "expo-router";
import { ArrowLeft } from "lucide-react-native";
import { ArtistPicker } from "../../../src/components/ArtistPicker";
import { AppBackButton } from "../../../src/components/AppBackButton";
import { DateTimeInput } from "../../../src/components/DateTimeInput";
import { memberService } from "../../../src/services/memberService";
import { ministryApi } from "../../../src/services/ministryApi";
import { musicService } from "../../../src/services/musicService";
import { useAuthStore } from "../../../src/store/authStore";
import { useScheduleStore } from "../../../src/store/scheduleStore";
import { Artist, Member, Ministry, MinistryMember, MUSICAL_KEYS, MusicalKey, Song } from "../../../src/types";
import { buttonShadow, colors, radii, screen, shadow, spacing } from "../../../src/theme";
import { combineDisplayDateTimeToIso, maskDateInput, maskTimeInput, toDisplayDate } from "../../../src/utils/dateTimeInput";

function canManageSchedules(role?: string | null) {
  return role === "GLOBAL_ADMIN" || role === "TENANT_ADMIN" || role === "MINISTRY_LEADER";
}

export default function NewScheduleScreen() {
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const { createSchedule, saving, error } = useScheduleStore();
  const [title, setTitle] = useState("");
  const [date, setDate] = useState(() => toDisplayDate(new Date()));
  const [hour, setHour] = useState("19:00");
  const [ministries, setMinistries] = useState<Ministry[]>([]);
  const [ministryId, setMinistryId] = useState("");
  const [members, setMembers] = useState<Member[]>([]);
  const [ministryMembers, setMinistryMembers] = useState<MinistryMember[]>([]);
  const [songs, setSongs] = useState<Song[]>([]);
  const [selectedMembers, setSelectedMembers] = useState<Array<{ userId: string; role: string }>>([]);
  const [selectedSongIds, setSelectedSongIds] = useState<string[]>([]);
  const [membersModal, setMembersModal] = useState(false);
  const [songsModal, setSongsModal] = useState(false);
  const [calendarModal, setCalendarModal] = useState(false);
  const [calendarMonth, setCalendarMonth] = useState(() => new Date());
  const [quickSongModal, setQuickSongModal] = useState(false);
  const [quickSongArtist, setQuickSongArtist] = useState<Artist | null>(null);
  const [quickSongTitle, setQuickSongTitle] = useState("");
  const [quickSongKey, setQuickSongKey] = useState<MusicalKey>("C");
  const [quickSongContent, setQuickSongContent] = useState("");
  const [quickSongSaving, setQuickSongSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!canManageSchedules(user?.role)) return;
    let mounted = true;
    Promise.all([
      ministryApi.getMinistries(),
      memberService.listMembers(),
      musicService.listSongs("", 1, 100),
    ]).then(([ministryResult, memberResult, songResult]) => {
      if (!mounted) return;
      setMinistries(ministryResult);
      setMinistryId(ministryResult[0]?.id ?? "");
      setMembers(memberResult);
      setSongs(songResult.items);
    }).catch((reason) => {
      Alert.alert("Erro", reason instanceof Error ? reason.message : "Não foi possível carregar dados para criar escala.");
    }).finally(() => {
      if (mounted) setLoading(false);
    });
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
  const selectedSongs = useMemo(() => selectedSongIds.map((id) => songs.find((song) => song.id === id)).filter(Boolean) as Song[], [songs, selectedSongIds]);

  const calendarDays = useMemo(() => {
    const year = calendarMonth.getFullYear();
    const month = calendarMonth.getMonth();
    const first = new Date(year, month, 1);
    const offset = first.getDay();
    const count = new Date(year, month + 1, 0).getDate();
    return [
      ...Array.from({ length: offset }, () => null),
      ...Array.from({ length: count }, (_, index) => new Date(year, month, index + 1)),
    ];
  }, [calendarMonth]);

  if (!canManageSchedules(user?.role)) {
    return <View style={styles.center}><Text style={styles.error}>Você não tem permissão para criar escalas.</Text><AppBackButton href="/schedules" /></View>;
  }

  const toggleSong = (songId: string) => {
    setSelectedSongIds((current) => current.includes(songId) ? current.filter((id) => id !== songId) : [...current, songId]);
  };

  const toggleMember = (memberId: string) => {
    setSelectedMembers((current) => current.some((entry) => entry.userId === memberId)
      ? current.filter((entry) => entry.userId !== memberId)
      : [...current, { userId: memberId, role: "Membro" }]);
  };

  const createQuickSong = async () => {
    if (!quickSongArtist) return Alert.alert("Dados incompletos", "Selecione ou crie um artista.");
    if (!quickSongTitle.trim()) return Alert.alert("Dados incompletos", "Informe o nome da música.");
    if (!quickSongContent.trim()) return Alert.alert("Dados incompletos", "Informe a cifra da música.");
    try {
      setQuickSongSaving(true);
      const created = await musicService.createSong({
        title: quickSongTitle.trim(),
        artistId: quickSongArtist.id,
        composer: null,
        originalKey: quickSongKey,
        content: quickSongContent,
        bpm: null,
      });
      setSongs((current) => [created, ...current.filter((song) => song.id !== created.id)]);
      setSelectedSongIds((current) => current.includes(created.id) ? current : [...current, created.id]);
      setQuickSongArtist(null);
      setQuickSongTitle("");
      setQuickSongKey("C");
      setQuickSongContent("");
      setQuickSongModal(false);
    } catch (reason) {
      Alert.alert("Erro", reason instanceof Error ? reason.message : "Não foi possível criar a música.");
    } finally {
      setQuickSongSaving(false);
    }
  };

  const save = async () => {
    if (!title.trim()) return Alert.alert("Dados incompletos", "Informe o nome da escala.");
    if (!ministryId) return Alert.alert("Dados incompletos", "Selecione o ministério da escala.");
    const isoDate = combineDisplayDateTimeToIso(date, hour);
    if (!isoDate) return Alert.alert("Data ou horário inválido", "Informe data no formato DD/MM/AAAA e horário no formato HH:mm.");
    try {
      await createSchedule({
        title: title.trim(),
        date: isoDate,
        ministryId,
        songIds: selectedSongIds,
        assignments: selectedMembers.map((entry) => ({ userId: entry.userId, role: entry.role })),
      });
      router.replace("/schedules" as never);
    } catch (reason) {
      Alert.alert("Erro", reason instanceof Error ? reason.message : "Não foi possível criar a escala.");
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      <Modal visible={calendarModal} transparent animationType="fade" onRequestClose={() => setCalendarModal(false)}>
        <View style={styles.backdrop}><View style={styles.modalCard}>
          <View style={styles.modalHeaderRow}>
            <TouchableOpacity style={styles.secondaryButton} onPress={() => setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() - 1, 1))}><Text style={styles.secondaryText}>‹</Text></TouchableOpacity>
            <Text style={styles.modalTitle}>{calendarMonth.toLocaleDateString("pt-BR", { month: "long", year: "numeric" })}</Text>
            <TouchableOpacity style={styles.secondaryButton} onPress={() => setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 1))}><Text style={styles.secondaryText}>›</Text></TouchableOpacity>
          </View>
          <View style={styles.weekRow}>{["D", "S", "T", "Q", "Q", "S", "S"].map((day, index) => <Text key={`${day}-${index}`} style={styles.weekday}>{day}</Text>)}</View>
          <View style={styles.calendarGrid}>
            {calendarDays.map((day, index) => day ? (
              <TouchableOpacity key={day.toISOString()} style={styles.calendarDay} onPress={() => { setDate(toDisplayDate(day)); setCalendarModal(false); }}>
                <Text style={styles.calendarDayText}>{day.getDate()}</Text>
              </TouchableOpacity>
            ) : <View key={`empty-${index}`} style={styles.calendarDay} />)}
          </View>
        </View></View>
      </Modal>

      <Modal visible={songsModal} transparent animationType="fade" onRequestClose={() => setSongsModal(false)}>
        <View style={styles.backdrop}><View style={styles.modalCard}>
          <View style={styles.modalHeaderRow}>
            <TouchableOpacity style={styles.modalBackButton} onPress={() => setSongsModal(false)} accessibilityRole="button" accessibilityLabel="Voltar">
              <ArrowLeft color={colors.primary} size={20} strokeWidth={2.4} />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Adicionar músicas</Text>
            <View style={styles.modalHeaderSpacer} />
          </View>
          <Text style={styles.helper}>Clique nas músicas para adicionar ou remover da escala.</Text>
          <TouchableOpacity style={styles.secondaryButton} onPress={() => { setSongsModal(false); setQuickSongModal(true); }}><Text style={styles.secondaryText}>+ Adicionar Música</Text></TouchableOpacity>
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

      <Modal visible={quickSongModal} transparent animationType="fade" onRequestClose={() => setQuickSongModal(false)}>
        <View style={styles.backdrop}><View style={styles.modalCard}>
          <View style={styles.modalHeaderRow}>
            <TouchableOpacity style={styles.modalBackButton} onPress={() => { setQuickSongModal(false); setSongsModal(true); }} accessibilityRole="button" accessibilityLabel="Voltar">
              <ArrowLeft color={colors.primary} size={20} strokeWidth={2.4} />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Adicionar música</Text>
            <View style={styles.modalHeaderSpacer} />
          </View>
          <Text style={styles.helper}>A música será criada e adicionada à escala sem apagar os dados já preenchidos.</Text>
          <ArtistPicker selected={quickSongArtist} onSelect={setQuickSongArtist} />
          <Text style={styles.label}>Nome da música *</Text>
          <TextInput style={styles.input} value={quickSongTitle} onChangeText={setQuickSongTitle} placeholder="Ex: Grande é o Senhor" placeholderTextColor={colors.muted} />
          <Text style={styles.label}>Tom original *</Text>
          <View style={styles.keyGrid}>{MUSICAL_KEYS.map((key) => (
            <TouchableOpacity key={key} style={[styles.keyChip, quickSongKey === key && styles.keyChipActive]} onPress={() => setQuickSongKey(key)}>
              <Text style={[styles.keyChipText, quickSongKey === key && styles.keyChipTextActive]}>{key}</Text>
            </TouchableOpacity>
          ))}</View>
          <Text style={styles.label}>Cifra *</Text>
          <TextInput style={[styles.input, styles.quickSongContent]} value={quickSongContent} onChangeText={setQuickSongContent} multiline textAlignVertical="top" placeholder="[G]Letra da música" placeholderTextColor={colors.muted} />
          <View style={styles.modalActions}>
            <TouchableOpacity style={styles.modalActionSecondary} onPress={() => { setQuickSongModal(false); setSongsModal(true); }} disabled={quickSongSaving}><Text style={styles.secondaryText}>Cancelar</Text></TouchableOpacity>
            <TouchableOpacity style={[styles.modalActionPrimary, quickSongSaving && styles.disabled]} onPress={() => void createQuickSong()} disabled={quickSongSaving}><Text style={styles.primaryText}>{quickSongSaving ? "Salvando..." : "Criar e adicionar"}</Text></TouchableOpacity>
          </View>
        </View></View>
      </Modal>

      <Modal visible={membersModal} transparent animationType="fade" onRequestClose={() => setMembersModal(false)}>
        <View style={styles.backdrop}><View style={styles.modalCard}>
          <View style={styles.modalHeaderRow}>
            <TouchableOpacity style={styles.modalBackButton} onPress={() => setMembersModal(false)} accessibilityRole="button" accessibilityLabel="Voltar">
              <ArrowLeft color={colors.primary} size={20} strokeWidth={2.4} />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Adicionar membros</Text>
            <View style={styles.modalHeaderSpacer} />
          </View>
          <Text style={styles.helper}>{user?.role === "MINISTRY_LEADER" ? "Líderes veem apenas membros do ministério selecionado." : "Administradores podem escolher qualquer membro da igreja."}</Text>
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
      <Text style={styles.title}>Nova Escala</Text>
      <Text style={styles.subtitle}>Monte a escala com ministério, músicas e membros.</Text>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {loading ? <ActivityIndicator color={colors.primary} style={styles.loader} /> : (
        <View style={styles.card}>
          <Text style={styles.label}>Nome da escala *</Text>
          <TextInput style={styles.input} value={title} onChangeText={setTitle} placeholder="Ex: Culto de Domingo" placeholderTextColor={colors.muted} />

          <Text style={styles.label}>Ministério *</Text>
          <View style={styles.chips}>
            {ministries.map((ministry) => <TouchableOpacity key={ministry.id} style={[styles.chip, ministryId === ministry.id && styles.chipActive]} onPress={() => { setMinistryId(ministry.id); setSelectedMembers([]); }}>
              <Text style={[styles.chipText, ministryId === ministry.id && styles.chipTextActive]}>{ministry.name}</Text>
            </TouchableOpacity>)}
          </View>

          <View style={styles.rowFields}>
            <View style={styles.field}>
              <DateTimeInput
                type="date"
                label="Dia *"
                value={date}
                onChange={(value) => setDate(maskDateInput(value))}
                maxLength={10}
              />
              <View style={styles.inputActionRow}>
                <TouchableOpacity style={styles.secondaryButton} onPress={() => setCalendarModal(true)}><Text style={styles.secondaryText}>Calendário</Text></TouchableOpacity>
              </View>
            </View>
            <View style={styles.field}>
              <DateTimeInput
                type="time"
                label="Horário *"
                value={hour}
                onChange={(value) => setHour(maskTimeInput(value))}
                maxLength={5}
              />
            </View>
          </View>

          <View style={styles.sectionHeader}>
            <View><Text style={styles.sectionTitle}>Músicas</Text><Text style={styles.helper}>{selectedSongs.length ? selectedSongs.map((song) => song.title).join(", ") : "Nenhuma música adicionada."}</Text></View>
            <TouchableOpacity style={styles.secondaryButton} onPress={() => setSongsModal(true)}><Text style={styles.secondaryText}>Adicionar músicas</Text></TouchableOpacity>
          </View>

          <View style={styles.sectionHeader}>
            <View><Text style={styles.sectionTitle}>Membros</Text><Text style={styles.helper}>{selectedMemberDetails.length ? `${selectedMemberDetails.length} membro(s) selecionado(s)` : "Nenhum membro adicionado."}</Text></View>
            <TouchableOpacity style={styles.secondaryButton} onPress={() => setMembersModal(true)}><Text style={styles.secondaryText}>Adicionar membros</Text></TouchableOpacity>
          </View>

          <View style={styles.selectedList}>
            {selectedMemberDetails.map((entry) => <View key={entry.userId} style={styles.selectedChip}>
              <Text style={styles.selectedChipTitle}>{entry.member?.name}</Text>
              <Text style={styles.selectedChipMeta}>{entry.role}</Text>
            </View>)}
          </View>

          <TouchableOpacity style={[styles.primaryButton, saving && styles.disabled]} onPress={() => void save()} disabled={saving}>
            <Text style={styles.primaryText}>{saving ? "Salvando..." : "Criar escala"}</Text>
          </TouchableOpacity>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { width: "100%", maxWidth: screen.listMaxWidth, alignSelf: "center", padding: spacing.xl, paddingBottom: 120 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.background, padding: spacing.xl },
  backRow: { marginBottom: spacing.lg },
  title: { color: colors.ink, fontSize: 30, fontWeight: "900" },
  subtitle: { color: colors.muted, fontSize: 15, fontWeight: "600", marginTop: spacing.xs, marginBottom: spacing.lg },
  card: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, borderRadius: radii.xl, padding: spacing.xl, ...shadow },
  label: { color: colors.text, fontSize: 13, fontWeight: "900", marginTop: spacing.lg, marginBottom: spacing.sm },
  input: { minHeight: 52, borderWidth: 1, borderColor: colors.line, borderRadius: radii.md, backgroundColor: colors.surfaceMuted, color: colors.ink, paddingHorizontal: spacing.md, fontSize: 15 },
  rowFields: { flexDirection: "row", gap: spacing.md },
  field: { flex: 1 },
  inputActionRow: { flexDirection: "row", gap: spacing.sm, alignItems: "center" },
  actionInput: { flex: 1 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  chip: { minHeight: 38, borderRadius: radii.pill, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surfaceMuted, justifyContent: "center", paddingHorizontal: spacing.md },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { color: colors.text, fontWeight: "800" },
  chipTextActive: { color: colors.surface },
  sectionHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.md, marginTop: spacing.xl },
  sectionTitle: { color: colors.ink, fontSize: 17, fontWeight: "900" },
  helper: { color: colors.muted, fontSize: 13, lineHeight: 19, marginTop: spacing.xs },
  secondaryButton: { minHeight: 44, borderRadius: radii.md, backgroundColor: colors.primarySoft, borderWidth: 1, borderColor: "#BFE7DE", justifyContent: "center", alignItems: "center", paddingHorizontal: spacing.md },
  secondaryText: { color: colors.primary, fontSize: 13, fontWeight: "900" },
  primaryButton: { minHeight: 52, marginTop: spacing.xl, borderRadius: radii.md, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center", paddingHorizontal: spacing.lg, ...buttonShadow },
  primaryText: { color: colors.surface, fontSize: 14, fontWeight: "900" },
  disabled: { opacity: 0.65 },
  error: { color: colors.danger, fontSize: 13, fontWeight: "800", backgroundColor: colors.dangerSoft, padding: spacing.md, borderRadius: radii.md, marginBottom: spacing.md },
  loader: { marginVertical: spacing.xl },
  selectedList: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, marginTop: spacing.md },
  selectedChip: { borderWidth: 1, borderColor: colors.line, borderRadius: radii.md, backgroundColor: colors.surfaceMuted, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  selectedChipTitle: { color: colors.ink, fontSize: 13, fontWeight: "900" },
  selectedChipMeta: { color: colors.muted, fontSize: 12, fontWeight: "700", marginTop: 2 },
  backdrop: { flex: 1, backgroundColor: "rgba(15, 23, 42, 0.46)", alignItems: "center", justifyContent: "center", padding: spacing.lg },
  modalCard: { width: "100%", maxWidth: 680, maxHeight: "88%", backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, borderRadius: radii.xl, padding: spacing.lg, ...shadow },
  modalHeaderRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.md, marginBottom: spacing.md },
  modalBackButton: { width: 40, height: 40, borderRadius: radii.pill, backgroundColor: colors.primarySoft, alignItems: "center", justifyContent: "center" },
  modalHeaderSpacer: { width: 40, height: 40 },
  modalTitle: { flex: 1, color: colors.ink, fontSize: 22, fontWeight: "900", textAlign: "center" },
  modalList: { maxHeight: 440, marginTop: spacing.md },
  option: { borderWidth: 1, borderColor: colors.line, borderRadius: radii.md, backgroundColor: colors.surfaceMuted, padding: spacing.md, marginBottom: spacing.sm },
  optionSelected: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  optionTitle: { color: colors.ink, fontSize: 15, fontWeight: "900" },
  optionMeta: { color: colors.muted, fontSize: 12, fontWeight: "700", marginTop: spacing.xs },
  weekRow: { flexDirection: "row", marginTop: spacing.md },
  weekday: { flex: 1, textAlign: "center", color: colors.muted, fontSize: 12, fontWeight: "900" },
  calendarGrid: { flexDirection: "row", flexWrap: "wrap", marginTop: spacing.sm },
  calendarDay: { width: `${100 / 7}%`, minHeight: 44, alignItems: "center", justifyContent: "center" },
  calendarDayText: { color: colors.ink, fontSize: 14, fontWeight: "800" },
  modalActions: { flexDirection: "row", justifyContent: "flex-end", gap: spacing.sm, marginTop: spacing.lg, flexWrap: "wrap" },
  modalActionSecondary: { flex: 1, minHeight: 48, maxWidth: 220, borderRadius: radii.md, backgroundColor: colors.primarySoft, alignItems: "center", justifyContent: "center", paddingHorizontal: spacing.lg },
  modalActionPrimary: { flex: 1, minHeight: 48, maxWidth: 220, borderRadius: radii.md, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center", paddingHorizontal: spacing.lg },
  keyGrid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  keyChip: { minWidth: 45, height: 36, borderWidth: 1, borderColor: colors.line, borderRadius: radii.md, backgroundColor: colors.surfaceMuted, alignItems: "center", justifyContent: "center" },
  keyChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  keyChipText: { color: colors.text, fontSize: 13, fontWeight: "800" },
  keyChipTextActive: { color: colors.surface },
  quickSongContent: { minHeight: 160, paddingTop: spacing.md },
});




