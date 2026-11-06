import React, { useEffect, useMemo, useRef, useState } from "react";
import { Platform, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import * as DocumentPicker from "expo-document-picker";
import { CheckCircle2, Download, Upload } from "lucide-react-native";
import { BottomSheet } from "../BottomSheet";
import { Button, ConfirmDialog, ErrorBanner, LoadingState } from "../ui";
import { musicService, SongTransferDocument, SongTransferPreview } from "../../services/musicService";
import { Ministry } from "../../types";
import { parseSongTransferDocument } from "../../utils/songTransfer";
import { colors, fontSizes, fontWeights, iconSizes, lineHeights, radii, spacing } from "../../theme";

type Props = {
  visible: boolean;
  canImport: boolean;
  canExport: boolean;
  onClose: () => void;
  onImported: (message: string) => void;
};

const statusLabels = { CREATE: "Nova música", LINK: "Vincular", RESTORE: "Restaurar", ALREADY_LINKED: "Já vinculada", CONFLICT: "Conflito", INVALID: "Inválida" };
type ReviewFilter = "all" | "ready" | "issues";
const isReady = (status: string) => ["CREATE", "LINK", "RESTORE"].includes(status);

export function SongDataTransferPanel({ visible, canImport, canExport, onClose, onImported }: Props) {
  const [ministries, setMinistries] = useState<Ministry[]>([]);
  const [ministriesLoading, setMinistriesLoading] = useState(false);
  const [ministryId, setMinistryId] = useState<string | null>(null);
  const [document, setDocument] = useState<SongTransferDocument | null>(null);
  const [preview, setPreview] = useState<SongTransferPreview | null>(null);
  const [busy, setBusy] = useState(false);
  const [activity, setActivity] = useState<"review" | "export" | "import" | null>(null);
  const [filename, setFilename] = useState("");
  const [notice, setNotice] = useState("");
  const [filter, setFilter] = useState<ReviewFilter>("all");
  const [reviewPage, setReviewPage] = useState(0);
  const locked = useRef(false);
  const [confirmVisible, setConfirmVisible] = useState(false);
  const operation = useRef(0);
  const [error, setError] = useState<string | null>(null);
  const selectedMinistry = useMemo(() => ministries.find((item) => item.id === ministryId) ?? null, [ministries, ministryId]);
  const readyCount = preview ? preview.counts.CREATE + preview.counts.LINK + preview.counts.RESTORE : 0;
  const issueCount = preview ? preview.counts.CONFLICT + preview.counts.INVALID : 0;
  const reviewItems = preview?.items.filter((item) => filter === "all" || (filter === "ready" ? isReady(item.status) : ["CONFLICT", "INVALID"].includes(item.status))) ?? [];
  const close = () => { if (!locked.current) onClose(); };

  useEffect(() => {
    operation.current += 1;
    setDocument(null);
    setPreview(null);
    setConfirmVisible(false);
    setBusy(false);
    locked.current = false;
    setActivity(null); setFilename(""); setNotice(""); setFilter("all"); setReviewPage(0);
    if (!visible) return;
    let active = true;
    setError(null);
    setMinistriesLoading(true);
    void import("../../services/ministryApi")
      .then(({ ministryApi }) => ministryApi.getMinistries())
      .then((items) => { if (active) { setMinistries(items); setMinistryId((current) => items.some((item) => item.id === current) ? current : items.length === 1 ? items[0].id : null); } })
      .catch((reason) => { if (active) setError(reason instanceof Error ? reason.message : "Não foi possível carregar os ministérios."); })
      .finally(() => { if (active) setMinistriesLoading(false); });
    return () => { active = false; operation.current += 1; };
  }, [visible]);

  useEffect(() => {
    if (!ministryId && ministries.length === 1) setMinistryId(ministries[0].id);
  }, [ministries, ministryId]);

  const pickAndReview = async () => {
    if (locked.current || !canImport) return;
    if (!ministryId) {
      setError("Selecione o ministério que receberá as músicas.");
      return;
    }
    setBusy(true);
    locked.current = true; setActivity("review"); setNotice("");
    setError(null);
    const currentOperation = ++operation.current;
    try {
      // Keep the picker call synchronous with the user's click on the web.
      const result = await DocumentPicker.getDocumentAsync({
        type: Platform.OS === "web" ? [".json", "application/json", "text/json", "text/plain"] : "*/*",
        copyToCacheDirectory: true,
        multiple: false,
      });
      if (result.canceled || currentOperation !== operation.current) return;
      const asset = result.assets[0];
      if (asset.size && asset.size > 32 * 1024 * 1024) throw new Error("O arquivo excede 32 MB. Exporte um catálogo menor para importar.");
      const raw = asset.file ? await asset.file.text() : await new (await import("expo-file-system")).File(asset.uri).text();
      const parsed = parseSongTransferDocument(raw);
      const nextPreview = await musicService.previewSongData(ministryId, parsed);
      if (currentOperation !== operation.current) return;
      setDocument(parsed);
      setPreview(nextPreview);
      setFilename(asset.name); setFilter("all"); setReviewPage(0);
    } catch (reason) {
      if (currentOperation !== operation.current) return;
      setDocument(null);
      setPreview(null);
      setError(reason instanceof SyntaxError ? "O arquivo selecionado não é um JSON válido." : reason instanceof Error ? reason.message : "Não foi possível revisar o arquivo.");
    } finally {
      if (currentOperation === operation.current) { setBusy(false); locked.current = false; setActivity(null); }
    }
  };

  const commit = async () => {
    if (locked.current || !canImport || !ministryId || !document || !preview) return;
    setBusy(true);
    locked.current = true; setActivity("import");
    setError(null);
    const currentOperation = ++operation.current;
    try {
      const result = await musicService.commitSongData(ministryId, document, preview.documentHash);
      if (currentOperation !== operation.current) return;
      const skipped = result.conflicts + result.invalid;
      onImported(`${result.created} músicas criadas; ${result.linked} vínculos adicionados; ${result.restored} restauradas. ${result.alreadyLinked} já vinculadas${skipped ? `; ${skipped} não importadas por pendências` : ""}.`);
      setDocument(null);
      setPreview(null);
      setConfirmVisible(false);
      onClose();
    } catch (reason) {
      if (currentOperation !== operation.current) return;
      setConfirmVisible(false);
      setError(reason instanceof Error ? reason.message : "Não foi possível importar as músicas.");
    } finally {
      if (currentOperation === operation.current) { setBusy(false); locked.current = false; setActivity(null); }
    }
  };

  const exportData = async () => {
    if (locked.current || !canExport) return;
    if (!selectedMinistry) {
      setError("Selecione o ministério que será exportado.");
      return;
    }
    setBusy(true);
    locked.current = true; setActivity("export"); setNotice("");
    setError(null);
    const currentOperation = ++operation.current;
    try {
      await musicService.exportSongData(selectedMinistry.id, selectedMinistry.name);
      if (currentOperation === operation.current) setNotice(Platform.OS === "web" ? "Arquivo exportado. Confira os downloads do navegador." : "Arquivo preparado para compartilhar.");
    } catch (reason) {
      if (currentOperation !== operation.current) return;
      setError(reason instanceof Error ? reason.message : "Não foi possível exportar as músicas.");
    } finally {
      if (currentOperation === operation.current) { setBusy(false); locked.current = false; setActivity(null); }
    }
  };

  return (
    <>
    <BottomSheet presentation="modal" isOpen={visible && !confirmVisible} onClose={close} title="Importar e exportar músicas" footer={preview ? (
      <View style={styles.reviewFooter}>
        <View style={styles.footerInfo}><Text style={styles.label}>{readyCount} prontas para importar</Text><Text style={styles.meta}>Destino: {selectedMinistry?.name}</Text></View>
        <Button title={`Importar ${readyCount} músicas`} size="sm" style={styles.compactButton} icon={<Upload size={iconSizes.s18} />} disabled={busy || readyCount === 0} loading={activity === "import"} onPress={() => setConfirmVisible(true)} />
      </View>
    ) : undefined}>
      <View style={styles.body}>
      <Text style={styles.help}>Transfira o repertório entre ministérios com um arquivo do Lauda.</Text>
      <Text style={styles.label}>Ministério</Text>
      {ministriesLoading && !ministries.length ? <LoadingState centered={false} message="Carregando ministérios..." /> : (
        <View style={styles.ministries}>
          {ministries.map((ministry) => {
            const selected = ministry.id === ministryId;
            return (
              <TouchableOpacity
                key={ministry.id}
                disabled={busy || ministriesLoading}
                style={[styles.ministry, selected && styles.ministrySelected]}
                onPress={() => { if (locked.current) return; setMinistryId(ministry.id); setDocument(null); setPreview(null); setFilename(""); setNotice(""); setConfirmVisible(false); setError(null); }}
                accessibilityRole="radio"
                accessibilityState={{ selected }}
              >
                <Text style={[styles.ministryName, selected && styles.ministryNameSelected]}>{ministry.name}</Text>
                {selected ? <CheckCircle2 color={colors.primary} size={iconSizes.s19} /> : null}
              </TouchableOpacity>
            );
          })}
        </View>
      )}

      <ErrorBanner message={error} style={styles.error} />

      <View style={styles.actions}>
        {canImport ? (
          <View style={styles.actionCard}>
            <Upload color={colors.primary} size={iconSizes.s19} />
            <Text style={styles.cardTitle}>Importar repertório</Text>
            <Text style={styles.meta}>Selecione um JSON e confira as músicas antes de aplicar.</Text>
            <Button title="Selecionar arquivo" accessibilityLabel="Selecionar arquivo para revisar" size="sm" style={styles.compactButton} variant="secondary" disabled={!selectedMinistry || ministriesLoading || busy} loading={activity === "review"} onPress={() => void pickAndReview()} />
          </View>
        ) : null}
        {canExport ? (
          <View style={styles.actionCard}>
            <Download color={colors.primary} size={iconSizes.s19} />
            <Text style={styles.cardTitle}>Exportar repertório</Text>
            <Text style={styles.meta}>Salve nome, artista, tom, cifra e link da cifra em JSON.</Text>
            <Button title="Exportar JSON" accessibilityLabel="Exportar músicas do ministério" size="sm" style={styles.compactButton} variant="secondary" disabled={!selectedMinistry || ministriesLoading || busy} loading={activity === "export"} onPress={() => void exportData()} />
          </View>
        ) : null}
      </View>

      {notice ? <Text accessibilityRole="alert" style={styles.notice}>{notice}</Text> : null}
      {!ministriesLoading && !ministries.length ? <Text style={styles.meta}>Nenhum ministério disponível. Cadastre um ministério para transferir músicas.</Text> : null}
      {preview ? (
        <View style={styles.preview}>
          <Text style={styles.previewTitle}>Revisão concluída</Text>
          <Text style={styles.meta}>{filename} · {preview.total} músicas no arquivo</Text>
          <View style={styles.stats}>
            {[{ value: readyCount, label: "Prontas", color: colors.primary, background: colors.primarySoft }, { value: preview.counts.ALREADY_LINKED, label: "Já vinculadas", color: colors.neutral, background: colors.surfaceMuted }, { value: issueCount, label: "Pendências", color: colors.warningTextStrong, background: colors.warningSoft }].map((stat) => (
              <View key={stat.label} style={[styles.stat, { backgroundColor: stat.background }]}><Text style={[styles.statNumber, { color: stat.color }]}>{stat.value}</Text><Text style={[styles.statLabel, { color: stat.color }]}>{stat.label}</Text></View>
            ))}
          </View>
          <Text style={styles.meta}>{preview.counts.CREATE} novas · {preview.counts.LINK} para vincular · {preview.counts.RESTORE} para restaurar</Text>
          {issueCount ? <Text style={styles.issue}>Conflitos e itens inválidos serão ignorados. As cifras já cadastradas serão preservadas.</Text> : null}
          <View style={styles.filters}>
            {([{ id: "all", label: "Todas" }, { id: "ready", label: "Prontas" }, { id: "issues", label: "Pendências" }] as const).map((tab) => (
              <TouchableOpacity key={tab.id} accessibilityRole="tab" accessibilityState={{ selected: filter === tab.id }} style={[styles.filter, filter === tab.id && styles.filterActive]} onPress={() => { setFilter(tab.id); setReviewPage(0); }}><Text style={[styles.filterLabel, filter === tab.id && styles.ministryNameSelected]}>{tab.label}</Text></TouchableOpacity>
            ))}
          </View>
          {reviewItems.slice(reviewPage * 20, (reviewPage + 1) * 20).map((item) => (
            <View key={item.index} style={styles.reviewRow}>
              <View style={styles.rowHeading}><Text style={styles.songTitle}>{item.title}</Text><View style={[styles.badge, { backgroundColor: isReady(item.status) ? colors.primarySoft : item.status === "ALREADY_LINKED" ? colors.surfaceMuted : colors.warningSoft }]}><Text style={styles.badgeText}>{statusLabels[item.status]}</Text></View></View>
              <Text style={styles.meta}>{item.artist} · {document?.songs[item.index]?.originalKey}</Text>
              {item.reason ? <Text style={styles.issue}>{item.reason}</Text> : null}
            </View>
          ))}
          {!reviewItems.length ? <Text style={styles.meta}>Nenhuma música nesta situação.</Text> : null}
          {reviewItems.length > 20 ? <View style={styles.reviewFooter}><Text style={styles.meta}>{reviewPage * 20 + 1}–{Math.min((reviewPage + 1) * 20, reviewItems.length)} de {reviewItems.length}</Text><View style={styles.filters}><Button title="Anterior" size="sm" variant="ghost" disabled={reviewPage === 0} onPress={() => setReviewPage(reviewPage - 1)} /><Button title="Próxima" size="sm" variant="ghost" disabled={(reviewPage + 1) * 20 >= reviewItems.length} onPress={() => setReviewPage(reviewPage + 1)} /></View></View> : null}
        </View>
      ) : null}
      </View>
    </BottomSheet>
    {confirmVisible ? <ConfirmDialog
      visible={visible}
      title="Confirmar importação"
      message={`Importar ${readyCount} músicas para ${selectedMinistry?.name}? ${issueCount ? `${issueCount} com pendências serão ignoradas. ` : ""}As músicas já vinculadas serão mantidas.`}
      confirmLabel="Importar"
      loading={busy}
      onCancel={() => { if (!busy) setConfirmVisible(false); }}
      onConfirm={() => void commit()}
    /> : null}
    </>
  );
}

const styles = StyleSheet.create({
  body: { paddingHorizontal: spacing.xl, paddingTop: spacing.lg, paddingBottom: spacing.md },
  help: { color: colors.muted, fontSize: fontSizes.s14, lineHeight: lineHeights.h21, marginBottom: spacing.lg },
  label: { color: colors.ink, fontSize: fontSizes.s14, fontWeight: fontWeights.extrabold, marginBottom: spacing.sm },
  ministries: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  ministry: { maxWidth: "100%", flexDirection: "row", alignItems: "center", gap: spacing.sm, padding: spacing.md, borderWidth: 1, borderColor: colors.line, borderRadius: radii.md },
  ministrySelected: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  ministryName: { color: colors.text, fontSize: fontSizes.s14, fontWeight: fontWeights.bold, flexShrink: 1 },
  ministryNameSelected: { color: colors.primary },
  error: { marginTop: spacing.md },
  actions: { flexDirection: "row", flexWrap: "wrap", gap: spacing.md, marginTop: spacing.lg },
  actionCard: { flexGrow: 1, flexBasis: 240, padding: spacing.lg, backgroundColor: colors.surfaceMuted, borderRadius: radii.lg, gap: spacing.sm },
  cardTitle: { color: colors.ink, fontSize: fontSizes.s14, fontWeight: fontWeights.bold },
  compactButton: { alignSelf: "flex-start", flexGrow: 0, marginTop: spacing.xs },
  meta: { color: colors.muted, fontSize: fontSizes.s13, lineHeight: lineHeights.h19 },
  notice: { color: colors.primary, fontSize: fontSizes.s13, marginTop: spacing.md },
  preview: { marginTop: spacing.xl, gap: spacing.sm },
  previewTitle: { color: colors.ink, fontSize: fontSizes.s17, fontWeight: fontWeights.black },
  issue: { color: colors.muted, fontSize: fontSizes.s13, lineHeight: lineHeights.h19 },
  stats: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, marginVertical: spacing.sm },
  stat: { flex: 1, minWidth: 80, padding: spacing.md, borderRadius: radii.md, gap: spacing.xs },
  statNumber: { fontSize: fontSizes.s22, fontWeight: fontWeights.black },
  statLabel: { fontSize: fontSizes.s12, fontWeight: fontWeights.bold },
  filters: { flexDirection: "row", flexWrap: "wrap", gap: spacing.xs },
  filter: { minHeight: 44, justifyContent: "center", paddingHorizontal: spacing.md, borderRadius: radii.md },
  filterActive: { backgroundColor: colors.primarySoft },
  filterLabel: { color: colors.muted, fontSize: fontSizes.s13, fontWeight: fontWeights.bold },
  reviewRow: { paddingVertical: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.line, gap: spacing.xs },
  rowHeading: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: spacing.sm },
  songTitle: { flexGrow: 1, flexShrink: 1, color: colors.ink, fontSize: fontSizes.s14, fontWeight: fontWeights.bold },
  badge: { borderRadius: radii.sm, paddingHorizontal: spacing.sm, paddingVertical: spacing.xs },
  badgeText: { color: colors.text, fontSize: fontSizes.s12, fontWeight: fontWeights.bold },
  reviewFooter: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: spacing.md },
  footerInfo: { flexShrink: 1 },
});
