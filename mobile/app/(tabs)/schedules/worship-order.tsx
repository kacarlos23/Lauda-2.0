import { requestFormNavigation } from "../../../src/navigation/formExitGuard";
import { useFormExit } from "../../../src/hooks/useFormExit";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { Linking, Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { AppInput, Button, ErrorBanner, Screen } from "../../../src/components/ui";
import { colors, iconSizes, overlays, spacing, typography } from "../../../src/theme";
import { Schedule, ScheduleSong, Song } from "../../../src/types";
import { useAuthStore } from "../../../src/store/authStore";
import { canEditSchedule, canViewScheduleAdminList, canViewScheduleReports } from "../../../src/utils/schedulePermissions";
import { canManageMusic } from "../../../src/utils/musicPermissions";
import { scheduleService } from "../../../src/services/scheduleService";
import { musicService } from "../../../src/services/musicService";
import { worshipOrderService, WorshipOrderPayload } from "../../../src/services/worshipOrderService";
import { nav } from "../../../src/navigation/routes";
import { RefreshCw } from "lucide-react-native";
import { ScheduleSongCard } from "../../../src/components/schedules/ScheduleSongCard";
import { ScheduleParticipationFields } from "../../../src/components/schedules/ScheduleWorshipFields";
import { SortableSongList, moveListItem } from "../../../src/components/schedules/SortableSongList";
import { DateTimeInput } from "../../../src/components/DateTimeInput";

type Period = "morning" | "evening";
type Periods = Record<Period, Schedule | null>;
const dateKey = (value: string) => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date(value));
const validDate = (date: string) => /^\d{4}-\d{2}-\d{2}$/.test(date) && Number.isFinite(Date.parse(`${date}T12:00:00Z`)) && new Date(`${date}T12:00:00Z`).toISOString().slice(0, 10) === date;
const errorText = (error: unknown) => {
  const apiError = error as { response?: { data?: { error?: string; message?: string; details?: string[] } } };
  const data = apiError.response?.data;
  return data?.details?.length ? data.details.join("\n") : data?.error || data?.message || (error instanceof Error ? error.message : "N�o foi poss�vel concluir a opera��o.");
};
const safeVideo = (value?: string | null) => {
  try {
    const url = new URL(value ?? "");
    return url.protocol === "https:" && !url.username && !url.password && !url.port && ["youtube.com", "www.youtube.com", "m.youtube.com", "music.youtube.com", "youtu.be"].includes(url.hostname) ? url.href : null;
  } catch { return null; }
};

export default function WorshipOrderScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ date?: string }>();
  const { user } = useAuthStore();
  const canView = canViewScheduleAdminList(user), canEdit = canEditSchedule(user);
  const canSongs = canEdit && canManageMusic(user, "song:attach_to_schedule");
  const canExport = canViewScheduleReports(user);
  const [date, setDate] = useState(params.date && validDate(params.date) ? params.date : dateKey(new Date().toISOString()));
  const [loadedDate, setLoadedDate] = useState("");
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [periods, setPeriods] = useState<Periods>({ morning: null, evening: null });
  const [busy, setBusy] = useState(false), [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [picker, setPicker] = useState<{ kind: "schedule" | "song"; period: Period } | null>(null);
  const [search, setSearch] = useState(""), [songs, setSongs] = useState<Song[]>([]);
  const [page, setPage] = useState(1), [hasMore, setHasMore] = useState(false), [searchBusy, setSearchBusy] = useState(false);
  const searchVersion = useRef(0);
  const ready = !busy && loadedDate === date;

  const formExit = useFormExit({
    id: `worship-order:${loadedDate || params.date || "today"}`, ready: Boolean(loadedDate),
    value: { periods },
    restore: (value) => { setPeriods(value.periods); },
    save: () => save(),
  });

  const dirty = formExit.dirty;

  async function load(requestedDate = date) {
    if (!canView || !validDate(requestedDate)) { setError("Informe uma data v�lida no formato DD/MM/AAAA."); return; }
    setBusy(true); setError(null); setMessage("");
    try {
      const [all, order] = await Promise.all([scheduleService.listSchedules(), worshipOrderService.get(requestedDate)]);
      setSchedules(all); setPeriods({ morning: order?.morning ?? null, evening: order?.evening ?? null });
      setDate(requestedDate); setLoadedDate(requestedDate);
      formExit.reset({ periods: { morning: order?.morning ?? null, evening: order?.evening ?? null } });
    } catch (reason) { setLoadedDate(""); setError(errorText(reason)); }
    finally { setBusy(false); }
  }
  useFocusEffect(useCallback(() => {
    if (canView) void load(params.date && validDate(params.date) ? params.date : dateKey(new Date().toISOString()));
  }, [canView, params.date]));

  useEffect(() => {
    const version = ++searchVersion.current;
    if (picker?.kind !== "song") return;
    setSearchBusy(true);
    const timer = setTimeout(() => {
      musicService.listSongs(search, page, 20).then((result) => {
        if (version !== searchVersion.current) return;
        setSongs(result.items); setHasMore(result.pagination.page < result.pagination.totalPages);
      }).catch((reason) => { if (version === searchVersion.current) setError(errorText(reason)); })
        .finally(() => { if (version === searchVersion.current) setSearchBusy(false); });
    }, 250);
    return () => { clearTimeout(timer); searchVersion.current++; };
  }, [picker, search, page]);

  function updatePeriod(period: Period, value: Schedule | null) {
    setPeriods((current) => ({ ...current, [period]: value })); setMessage("");
  }
  function updateSongs(period: Period, entries: ScheduleSong[]) {
    const schedule = periods[period];
    if (schedule) updatePeriod(period, { ...schedule, songs: entries.map((entry, order) => ({ ...entry, order })) });
  }
  function editEntry(period: Period, index: number, patch: Partial<ScheduleSong>) {
    updateSongs(period, (periods[period]?.songs ?? []).map((entry, i) => i === index ? { ...entry, ...patch } : entry));
  }
  function move(period: Period, index: number, direction: number) {
    updateSongs(period, moveListItem(periods[period]?.songs ?? [], index, index + direction));
  }
  async function save() {
    if (!loadedDate || busy) { setError("Carregue a data antes de salvar a ordem de culto."); return; }
    setBusy(true); setError(null); setMessage("");
    try {
      const payload = Object.fromEntries((["morning", "evening"] as const).map((period) => {
        const schedule = periods[period];
        return [period, schedule ? { scheduleId: schedule.id, songs: (schedule.songs ?? []).map((entry) => ({
          songId: entry.songId, moment: entry.moment ?? "Louvor", momentDescription: entry.momentDescription, videoUrlOverride: null,
        })) } : null];
      })) as WorshipOrderPayload;
      const saved = await worshipOrderService.save(loadedDate, payload);
      setPeriods({ morning: saved.morning, evening: saved.evening });
      // Keep the schedule selector consistent with persisted songs.
      setSchedules((all) => all.map((schedule) => saved.morning?.id === schedule.id ? saved.morning : saved.evening?.id === schedule.id ? saved.evening : schedule));
      setMessage("Ordem de culto salva.");
      await formExit.complete({ periods: { morning: saved.morning, evening: saved.evening } });
    } catch (reason) { setError(errorText(reason)); }
    finally { setBusy(false); }
  }
  async function exportPdf(preview: boolean) {
    setBusy(true); setError(null);
    try { await worshipOrderService.exportPdf(date, preview); }
    catch (reason) { setError(errorText(reason)); }
    finally { setBusy(false); }
  }
  const openPicker = (kind: "song" | "schedule", period: Period) => { setSearch(""); setPage(1); setSongs([]); setPicker({ kind, period }); };

  if (!canView) return <Screen><ErrorBanner message="Sem permiss�o para visualizar escalas." /></Screen>;
  return <Screen scroll contentStyle={styles.content}>
    {formExit.dialog}
    <Button title="Voltar �s escalas" variant="ghost" onPress={() => requestFormNavigation(() => router.replace(nav.schedules))} />
    <Text style={styles.title}>Ordem de Culto</Text>
    <Text style={styles.muted}>Organize o Programa de Louvor. As m�sicas e os momentos ser�o salvos nas escalas selecionadas.</Text>
    <DateTimeInput type="date" label="Data do culto" value={date.split("-").reverse().join("/")} onChange={(value) => { if (!busy) setDate(value.split("/").reverse().join("-")); }} testID="worship-date" trailingAction={
      <TouchableOpacity style={styles.refresh} disabled={busy} accessibilityRole="button" accessibilityLabel={dirty ? "Atualizar data (descarta altera��es)" : "Atualizar data"} accessibilityHint="Busca a programa��o salva para a data informada" onPress={() => requestFormNavigation(() => void load())}>
        <RefreshCw size={iconSizes.s20} color={busy ? colors.muted : colors.primary} />
      </TouchableOpacity>
    } />
    <ErrorBanner message={error} />
    {message ? <Text accessibilityRole="alert" style={styles.muted}>{message}</Text> : null}
    {loadedDate !== date ? <Text style={styles.muted}>Carregue a data para editar ou exportar.</Text> : null}
    {(["morning", "evening"] as const).map((period) => {
      const schedule = periods[period];
      return <View key={period} style={[styles.section, period === "evening" && styles.eveningSection]}>
        <Text accessibilityRole="header" style={styles.periodTitle}>{period === "morning" ? "CULTO DA MANH�" : "CULTO DA NOITE"}</Text>
        <Text style={styles.muted}>{schedule ? `${schedule.title} � ${schedule.songs?.length ?? 0} m�sicas` : "Per�odo n�o inclu�do"}</Text>
        {canEdit ? <View style={styles.actions}>
          <Button title="Selecionar escala" variant="secondary" disabled={!ready} onPress={() => openPicker("schedule", period)} />
          {schedule ? <Button title="N�o incluir per�odo" variant="ghost" disabled={!ready} onPress={() => updatePeriod(period, null)} /> : null}
        </View> : null}
        <SortableSongList items={schedule?.songs ?? []} itemKey={(entry) => entry.songId} itemLabel={(entry) => entry.song.title}
          disabled={!ready || !canSongs} onMove={(from, to) => updateSongs(period, moveListItem(schedule?.songs ?? [], from, to))}
          renderItem={(entry, index) => <ScheduleSongCard song={entry.song} position={index + 1}
            momentDrawer={canEdit} momentLabel={entry.moment ?? "Louvor"}
            onMoveUp={canSongs ? () => move(period, index, -1) : undefined}
            onMoveDown={canSongs ? () => move(period, index, 1) : undefined}
            onRemove={canSongs && ready ? () => updateSongs(period, (schedule?.songs ?? []).filter((item) => item.songId !== entry.songId)) : undefined}
            disableMoveUp={!ready || index === 0} disableMoveDown={!ready || index === (schedule?.songs?.length ?? 0) - 1}
            footer={canEdit ? <ScheduleParticipationFields value={{ songId: entry.songId, moment: entry.moment ?? "Louvor", momentDescription: entry.momentDescription }}
              disabled={!ready} onChange={(patch) => editEntry(period, index, patch)} /> : <>
              <Text style={styles.muted}>{entry.moment ?? "Louvor"}{entry.moment === "Outro" && entry.momentDescription ? `: ${entry.momentDescription}` : ""}</Text>
              {safeVideo(entry.song.videoUrl) ? <Button title="Assistir no YouTube" variant="ghost" onPress={() => void Linking.openURL(entry.song.videoUrl!).catch((reason) => setError(errorText(reason)))} /> : null}
            </>}
          />}
        />
        {schedule && !schedule.songs?.length ? <Text style={styles.muted}>Nenhuma m�sica nesta escala.</Text> : null}
        {schedule && canSongs && canManageMusic(user, "song:view") ? <Button title="Adicionar m�sica do repert�rio" variant="secondary" disabled={!ready} onPress={() => openPicker("song", period)} /> : null}
      </View>;
    })}
    {dirty ? <Text style={styles.muted}>H� altera��es pendentes. Salve antes de visualizar ou exportar.</Text> : null}
    <View style={styles.actions}>
      {canEdit ? <Button title="Salvar altera��es" loading={busy} disabled={!ready || !dirty || (!periods.morning && !periods.evening)} onPress={() => void save()} /> : null}
      {canExport ? <>
        <Button title="Pr�via do PDF" variant="secondary" disabled={!ready || dirty || ![periods.morning, periods.evening].some((p) => p?.songs?.length)} onPress={() => void exportPdf(true)} />
        <Button title="Exportar PDF" disabled={!ready || dirty || ![periods.morning, periods.evening].some((p) => p?.songs?.length)} onPress={() => void exportPdf(false)} />
      </> : null}
    </View>
    <Modal visible={Boolean(picker)} transparent animationType="fade" onRequestClose={() => setPicker(null)}>
      <View style={styles.backdrop}><View style={styles.modal}>
        <Text style={styles.heading}>{picker?.kind === "song" ? "Adicionar m�sica" : "Selecionar escala da data"}</Text>
        <AppInput label="Buscar" value={search} onChangeText={(value) => { setSearch(value); setPage(1); }} />
        <ErrorBanner message={error} />
        <ScrollView contentContainerStyle={styles.content}>
          {picker?.kind === "schedule" ? <>
            {schedules.filter((schedule) => dateKey(schedule.date) === date && schedule.id !== periods[picker.period === "morning" ? "evening" : "morning"]?.id && schedule.title.toLocaleLowerCase().includes(search.toLocaleLowerCase())).map((schedule) => <Button key={schedule.id} title={`${schedule.title} � ${schedule.ministry?.name ?? ""}`} variant="secondary" onPress={() => { updatePeriod(picker.period, { ...schedule, songs: [...(schedule.songs ?? [])].sort((a, b) => a.order - b.order) }); setPicker(null); }} />)}
            <Text style={styles.muted}>S�o exibidas as escalas ativas desta data. Crie uma escala na �rea de Escalas, se necess�rio.</Text>
          </> : <>
            {searchBusy ? <Text style={styles.muted}>Buscando m�sicas.</Text> : songs.map((song) => <Button key={song.id} title={`${song.title} � ${song.artist?.name ?? ""}`} variant="secondary" disabled={Boolean(picker && periods[picker.period]?.songs?.some((entry) => entry.songId === song.id))} onPress={() => {
              if (!picker) return;
              updateSongs(picker.period, [...(periods[picker.period]?.songs ?? []), { id: song.id, songId: song.id, scheduleId: periods[picker.period]!.id, order: 0, moment: "Louvor", song }]);
              setPicker(null);
            }} />)}
            {!searchBusy && !songs.length ? <Text style={styles.muted}>Nenhuma m�sica encontrada.</Text> : null}
            <View style={styles.actions}>
              <Button title="Anterior" disabled={searchBusy || page === 1} variant="ghost" onPress={() => setPage(page - 1)} />
              <Button title="Pr�xima" disabled={searchBusy || !hasMore} variant="ghost" onPress={() => setPage(page + 1)} />
            </View>
          </>}
        </ScrollView>
        <Button title="Fechar" variant="ghost" onPress={() => setPicker(null)} />
      </View></View>
    </Modal>
  </Screen>;
}

const styles = StyleSheet.create({
  refresh: { width: 44, minHeight: 44, alignItems: "center", justifyContent: "center" },
  content: { gap: spacing.md }, title: { ...typography.screenTitle, color: colors.text },
  heading: { ...typography.label, color: colors.text }, muted: { ...typography.body, color: colors.muted },
  periodTitle: { ...typography.sectionTitle, color: colors.primary },
  section: { gap: spacing.md, marginVertical: spacing.lg },
  eveningSection: { borderTopWidth: 1, borderTopColor: colors.line, paddingTop: spacing.xl, marginTop: spacing.xl },
  card: { gap: spacing.sm },
  actions: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  backdrop: { flex: 1, backgroundColor: overlays.modal, justifyContent: "center", alignItems: "center", padding: spacing.lg },
  modal: { backgroundColor: colors.surface, width: "100%", maxWidth: 680, maxHeight: "90%", padding: spacing.lg, borderRadius: 16, gap: spacing.md },
});
