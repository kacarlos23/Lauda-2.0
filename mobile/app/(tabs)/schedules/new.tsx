import React, { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Alert, Modal, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, useWindowDimensions, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ArrowLeft, Search } from "lucide-react-native";
import { ArtistPicker } from "../../../src/components/ArtistPicker";
import { AppBackButton } from "../../../src/components/AppBackButton";
import { DateTimeInput } from "../../../src/components/DateTimeInput";
import { ErrorBanner } from "../../../src/components/ui/ErrorBanner";
import { LoadingState } from "../../../src/components/ui/LoadingState";
import { RichCommentEditor } from "../../../src/components/ui/RichCommentEditor";
import { memberService } from "../../../src/services/memberService";
import { ministryApi } from "../../../src/services/ministryApi";
import { musicService } from "../../../src/services/musicService";
import { useAuthStore } from "../../../src/store/authStore";
import { useScheduleStore } from "../../../src/store/scheduleStore";
import { Artist, Member, Ministry, MinistryMember, MUSICAL_KEYS, MusicalKey, Song } from "../../../src/types";
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
import { combineDisplayDateTimeToIso, toDisplayDate } from "../../../src/utils/dateTimeInput";
import { canCreateSchedule } from "../../../src/utils/schedulePermissions";
import { nav } from "../../../src/navigation/routes";

function dateFromRouteParam(value?: string | string[]) {
  const candidate = Array.isArray(value) ? value[0] : value;
  if (!candidate || !/^\d{4}-\d{2}-\d{2}$/.test(candidate)) return new Date();
  const [year, month, day] = candidate.split("-").map(Number);
  const parsed = new Date(year, month - 1, day);
  if (parsed.getFullYear() !== year || parsed.getMonth() !== month - 1 || parsed.getDate() !== day) return new Date();
  return parsed;
}

export default function NewScheduleScreen() {
  const { width } = useWindowDimensions();
  const compactLayout = width < breakpoints.formCompact;
  const router = useRouter();
  const params = useLocalSearchParams<{ date?: string | string[] }>();
  const user = useAuthStore((state) => state.user);
  const { createSchedule, saving, error } = useScheduleStore();
  const canCreateSchedules = canCreateSchedule(user);
  const [title, setTitle] = useState("");
  const [date, setDate] = useState(() => toDisplayDate(dateFromRouteParam(params.date)));
  const [hour, setHour] = useState("19:00");
  const [comments, setComments] = useState("");
  const [ministries, setMinistries] = useState<Ministry[]>([]);
  const [ministryId, setMinistryId] = useState("");
  const [members, setMembers] = useState<Member[]>([]);
  const [ministryMembers, setMinistryMembers] = useState<MinistryMember[]>([]);
  const [songs, setSongs] = useState<Song[]>([]);
  const [visibleSongs, setVisibleSongs] = useState<Song[]>([]);
  const [songSearch, setSongSearch] = useState("");
  const [songSearchLoading, setSongSearchLoading] = useState(false);
  const [songSearchError, setSongSearchError] = useState<string | null>(null);
  const [selectedMembers, setSelectedMembers] = useState<Array<{ userId: string; role: string }>>([]);
  const [selectedSongIds, setSelectedSongIds] = useState<string[]>([]);
  const [membersModal, setMembersModal] = useState(false);
  const [songsModal, setSongsModal] = useState(false);
  const [quickSongModal, setQuickSongModal] = useState(false);
  const [quickSongArtist, setQuickSongArtist] = useState<Artist | null>(null);
  const [quickSongTitle, setQuickSongTitle] = useState("");
  const [quickSongKey, setQuickSongKey] = useState<MusicalKey>("C");
  const [quickSongContent, setQuickSongContent] = useState("");
  const [quickSongSaving, setQuickSongSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!canCreateSchedules) return;
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
      setVisibleSongs(songResult.items);
    }).catch((reason) => {
      Alert.alert("Erro", reason instanceof Error ? reason.message : "Não foi possível carregar dados para criar escala.");
    }).finally(() => {
      if (mounted) setLoading(false);
    });
    return () => { mounted = false; };
  }, [canCreateSchedules]);

  useEffect(() => {
    if (!songsModal) return;
    let cancelled = false;
    const timer = setTimeout(async () => {
      setSongSearchLoading(true);
      setSongSearchError(null);
      try {
        const result = await musicService.listSongs(songSearch.trim(), 1, 100);
        if (cancelled) return;
        setVisibleSongs(result.items);
        setSongs((current) => {
          const merged = new Map(current.map((song) => [song.id, song]));
          result.items.forEach((song) => merged.set(song.id, song));
          return [...merged.values()];
        });
      } catch (reason) {
        if (!cancelled) setSongSearchError(reason instanceof Error ? reason.message : "Não foi possível buscar músicas.");
      } finally {
        if (!cancelled) setSongSearchLoading(false);
      }
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [songSearch, songsModal]);

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

  if (!canCreateSchedules) {
    return <View style={styles.center}><Text style={styles.error}>Você não tem permissão para criar escalas.</Text><AppBackButton href={nav.schedules} /></View>;
  }

  const toggleSong = (songId: string) => {
    setSelectedSongIds((current) => current.includes(songId) ? current.filter((id) => id !== songId) : [...current, songId]);
  };

  const closeSongsModal = () => {
    setSongsModal(false);
    setSongSearch("");
    setSongSearchError(null);
    setVisibleSongs(songs);
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
      setVisibleSongs((current) => [created, ...current.filter((song) => song.id !== created.id)]);
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
        comments: comments || null,
        ministryId,
        songIds: selectedSongIds,
        assignments: selectedMembers.map((entry) => ({ userId: entry.userId, role: entry.role })),
      });
      router.replace(nav.schedules);
    } catch (reason) {
      Alert.alert("Erro", reason instanceof Error ? reason.message : "Não foi possível criar a escala.");
    }
  };

  return (
    <ScrollView contentContainerStyle={[styles.container, compactLayout && styles.containerCompact]} keyboardShouldPersistTaps="handled">
      <Modal visible={songsModal} transparent animationType="fade" onRequestClose={closeSongsModal}>
        <View style={styles.backdrop}><View style={styles.modalCard}>
          <View style={styles.modalHeaderRow}>
            <TouchableOpacity style={styles.modalBackButton} onPress={closeSongsModal} accessibilityRole="button" accessibilityLabel="Voltar">
              <ArrowLeft color={colors.primary} size={iconSizes.s20} strokeWidth={2.4} />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Adicionar músicas</Text>
            <View style={styles.modalHeaderSpacer} />
          </View>
          <Text style={styles.helper}>Clique nas músicas para adicionar ou remover da escala.</Text>
          <TouchableOpacity style={styles.secondaryButton} onPress={() => { closeSongsModal(); setQuickSongModal(true); }}><Text style={styles.secondaryText}>+ Adicionar Música</Text></TouchableOpacity>
          <View style={styles.songSearchRow}>
            <Search color={colors.muted} size={iconSizes.s19} />
            <TextInput
              style={styles.songSearchInput}
              value={songSearch}
              onChangeText={setSongSearch}
              placeholder="Buscar por música ou artista"
              placeholderTextColor={colors.muted}
              accessibilityLabel="Buscar músicas da escala"
              testID="schedule-song-search-input"
              returnKeyType="search"
            />
            {songSearchLoading ? <ActivityIndicator color={colors.primary} size="small" /> : null}
          </View>
          {songSearchError ? <Text style={styles.songSearchError}>{songSearchError}</Text> : null}
          <ScrollView style={styles.modalList}>
            {visibleSongs.map((song) => {
              const selected = selectedSongIds.includes(song.id);
              return <TouchableOpacity key={song.id} style={[styles.option, selected && styles.optionSelected]} onPress={() => toggleSong(song.id)}>
                <Text style={styles.optionTitle}>{song.title}</Text>
                <Text style={styles.optionMeta}>{song.artist.name} · Tom {song.originalKey}</Text>
              </TouchableOpacity>;
            })}
            {!songSearchLoading && !visibleSongs.length ? <Text style={styles.emptyText}>Nenhuma música encontrada.</Text> : null}
          </ScrollView>
          <TouchableOpacity style={styles.primaryButton} onPress={closeSongsModal}><Text style={styles.primaryText}>Concluir</Text></TouchableOpacity>
        </View></View>
      </Modal>

      <Modal visible={quickSongModal} transparent animationType="fade" onRequestClose={() => setQuickSongModal(false)}>
        <View style={styles.backdrop}><View style={styles.modalCard}>
          <View style={styles.modalHeaderRow}>
            <TouchableOpacity style={styles.modalBackButton} onPress={() => { setQuickSongModal(false); setSongsModal(true); }} accessibilityRole="button" accessibilityLabel="Voltar">
              <ArrowLeft color={colors.primary} size={iconSizes.s20} strokeWidth={2.4} />
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
              <ArrowLeft color={colors.primary} size={iconSizes.s20} strokeWidth={2.4} />
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

      <View style={styles.backRow}><AppBackButton href={nav.schedules} /></View>
      <Text style={styles.title}>Nova Escala</Text>
      <Text style={styles.subtitle}>Monte a escala com ministério, músicas e membros.</Text>
      <ErrorBanner message={error} style={styles.error} />
      {loading ? <LoadingState centered={false} message="Carregando dados da escala..." style={styles.loader} /> : (
        <View style={[styles.card, compactLayout && styles.cardCompact]}>
          <Text style={styles.label}>Nome da escala *</Text>
          <TextInput style={styles.input} value={title} onChangeText={setTitle} placeholder="Ex: Culto de Domingo" placeholderTextColor={colors.muted} />

          <Text style={styles.label}>Ministério *</Text>
          <View style={styles.chips}>
            {ministries.map((ministry) => <TouchableOpacity key={ministry.id} style={[styles.chip, ministryId === ministry.id && styles.chipActive]} onPress={() => { setMinistryId(ministry.id); setSelectedMembers([]); }}>
              <Text style={[styles.chipText, ministryId === ministry.id && styles.chipTextActive]}>{ministry.name}</Text>
            </TouchableOpacity>)}
          </View>

          <View style={[styles.rowFields, compactLayout && styles.rowFieldsCompact]}>
            <View style={compactLayout ? styles.fieldCompact : styles.field}>
              <DateTimeInput
                type="date"
                label="Dia *"
                value={date}
                onChange={setDate}
                testID="schedule-date"
              />
            </View>
            <View style={compactLayout ? styles.fieldCompact : styles.field}>
              <DateTimeInput
                type="time"
                label="Horário *"
                value={hour}
                onChange={setHour}
                testID="schedule-time"
              />
            </View>
          </View>

          <View style={styles.commentsEditor}><RichCommentEditor value={comments} onChange={setComments} label="Comentários" placeholder="Orientações, avisos ou observações para esta escala..." testID="schedule-comments-input" /></View>

          <View style={[styles.sectionHeader, compactLayout && styles.sectionHeaderCompact]}>
            <View style={styles.sectionText}><Text style={styles.sectionTitle}>Músicas</Text><Text style={styles.helper}>{selectedSongs.length ? selectedSongs.map((song) => song.title).join(", ") : "Nenhuma música adicionada."}</Text></View>
            <TouchableOpacity style={styles.secondaryButton} onPress={() => setSongsModal(true)}><Text style={styles.secondaryText}>Adicionar músicas</Text></TouchableOpacity>
          </View>

          <View style={[styles.sectionHeader, compactLayout && styles.sectionHeaderCompact]}>
            <View style={styles.sectionText}><Text style={styles.sectionTitle}>Membros</Text><Text style={styles.helper}>{selectedMemberDetails.length ? `${selectedMemberDetails.length} membro(s) selecionado(s)` : "Nenhum membro adicionado."}</Text></View>
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
  container: { width: "100%", maxWidth: screen.listMaxWidth, alignSelf: "center", padding: spacing.xl, paddingBottom: screen.contentBottomPadding },
  containerCompact: { padding: spacing.md, paddingBottom: screen.contentBottomPadding },
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.background, padding: spacing.xl },
  backRow: { marginBottom: spacing.lg },
  title: { color: colors.ink, fontSize: fontSizes.s30, fontWeight: fontWeights.black },
  subtitle: { color: colors.muted, fontSize: fontSizes.s15, fontWeight: fontWeights.semibold, marginTop: spacing.xs, marginBottom: spacing.lg },
  card: { backgroundColor: "transparent", borderTopWidth: 1, borderBottomWidth: 1, borderColor: colors.line, paddingVertical: spacing.lg },
  cardCompact: { paddingVertical: spacing.md },
  commentsEditor: { marginTop: spacing.md, marginBottom: spacing.md },
  label: { color: colors.text, fontSize: fontSizes.s13, fontWeight: fontWeights.black, marginTop: spacing.md, marginBottom: spacing.sm },
  input: { minHeight: controlSizes.default, borderWidth: 1, borderColor: colors.line, borderRadius: radii.md, backgroundColor: colors.surface, color: colors.ink, paddingHorizontal: spacing.md, fontSize: fontSizes.s15 },
  rowFields: { flexDirection: "row", gap: spacing.md },
  rowFieldsCompact: { flexDirection: "column" },
  field: { flex: 1 },
  fieldCompact: { width: "100%" },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  chip: { minHeight: 38, borderRadius: radii.pill, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surfaceMuted, justifyContent: "center", paddingHorizontal: spacing.md },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { color: colors.text, fontWeight: fontWeights.extrabold },
  chipTextActive: { color: colors.surface },
  sectionHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.md, marginTop: spacing.xl, paddingTop: spacing.lg, borderTopWidth: 1, borderTopColor: colors.line },
  sectionHeaderCompact: { flexDirection: "column", alignItems: "stretch" },
  sectionText: { flex: 1 },
  sectionTitle: { color: colors.ink, fontSize: fontSizes.s17, fontWeight: fontWeights.black },
  helper: { color: colors.muted, fontSize: fontSizes.s13, lineHeight: lineHeights.h19, marginTop: spacing.xs },
  secondaryButton: { minHeight: controlSizes.default, borderRadius: radii.md, backgroundColor: colors.primarySoft, borderWidth: 1, borderColor: colors.primarySoftBorder, justifyContent: "center", alignItems: "center", paddingHorizontal: spacing.md },
  secondaryText: { color: colors.primary, fontSize: fontSizes.s13, fontWeight: fontWeights.black },
  primaryButton: { minHeight: controlSizes.default, marginTop: spacing.xl, borderRadius: radii.md, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center", paddingHorizontal: spacing.lg },
  primaryText: { color: colors.surface, fontSize: fontSizes.s14, fontWeight: fontWeights.black },
  disabled: { opacity: 0.65 },
  error: { color: colors.danger, fontSize: fontSizes.s13, fontWeight: fontWeights.extrabold, backgroundColor: colors.dangerSoft, padding: spacing.md, borderRadius: radii.md, marginBottom: spacing.md },
  loader: { marginVertical: spacing.xl },
  selectedList: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, marginTop: spacing.md },
  selectedChip: { borderWidth: 1, borderColor: colors.line, borderRadius: radii.md, backgroundColor: colors.surfaceMuted, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  selectedChipTitle: { color: colors.ink, fontSize: fontSizes.s13, fontWeight: fontWeights.black },
  selectedChipMeta: { color: colors.muted, fontSize: fontSizes.s12, fontWeight: fontWeights.bold, marginTop: spacing.xxs },
  backdrop: { flex: 1, backgroundColor: overlays.modalCool, alignItems: "center", justifyContent: "center", padding: spacing.lg },
  modalCard: { width: "100%", maxWidth: 680, maxHeight: "88%", backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, borderRadius: radii.xl, padding: spacing.lg, ...shadow },
  modalHeaderRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.md, marginBottom: spacing.md },
  modalBackButton: { width: controlSizes.medium, height: controlSizes.medium, borderRadius: radii.pill, backgroundColor: colors.primarySoft, alignItems: "center", justifyContent: "center" },
  modalHeaderSpacer: { width: controlSizes.medium, height: controlSizes.medium },
  modalTitle: { flex: 1, color: colors.ink, fontSize: fontSizes.s22, fontWeight: fontWeights.black, textAlign: "center" },
  songSearchRow: { minHeight: controlSizes.large, flexDirection: "row", alignItems: "center", gap: spacing.sm, marginTop: spacing.md, borderWidth: 1, borderColor: colors.line, borderRadius: radii.md, backgroundColor: colors.surfaceMuted, paddingHorizontal: spacing.md },
  songSearchInput: { flex: 1, minHeight: 46, color: colors.ink, fontSize: fontSizes.s15, outlineStyle: "none" } as any,
  songSearchError: { color: colors.danger, fontSize: fontSizes.s12, fontWeight: fontWeights.bold, marginTop: spacing.xs },
  emptyText: { color: colors.muted, fontSize: fontSizes.s13, textAlign: "center", paddingVertical: spacing.lg },
  modalList: { maxHeight: 440, marginTop: spacing.md },
  option: { borderWidth: 1, borderColor: colors.line, borderRadius: radii.md, backgroundColor: colors.surfaceMuted, padding: spacing.md, marginBottom: spacing.sm },
  optionSelected: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  optionTitle: { color: colors.ink, fontSize: fontSizes.s15, fontWeight: fontWeights.black },
  optionMeta: { color: colors.muted, fontSize: fontSizes.s12, fontWeight: fontWeights.bold, marginTop: spacing.xs },
  modalActions: { flexDirection: "row", justifyContent: "flex-end", gap: spacing.sm, marginTop: spacing.lg, flexWrap: "wrap" },
  modalActionSecondary: { flex: 1, minHeight: controlSizes.large, maxWidth: 220, borderRadius: radii.md, backgroundColor: colors.primarySoft, alignItems: "center", justifyContent: "center", paddingHorizontal: spacing.lg },
  modalActionPrimary: { flex: 1, minHeight: controlSizes.large, maxWidth: 220, borderRadius: radii.md, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center", paddingHorizontal: spacing.lg },
  keyGrid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  keyChip: { minWidth: 45, height: controlSizes.compact, borderWidth: 1, borderColor: colors.line, borderRadius: radii.md, backgroundColor: colors.surfaceMuted, alignItems: "center", justifyContent: "center" },
  keyChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  keyChipText: { color: colors.text, fontSize: fontSizes.s13, fontWeight: fontWeights.extrabold },
  keyChipTextActive: { color: colors.surface },
  quickSongContent: { minHeight: 160, paddingTop: spacing.md },
});




