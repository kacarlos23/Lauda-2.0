import { uiPatterns } from "../../../src/components/ui/patterns";
import { requestFormNavigation } from "../../../src/navigation/formExitGuard";
import { useFormExit } from "../../../src/hooks/useFormExit";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { Linking, Modal, ScrollView, StyleSheet, Text, TouchableOpacity, useWindowDimensions, View } from "react-native";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { AppInput, Button, ErrorBanner, Screen } from "../../../src/components/ui";
import { breakpoints, colors, iconSizes, overlays, spacing, typography } from "../../../src/theme";
import { Schedule, ScheduleSong, Song } from "../../../src/types";
import { useAuthStore } from "../../../src/store/authStore";
import { canEditSchedule, canViewScheduleAdminList, canViewScheduleReports } from "../../../src/utils/schedulePermissions";
import { canManageMusic } from "../../../src/utils/musicPermissions";
import { scheduleService } from "../../../src/services/scheduleService";
import { musicService } from "../../../src/services/musicService";
import { worshipOrderService, WorshipOrderPayload } from "../../../src/services/worshipOrderService";
import { nav } from "../../../src/navigation/routes";
import { ArrowLeft, BookOpen, CalendarDays, Download, Eye, FileText, Music2, Plus, RefreshCw, Save } from "lucide-react-native";
import { ScheduleSongCard } from "../../../src/components/schedules/ScheduleSongCard";
import { ScheduleParticipationFields } from "../../../src/components/schedules/ScheduleWorshipFields";
import { SortableSongList, moveListItem } from "../../../src/components/schedules/SortableSongList";
import { DateTimeInput } from "../../../src/components/DateTimeInput";
import * as Clipboard from "expo-clipboard";
import { WorshipReadingCard } from "../../../src/components/schedules/WorshipReadingCard";
import { worshipItems, withWorshipItems, worshipOrderText, WorshipItem } from "../../../src/utils/worshipOrderItems";

type Period = "morning" | "evening";
type Periods = Record<Period, Schedule | null>;
const dateKey = (value: string) => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date(value));
const validDate = (date: string) => /^\d{4}-\d{2}-\d{2}$/.test(date) && Number.isFinite(Date.parse(`${date}T12:00:00Z`)) && new Date(`${date}T12:00:00Z`).toISOString().slice(0, 10) === date;
const errorText = (error: unknown) => {
  const apiError = error as { response?: { data?: { error?: string; message?: string; details?: string[] } } };
  const data = apiError.response?.data;
  return data?.details?.length ? data.details.join("\n") : data?.error || data?.message || (error instanceof Error ? error.message : "Não foi possível concluir a operação.");
};
const safeVideo = (value?: string | null) => {
  try {
    const url = new URL(value ?? "");
    return url.protocol === "https:" && !url.username && !url.password && !url.port && ["youtube.com", "www.youtube.com", "m.youtube.com", "music.youtube.com", "youtu.be"].includes(url.hostname) ? url.href : null;
  } catch { return null; }
};

export default function WorshipOrderScreen() {
  const router = useRouter();
  const compactLayout = useWindowDimensions().width < breakpoints.mobile;
  const params = useLocalSearchParams<{ date?: string }>();
  const { user } = useAuthStore();
  const canView = canViewScheduleAdminList(user), canEdit = canEditSchedule(user);
  const canSongs = canEdit && canManageMusic(user, "song:attach_to_schedule");
  const canExport = canViewScheduleReports(user);
  const canExportSongs = canManageMusic(user, "song:view");
  const [date, setDate] = useState(params.date && validDate(params.date) ? params.date : dateKey(new Date().toISOString()));
  const [loadedDate, setLoadedDate] = useState("");
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [periods, setPeriods] = useState<Periods>({ morning: null, evening: null });
  const [busy, setBusy] = useState(false), [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [readingEditor, setReadingEditor] = useState<{ period: Period; index?: number } | null>(null);
  const [readingText, setReadingText] = useState("");
  const [textVisible, setTextVisible] = useState(false), [copyMessage, setCopyMessage] = useState("");
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
    if (!canView || !validDate(requestedDate)) { setError("Informe uma data válida no formato DD/MM/AAAA."); return; }
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
    if (!schedule) return;
    // Keep readings in place when adding a song; remove songs without leaving gaps.
    const remaining = [...entries];
    const items = worshipItems(schedule).flatMap((item): WorshipItem[] => {
      if (item.kind === "reading") return [item];
      const next = remaining.shift();
      return next ? [{ kind: "song", entry: next }] : [];
    });
    updateItems(period, [...items, ...remaining.map((entry): WorshipItem => ({ kind: "song", entry }))]);
  }
  function updateItems(period: Period, items: WorshipItem[]) {
    const schedule = periods[period];
    if (schedule) updatePeriod(period, withWorshipItems(schedule, items));
  }
  function editEntry(period: Period, index: number, patch: Partial<ScheduleSong>) {
    updateSongs(period, (periods[period]?.songs ?? []).map((entry, i) => i === index ? { ...entry, ...patch } : entry));
  }
  function move(period: Period, index: number, direction: number) {
    updateItems(period, moveListItem(worshipItems(periods[period] ?? {}), index, index + direction));
  }
  function commitReading() {
    if (!readingEditor || !readingText.trim()) return;
    const items = worshipItems(periods[readingEditor.period] ?? {});
    if (readingEditor.index === undefined) items.push({ kind: "reading", entry: { id: `reading-${Date.now()}-${Math.random().toString(36).slice(2)}`, text: readingText, position: items.length } });
    else {
      const item = items[readingEditor.index];
      if (item?.kind === "reading") items[readingEditor.index] = { ...item, entry: { ...item.entry, text: readingText } };
    }
    updateItems(readingEditor.period, items); setReadingEditor(null);
  }
  async function copyText() {
    try {
      const copied = await Clipboard.setStringAsync(worshipOrderText(periods));
      setCopyMessage(copied ? "Texto copiado." : "Não foi possível copiar. Selecione o texto e copie manualmente.");
    } catch { setCopyMessage("Não foi possível copiar. Selecione o texto e copie manualmente."); }
  }
  async function save() {
    if (!loadedDate || busy) { setError("Carregue a data antes de salvar a ordem de culto."); return; }
    setBusy(true); setError(null); setMessage("");
    try {
      const payload = Object.fromEntries((["morning", "evening"] as const).map((period) => {
        const schedule = periods[period];
        return [period, schedule ? { scheduleId: schedule.id, readings: withWorshipItems(schedule, worshipItems(schedule)).readings ?? [], songs: (schedule.songs ?? []).map((entry) => ({
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
  // A song used in both periods needs only one chart in the combined booklet.
  const songIds = [...new Set(([periods.morning, periods.evening]).flatMap((period) =>
    [...(period?.songs ?? [])].sort((a, b) => a.order - b.order).map((entry) => entry.songId)
  ))];
  async function exportChords() {
    if (!ready || dirty || !songIds.length) return;
    if (songIds.length > 50) { setError("É possível exportar até 50 músicas por PDF."); return; }
    setBusy(true); setError(null);
    try { await musicService.exportSongs(songIds, `Cifras_${date.split("-").reverse().join("-")}.pdf`); }
    catch (reason) { setError(errorText(reason)); }
    finally { setBusy(false); }
  }
  const openPicker = (kind: "song" | "schedule", period: Period) => { setSearch(""); setPage(1); setSongs([]); setPicker({ kind, period }); };

  if (!canView) return <Screen><ErrorBanner message="Sem permissão para visualizar escalas." /></Screen>;
  return <Screen scroll contentStyle={styles.content}>
    {formExit.dialog}
    <Button title="Voltar às escalas" size="sm" style={styles.backButton} icon={<ArrowLeft size={iconSizes.s16} />} variant="secondary" onPress={() => requestFormNavigation(() => router.replace(nav.schedules))} />
    <Text style={styles.title}>Ordem de Culto</Text>
    <Text style={styles.muted}>Organize músicas, momentos e leituras bíblicas na sequência do culto.</Text>
    <DateTimeInput type="date" label="Data do culto" value={date.split("-").reverse().join("/")} onChange={(value) => { if (!busy) setDate(value.split("/").reverse().join("-")); }} testID="worship-date" trailingAction={
      <TouchableOpacity style={styles.refresh} disabled={busy} accessibilityRole="button" accessibilityLabel={dirty ? "Atualizar data (descarta alterações)" : "Atualizar data"} accessibilityHint="Busca a programação salva para a data informada" onPress={() => requestFormNavigation(() => void load())}>
        <RefreshCw size={iconSizes.s20} color={busy ? colors.muted : colors.primary} />
      </TouchableOpacity>
    } />
    <ErrorBanner message={error} />
    {message ? <Text accessibilityRole="alert" style={styles.muted}>{message}</Text> : null}
    {loadedDate !== date ? <Text style={styles.muted}>Carregue a data para editar ou exportar.</Text> : null}
    {(["morning", "evening"] as const).map((period) => {
      const schedule = periods[period];
      const items = worshipItems(schedule ?? {});
      return <View key={period} style={[styles.section, period === "evening" && styles.eveningSection]}>
        <Text accessibilityRole="header" style={styles.periodTitle}>{period === "morning" ? "CULTO DA MANHÃ" : "CULTO DA NOITE"}</Text>
        <Text style={styles.muted}>{schedule ? `${schedule.title} · ${schedule.songs?.length ?? 0} músicas` : "Período não incluído"}</Text>
        {canEdit ? <View style={styles.actions}>
          <Button title="Selecionar escala" size="sm" icon={<CalendarDays size={iconSizes.s18} />} variant="secondary" disabled={!ready} onPress={() => openPicker("schedule", period)} />
          {schedule ? <Button title="Não incluir período" variant="ghost" disabled={!ready} onPress={() => updatePeriod(period, null)} /> : null}
        </View> : null}
        <SortableSongList items={items} itemKey={(item) => item.kind === "song" ? item.entry.songId : `reading:${item.entry.id}`} itemLabel={(item) => item.kind === "song" ? item.entry.song.title : `leitura ${items.indexOf(item) + 1}`}
          disabled={!ready || !canEdit} canDragItem={(item) => item.kind === "reading" || canSongs} onMove={(from, to) => updateItems(period, moveListItem(items, from, to))}
          renderItem={(item, index) => {
            if (item.kind === "reading") return <WorshipReadingCard text={item.entry.text} position={index + 1} editable={canEdit && ready}
              onEdit={() => { setReadingText(item.entry.text); setReadingEditor({ period, index }); }}
              onRemove={() => updateItems(period, items.filter((_, i) => i !== index))}
              onUp={() => move(period, index, -1)} onDown={() => move(period, index, 1)} first={index === 0} last={index === items.length - 1} />;
            const entry = item.entry;
            return <ScheduleSongCard song={entry.song} position={index + 1}
            momentDrawer={canEdit} momentLabel={entry.moment ?? "Louvor"}
            onMoveUp={canSongs ? () => move(period, index, -1) : undefined}
            onMoveDown={canSongs ? () => move(period, index, 1) : undefined}
            onRemove={canSongs && ready ? () => updateItems(period, items.filter((_, i) => i !== index)) : undefined}
            disableMoveUp={!ready || index === 0} disableMoveDown={!ready || index === items.length - 1}
            footer={canEdit ? <ScheduleParticipationFields value={{ songId: entry.songId, moment: entry.moment ?? "Louvor", momentDescription: entry.momentDescription }}
              disabled={!ready} onChange={(patch) => editEntry(period, (schedule?.songs ?? []).findIndex((song) => song.songId === entry.songId), patch)} /> : <>
              <Text style={styles.muted}>{entry.moment ?? "Louvor"}{entry.moment === "Outro" && entry.momentDescription ? `: ${entry.momentDescription}` : ""}</Text>
              {safeVideo(entry.song.videoUrl) ? <Button title="Assistir no YouTube" variant="ghost" onPress={() => void Linking.openURL(entry.song.videoUrl!).catch((reason) => setError(errorText(reason)))} /> : null}
            </>}
          />; }}
        />
        {schedule && !schedule.songs?.length ? <Text style={styles.muted}>Nenhuma música nesta escala.</Text> : null}
        {schedule && canEdit ? <View style={styles.addBar}>
          <View style={styles.addLabel}><Plus size={iconSizes.s16} color={colors.muted} /><Text style={styles.addLabelText}>Incluir na ordem</Text></View>
          <View style={styles.actions}>
            {canSongs && canManageMusic(user, "song:view") ? <Button title="Música" accessibilityLabel="Adicionar música do repertório" size="sm" style={styles.compactAction} icon={<Music2 size={iconSizes.s18} />} variant="secondary" disabled={!ready} onPress={() => openPicker("song", period)} /> : null}
            <Button title="Leitura bíblica" accessibilityLabel="Adicionar leitura bíblica" size="sm" style={styles.compactAction} icon={<BookOpen size={iconSizes.s18} />} variant="secondary" disabled={!ready} onPress={() => { setReadingText(""); setReadingEditor({ period }); }} />
          </View>
        </View> : null}
      </View>;
    })}
    {dirty ? <Text style={styles.muted}>Há alterações pendentes. Salve antes de visualizar ou exportar.</Text> : null}
    <View testID="worship-document-actions" style={[styles.documentActions, compactLayout && styles.documentActionsCompact]}>
      {canEdit ? <Button title="Salvar alterações" style={compactLayout && styles.mobileAction} size="sm" icon={<Save size={iconSizes.s18} />} loading={busy} disabled={!ready || !dirty || (!periods.morning && !periods.evening)} onPress={() => void save()} /> : null}
      <View style={[styles.exportActions, compactLayout && styles.documentActionsCompact]}>
      {canExport ? <>
        <Button title="Visualizar texto" style={compactLayout && styles.mobileAction} size="sm" icon={<FileText size={iconSizes.s18} />} variant="ghost" disabled={!ready || dirty || ![periods.morning, periods.evening].some((p) => p && worshipItems(p).length)} onPress={() => { setCopyMessage(""); setTextVisible(true); }} />
        <Button title="Prévia do PDF" style={compactLayout && styles.mobileAction} size="sm" icon={<Eye size={iconSizes.s18} />} variant="ghost" disabled={!ready || dirty || ![periods.morning, periods.evening].some((p) => p && worshipItems(p).length)} onPress={() => void exportPdf(true)} />
        <Button title="Exportar PDF" style={compactLayout && styles.mobileAction} size="sm" icon={<Download size={iconSizes.s18} />} variant="secondary" disabled={!ready || dirty || ![periods.morning, periods.evening].some((p) => p && worshipItems(p).length)} onPress={() => void exportPdf(false)} />
      </> : null}
      {canExportSongs ? <Button title="Gerar PDF das cifras" style={compactLayout && styles.mobileAction} size="sm" icon={<Music2 size={iconSizes.s18} />} variant="secondary" disabled={!ready || dirty || !songIds.length} onPress={() => void exportChords()} /> : null}
      </View>
    </View>
    <Modal visible={Boolean(readingEditor)} transparent animationType="fade" onRequestClose={() => setReadingEditor(null)}>
      <View style={styles.backdrop}><View style={styles.modal}>
        <Text style={styles.heading}>{readingEditor?.index === undefined ? "Adicionar leitura bíblica" : "Editar leitura bíblica"}</Text>
        <AppInput label="Leitura bíblica" accessibilityLabel="Leitura bíblica" multiline maxLength={12000} value={readingText} onChangeText={setReadingText}
          style={{ minHeight: 140, textAlignVertical: "top" }} placeholder={'João 3:16\nPorque Deus amou o mundo…'}
          hint="Escreva a referência e o texto. Use uma quebra de linha para separá-los." />
        <View style={styles.actions}>
          <Button title="Concluir leitura" disabled={!readingText.trim()} onPress={commitReading} />
          <Button title="Cancelar" variant="ghost" onPress={() => setReadingEditor(null)} />
        </View>
      </View></View>
    </Modal>
    <Modal visible={textVisible} transparent animationType="fade" onRequestClose={() => setTextVisible(false)}>
      <View style={styles.backdrop}><View style={styles.modal}>
        <Text style={styles.heading}>Ordem de culto em texto</Text>
        <ScrollView><Text selectable testID="worship-order-text" style={styles.reportText}>{worshipOrderText(periods)}</Text></ScrollView>
        {copyMessage ? <Text accessibilityRole="alert" style={styles.muted}>{copyMessage}</Text> : null}
        <View style={styles.actions}>
          <Button title="Copiar texto" onPress={() => void copyText()} />
          <Button title="Fechar texto" variant="ghost" onPress={() => setTextVisible(false)} />
        </View>
      </View></View>
    </Modal>
    <Modal visible={Boolean(picker)} transparent animationType="fade" onRequestClose={() => setPicker(null)}>
      <View style={styles.backdrop}><View style={styles.modal}>
        <Text style={styles.heading}>{picker?.kind === "song" ? "Adicionar música" : "Selecionar escala da data"}</Text>
        <AppInput label="Buscar" value={search} onChangeText={(value) => { setSearch(value); setPage(1); }} />
        <ErrorBanner message={error} />
        <ScrollView contentContainerStyle={styles.content}>
          {picker?.kind === "schedule" ? <>
            {schedules.filter((schedule) => dateKey(schedule.date) === date && schedule.id !== periods[picker.period === "morning" ? "evening" : "morning"]?.id && schedule.title.toLocaleLowerCase().includes(search.toLocaleLowerCase())).map((schedule) => <Button key={schedule.id} title={`${schedule.title} · ${schedule.ministry?.name ?? ""}`} variant="secondary" onPress={() => { updatePeriod(picker.period, { ...schedule, songs: [...(schedule.songs ?? [])].sort((a, b) => a.order - b.order) }); setPicker(null); }} />)}
            <Text style={styles.muted}>São exibidas as escalas ativas desta data. Crie uma escala na área de Escalas, se necessário.</Text>
          </> : <>
            {searchBusy ? <Text style={styles.muted}>Buscando músicas…</Text> : songs.map((song) => <Button key={song.id} title={`${song.title} · ${song.artist?.name ?? ""}`} variant="secondary" disabled={Boolean(picker && periods[picker.period]?.songs?.some((entry) => entry.songId === song.id))} onPress={() => {
              if (!picker) return;
              updateSongs(picker.period, [...(periods[picker.period]?.songs ?? []), { id: song.id, songId: song.id, scheduleId: periods[picker.period]!.id, order: 0, moment: "Louvor", song }]);
              setPicker(null);
            }} />)}
            {!searchBusy && !songs.length ? <Text style={styles.muted}>Nenhuma música encontrada.</Text> : null}
            <View style={styles.actions}>
              <Button title="Anterior" disabled={searchBusy || page === 1} variant="ghost" onPress={() => setPage(page - 1)} />
              <Button title="Próxima" disabled={searchBusy || !hasMore} variant="ghost" onPress={() => setPage(page + 1)} />
            </View>
          </>}
        </ScrollView>
        <Button title="Fechar" variant="ghost" onPress={() => setPicker(null)} />
      </View></View>
    </Modal>
  </Screen>;
}

const styles = StyleSheet.create({
  reportText: { ...typography.body, color: colors.text },
  refresh: { width: 44, minHeight: 44, alignItems: "center", justifyContent: "center" },
  content: { gap: spacing.md }, title: { ...uiPatterns.pageTitle },
  heading: { ...typography.label, color: colors.text }, muted: { ...typography.body, color: colors.muted },
  periodTitle: { ...typography.sectionTitle, color: colors.primary },
  section: { gap: spacing.md, marginVertical: spacing.lg },
  eveningSection: { borderTopWidth: 1, borderTopColor: colors.line, paddingTop: spacing.xl, marginTop: spacing.xl },
  card: { gap: spacing.sm },
  actions: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  addBar: { alignSelf: "flex-start", maxWidth: "100%", gap: spacing.sm, padding: spacing.md, backgroundColor: colors.surfaceMuted, borderRadius: 12 },
  addLabel: { flexDirection: "row", alignItems: "center", gap: spacing.xs },
  addLabelText: { ...typography.metadata, color: colors.muted },
  compactAction: { flexGrow: 0, alignSelf: "flex-start" },
  backButton: { alignSelf: "flex-start" },
  mobileAction: { width: "100%" },
  documentActionsCompact: { flexDirection: "column", alignItems: "stretch", width: "100%" },
  exportActions: { flexDirection: "row", flexWrap: "wrap", flexShrink: 1, minWidth: 0, maxWidth: "100%", gap: spacing.sm },
  documentActions: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: spacing.md, borderTopWidth: 1, borderTopColor: colors.line, paddingTop: spacing.lg },
  backdrop: { flex: 1, backgroundColor: overlays.modal, justifyContent: "center", alignItems: "center", padding: spacing.lg },
  modal: { backgroundColor: colors.surface, width: "100%", maxWidth: 680, maxHeight: "90%", padding: spacing.lg, borderRadius: 16, gap: spacing.md },
});
