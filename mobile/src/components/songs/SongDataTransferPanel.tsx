import React, { useEffect, useMemo, useState } from "react";
import { Alert, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { CheckCircle2, Download, Upload } from "lucide-react-native";
import { BottomSheet } from "../BottomSheet";
import { Button, ErrorBanner, LoadingState } from "../ui";
import { musicService, SongTransferDocument, SongTransferPreview } from "../../services/musicService";
import { Ministry } from "../../types";
import { colors, fontSizes, fontWeights, iconSizes, lineHeights, radii, spacing } from "../../theme";

type Props = {
  visible: boolean;
  canImport: boolean;
  canExport: boolean;
  onClose: () => void;
  onImported: (message: string) => void;
};

function summary(preview: SongTransferPreview): string {
  const ready = preview.counts.CREATE + preview.counts.LINK + preview.counts.RESTORE;
  return `${ready} prontas para importar · ${preview.counts.ALREADY_LINKED} já vinculadas · ${preview.counts.CONFLICT} conflitos · ${preview.counts.INVALID} inválidas`;
}

export function SongDataTransferPanel({ visible, canImport, canExport, onClose, onImported }: Props) {
  const [ministries, setMinistries] = useState<Ministry[]>([]);
  const [ministriesLoading, setMinistriesLoading] = useState(false);
  const [ministryId, setMinistryId] = useState<string | null>(null);
  const [document, setDocument] = useState<SongTransferDocument | null>(null);
  const [preview, setPreview] = useState<SongTransferPreview | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const selectedMinistry = useMemo(() => ministries.find((item) => item.id === ministryId) ?? null, [ministries, ministryId]);

  useEffect(() => {
    if (!visible) return;
    setError(null);
    setMinistriesLoading(true);
    void import("../../services/ministryApi")
      .then(({ ministryApi }) => ministryApi.getMinistries())
      .then(setMinistries)
      .catch((reason) => setError(reason instanceof Error ? reason.message : "Não foi possível carregar os ministérios."))
      .finally(() => setMinistriesLoading(false));
  }, [visible]);

  useEffect(() => {
    if (!ministryId && ministries.length === 1) setMinistryId(ministries[0].id);
  }, [ministries, ministryId]);

  const pickAndReview = async () => {
    if (!ministryId) {
      setError("Selecione o ministério que receberá as músicas.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const DocumentPicker = await import("expo-document-picker");
      const result = await DocumentPicker.getDocumentAsync({ type: "application/json", copyToCacheDirectory: true, multiple: false });
      if (result.canceled) return;
      const asset = result.assets[0];
      const raw = asset.file ? await asset.file.text() : await new (await import("expo-file-system")).File(asset.uri).text();
      const parsed = JSON.parse(raw) as SongTransferDocument;
      const nextPreview = await musicService.previewSongData(ministryId, parsed);
      setDocument(parsed);
      setPreview(nextPreview);
    } catch (reason) {
      setDocument(null);
      setPreview(null);
      setError(reason instanceof SyntaxError ? "O arquivo selecionado não é um JSON válido." : reason instanceof Error ? reason.message : "Não foi possível revisar o arquivo.");
    } finally {
      setBusy(false);
    }
  };

  const commit = async () => {
    if (!ministryId || !document || !preview) return;
    setBusy(true);
    setError(null);
    try {
      const result = await musicService.commitSongData(ministryId, document, preview.documentHash);
      onImported(`${result.created} músicas criadas e ${result.linked} vinculadas ao ministério.`);
      setDocument(null);
      setPreview(null);
      onClose();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Não foi possível importar as músicas.");
    } finally {
      setBusy(false);
    }
  };

  const exportData = async () => {
    if (!selectedMinistry) {
      setError("Selecione o ministério que será exportado.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await musicService.exportSongData(selectedMinistry.id, selectedMinistry.name);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Não foi possível exportar as músicas.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <BottomSheet isOpen={visible} onClose={onClose} title="Importar e exportar músicas">
      <Text style={styles.help}>Escolha um ministério. O arquivo transfere somente nome, artista, tom, cifra e o link da cifra quando existir.</Text>
      <Text style={styles.label}>Ministério</Text>
      {ministriesLoading && !ministries.length ? <LoadingState centered={false} message="Carregando ministérios..." /> : (
        <View style={styles.ministries}>
          {ministries.map((ministry) => {
            const selected = ministry.id === ministryId;
            return (
              <TouchableOpacity
                key={ministry.id}
                style={[styles.ministry, selected && styles.ministrySelected]}
                onPress={() => { setMinistryId(ministry.id); setDocument(null); setPreview(null); setError(null); }}
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
          <Button title="Selecionar arquivo para revisar" variant="secondary" icon={<Upload color={colors.primary} size={iconSizes.s19} />} disabled={!ministryId} loading={busy && !preview} onPress={() => void pickAndReview()} />
        ) : null}
        {canExport ? (
          <Button title="Exportar músicas do ministério" variant="secondary" icon={<Download color={colors.primary} size={iconSizes.s19} />} disabled={!ministryId} loading={busy && !preview} onPress={() => void exportData()} />
        ) : null}
      </View>

      {preview ? (
        <View style={styles.preview}>
          <Text style={styles.previewTitle}>Revisão concluída</Text>
          <Text style={styles.previewText}>{summary(preview)}</Text>
          {preview.items.filter((item) => item.reason).slice(0, 8).map((item) => (
            <Text key={`${item.index}-${item.title}`} style={styles.issue}>• {item.title} — {item.reason}</Text>
          ))}
          {preview.items.filter((item) => item.reason).length > 8 ? <Text style={styles.issue}>Outras pendências também permanecerão sem importação.</Text> : null}
          <Button
            title={`Importar ${preview.counts.CREATE + preview.counts.LINK + preview.counts.RESTORE} músicas`}
            disabled={preview.counts.CREATE + preview.counts.LINK + preview.counts.RESTORE === 0}
            loading={busy}
            onPress={() => Alert.alert("Confirmar importação", `Importar as músicas válidas para ${selectedMinistry?.name}?`, [
              { text: "Cancelar", style: "cancel" },
              { text: "Importar", onPress: () => void commit() },
            ])}
          />
        </View>
      ) : null}
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  help: { color: colors.muted, fontSize: fontSizes.s14, lineHeight: lineHeights.h21, marginBottom: spacing.lg },
  label: { color: colors.ink, fontSize: fontSizes.s14, fontWeight: fontWeights.extrabold, marginBottom: spacing.sm },
  ministries: { gap: spacing.sm },
  ministry: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: spacing.md, borderWidth: 1, borderColor: colors.line, borderRadius: radii.md },
  ministrySelected: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  ministryName: { color: colors.text, fontSize: fontSizes.s14, fontWeight: fontWeights.bold },
  ministryNameSelected: { color: colors.primary },
  error: { marginTop: spacing.md },
  actions: { gap: spacing.sm, marginTop: spacing.lg },
  preview: { marginTop: spacing.xl, padding: spacing.lg, borderWidth: 1, borderColor: colors.line, borderRadius: radii.lg, gap: spacing.sm },
  previewTitle: { color: colors.ink, fontSize: fontSizes.s17, fontWeight: fontWeights.black },
  previewText: { color: colors.text, fontSize: fontSizes.s14, marginBottom: spacing.sm },
  issue: { color: colors.muted, fontSize: fontSizes.s13, lineHeight: lineHeights.h19 },
});
