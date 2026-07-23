import React, { useMemo, useState } from "react";
import { ActivityIndicator, Alert, Modal, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { useNavigation, useRouter } from "expo-router";
import { usePreventRemove } from "@react-navigation/native";
import { ArtistPicker } from "./ArtistPicker";
import { AppBackButton } from "./AppBackButton";
import { Artist, MUSICAL_KEYS, MusicalKey, Song } from "../types";
import { CifraClubImportResult, CifraClubSearchResult, musicService, SongPayload } from "../services/musicService";
import { colors, radii, screen, shadow, spacing } from "../theme";
import { RichCommentEditor } from "./ui/RichCommentEditor";

type Props = {
  initial?: Song;
  saving: boolean;
  error?: string | null;
  onSave: (payload: SongPayload) => Promise<string>;
  backHref: string;
};

export function SongForm({ initial, saving, error, onSave, backHref }: Props) {
  const navigation = useNavigation();
  const router = useRouter();
  const [step, setStep] = useState<1 | 2>(initial ? 2 : 1);
  const [artist, setArtist] = useState<Artist | null>(initial ? { ...initial.artist, createdAt: "", updatedAt: "" } : null);
  const [artistQuery, setArtistQuery] = useState(initial?.artist.name ?? "");
  const [title, setTitle] = useState(initial?.title ?? "");
  const [composer, setComposer] = useState(initial?.composer ?? "");
  const [originalKey, setOriginalKey] = useState<MusicalKey>(initial?.originalKey ?? "C");
  const [content, setContent] = useState(initial?.content ?? "");
  const [bpm, setBpm] = useState(initial?.bpm?.toString() ?? "");
  const [cifraUrl, setCifraUrl] = useState(initial?.cifraUrl ?? "");
  const [letraUrl, setLetraUrl] = useState(initial?.letraUrl ?? "");
  const [audioUrl, setAudioUrl] = useState(initial?.audioUrl ?? "");
  const [videoUrl, setVideoUrl] = useState(initial?.videoUrl ?? "");
  const [comments, setComments] = useState(initial?.comments ?? "");
  const [submitted, setSubmitted] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [cifraClubModalVisible, setCifraClubModalVisible] = useState(false);
  const [cifraClubLoading, setCifraClubLoading] = useState(false);
  const [cifraClubImporting, setCifraClubImporting] = useState(false);
  const [cifraClubError, setCifraClubError] = useState<string | null>(null);
  const [cifraClubResults, setCifraClubResults] = useState<CifraClubSearchResult[]>([]);
  const [cifraClubPreview, setCifraClubPreview] = useState<CifraClubImportResult | null>(null);

  const currentSnapshot = useMemo(() => JSON.stringify({ artistId: artist?.id, title, composer, originalKey, content, bpm, cifraUrl, letraUrl, audioUrl, videoUrl, comments }), [artist?.id, title, composer, originalKey, content, bpm, cifraUrl, letraUrl, audioUrl, videoUrl, comments]);
  const initialSnapshot = useMemo(() => JSON.stringify({
    artistId: initial?.artistId,
    title: initial?.title ?? "",
    composer: initial?.composer ?? "",
    originalKey: initial?.originalKey ?? "C",
    content: initial?.content ?? "",
    bpm: initial?.bpm?.toString() ?? "",
    cifraUrl: initial?.cifraUrl ?? "",
    letraUrl: initial?.letraUrl ?? "",
    audioUrl: initial?.audioUrl ?? "",
    videoUrl: initial?.videoUrl ?? "",
    comments: initial?.comments ?? "",
  }), [initial]);
  const dirty = currentSnapshot !== initialSnapshot;

  usePreventRemove(dirty && !submitted, ({ data }) => {
    Alert.alert("Descartar alterações?", "As alterações ainda não foram salvas.", [
      { text: "Continuar editando", style: "cancel" },
      { text: "Descartar", style: "destructive", onPress: () => navigation.dispatch(data.action) },
    ]);
  });

  const validateMetadata = () => {
    if (!artist) return "Selecione ou crie um artista.";
    if (!title.trim()) return "Informe o nome da música.";
    if (bpm && (!/^\d+$/.test(bpm) || Number(bpm) < 30 || Number(bpm) > 300)) return "Informe um BPM entre 30 e 300.";
    const invalidLink = [
      ["Cifra", cifraUrl],
      ["Letra", letraUrl],
      ["Áudio", audioUrl],
      ["Vídeo", videoUrl],
    ].find(([, url]) => typeof url === "string" && url.trim() && !isValidExternalLink(url));
    if (invalidLink) return `Informe uma URL válida para ${invalidLink[0]}, começando com http:// ou https://.`;
    return null;
  };

  const normalizeLink = (value: string) => value.trim() || null;

  const closeCifraClubModal = () => {
    if (cifraClubLoading || cifraClubImporting) return;
    setCifraClubModalVisible(false);
    setCifraClubError(null);
    setCifraClubPreview(null);
  };

  const searchCifraClub = async () => {
    const searchedArtist = artistQuery.trim() || artist?.name.trim() || "";
    const searchedTitle = title.trim();
    if (!searchedArtist && !searchedTitle) {
      setFormError("Informe o artista ou o nome da música antes de buscar no Cifra Club.");
      return;
    }

    try {
      setFormError(null);
      setCifraClubError(null);
      setCifraClubPreview(null);
      setCifraClubLoading(true);
      setCifraClubModalVisible(true);
      const results = await musicService.searchCifraClub({
        ...(searchedArtist ? { artist: searchedArtist } : {}),
        ...(searchedTitle ? { title: searchedTitle } : {}),
      });
      setCifraClubResults(results);
      if (!results.length) setCifraClubError("Nenhuma cifra encontrada para esta música.");
    } catch (reason) {
      setCifraClubResults([]);
      setCifraClubError(reason instanceof Error ? reason.message : "Não foi possível buscar no Cifra Club.");
    } finally {
      setCifraClubLoading(false);
    }
  };

  const importCifraClubResult = async (result: CifraClubSearchResult) => {
    try {
      setCifraClubError(null);
      setCifraClubImporting(true);
      setCifraClubPreview(await musicService.importCifraClub(result.url));
    } catch (reason) {
      setCifraClubError(reason instanceof Error ? reason.message : "Não foi possível importar a cifra.");
    } finally {
      setCifraClubImporting(false);
    }
  };

  const resolveImportedArtist = async (name: string): Promise<Artist> => {
    if (artist && normalizeCatalogName(artist.name) === normalizeCatalogName(name)) return artist;

    const findExact = async () => {
      const matches = (await musicService.listArtists(name, 1, 100)).items;
      return matches.find((candidate) => normalizeCatalogName(candidate.name) === normalizeCatalogName(name)) ?? null;
    };
    const existing = await findExact();
    if (existing) return existing;

    try {
      return await musicService.createArtist({ name });
    } catch (reason) {
      const concurrent = await findExact().catch(() => null);
      if (concurrent) return concurrent;
      throw reason;
    }
  };

  const applyCifraClubPreview = () => {
    if (!cifraClubPreview) return;

    const preview = cifraClubPreview;
    const apply = async () => {
      setCifraClubImporting(true);
      setCifraClubError(null);
      try {
        const importedArtist = await resolveImportedArtist(preview.artist);
        setArtist(importedArtist);
        setArtistQuery(importedArtist.name);
        setTitle(preview.title);
        setOriginalKey(preview.originalKey);
        setCifraUrl(preview.cifraUrl);
        setContent(preview.content);
        setStep(2);
        setCifraClubModalVisible(false);
        setCifraClubPreview(null);
      } catch (reason) {
        setCifraClubError(reason instanceof Error ? reason.message : "Não foi possível vincular o artista importado.");
      } finally {
        setCifraClubImporting(false);
      }
    };

    const hasExistingData = Boolean(content.trim() || cifraUrl.trim());
    if (!hasExistingData) {
      void apply();
      return;
    }

    Alert.alert(
      "Substituir dados da cifra?",
      "A cifra ou o link da cifra já estão preenchidos. Deseja substituir pelos dados importados?",
      [
        { text: "Cancelar", style: "cancel" },
        { text: "Substituir", style: "destructive", onPress: () => void apply() },
      ]
    );
  };

  const next = () => {
    const validation = validateMetadata();
    setFormError(validation);
    if (!validation) setStep(2);
  };

  const save = async () => {
    const validation = validateMetadata() ?? (!content ? "Digite a cifra da música." : null);
    setFormError(validation);
    if (validation || !artist) return;
    try {
      const songId = await onSave({
        title: title.trim(),
        artistId: artist.id,
        composer: composer.trim() || null,
        originalKey,
        content,
        bpm: bpm ? Number(bpm) : null,
        cifraUrl: normalizeLink(cifraUrl),
        letraUrl: normalizeLink(letraUrl),
        audioUrl: normalizeLink(audioUrl),
        videoUrl: normalizeLink(videoUrl),
        comments: comments || null,
      });
      setSubmitted(true);
      setTimeout(() => router.replace(`/songs/${songId}` as never), 0);
    } catch { /* Store error is rendered without clearing the form. */ }
  };

  return (
    <ScrollView contentContainerStyle={[styles.container, step === 2 && styles.editorContainer]} keyboardShouldPersistTaps="handled">
      <Modal visible={cifraClubModalVisible} transparent animationType="fade" onRequestClose={closeCifraClubModal}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.modalTitle}>Importar do Cifra Club</Text>
                <Text style={styles.modalSubtitle}>{[artistQuery.trim(), title.trim()].filter(Boolean).join(" · ")}</Text>
              </View>
              <TouchableOpacity style={styles.modalClose} onPress={closeCifraClubModal} accessibilityRole="button" accessibilityLabel="Fechar importação do Cifra Club">
                <Text style={styles.modalCloseText}>X</Text>
              </TouchableOpacity>
            </View>

            {cifraClubError ? <Text style={styles.error}>{cifraClubError}</Text> : null}
            {cifraClubLoading ? <ActivityIndicator color={colors.primary} style={styles.modalLoader} /> : null}

            {!cifraClubLoading && !cifraClubPreview ? (
              <ScrollView style={styles.modalList} contentContainerStyle={styles.modalListContent}>
                {cifraClubResults.map((result) => (
                  <TouchableOpacity
                    key={result.url}
                    style={styles.resultCard}
                    onPress={() => void importCifraClubResult(result)}
                    disabled={cifraClubImporting}
                    accessibilityRole="button"
                    accessibilityLabel={`Importar ${result.title} de ${result.artist}`}
                  >
                    <Text style={styles.resultTitle}>{result.title}</Text>
                    <Text style={styles.resultMeta}>{result.artist}{result.originalKey ? ` · Tom ${result.originalKey}` : ""}</Text>
                    <Text style={styles.resultUrl} numberOfLines={1}>{result.url}</Text>
                  </TouchableOpacity>
                ))}
                {cifraClubImporting ? <ActivityIndicator color={colors.primary} style={styles.modalLoader} /> : null}
              </ScrollView>
            ) : null}

            {cifraClubPreview ? (
              <View>
                <Text style={styles.resultTitle}>{cifraClubPreview.title}</Text>
                <Text style={styles.resultMeta}>{cifraClubPreview.artist} · Tom {cifraClubPreview.originalKey}</Text>
                <Text style={styles.resultUrl} numberOfLines={1}>{cifraClubPreview.cifraUrl}</Text>
                <Text style={styles.previewLabel}>Prévia da cifra</Text>
                <Text style={styles.previewText}>
                  {cifraClubPreview.content.split(/\r?\n/).slice(0, 12).join("\n")}
                </Text>
                <View style={styles.modalActions}>
                  <TouchableOpacity style={styles.secondaryButton} onPress={() => setCifraClubPreview(null)} accessibilityRole="button">
                    <Text style={styles.secondaryButtonText}>Voltar</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.primarySmallButton, cifraClubImporting && styles.disabled]} onPress={applyCifraClubPreview} accessibilityRole="button" disabled={cifraClubImporting}>
                    {cifraClubImporting ? <ActivityIndicator color={colors.surface} size="small" /> : null}
                    <Text style={styles.primaryText}>{cifraClubImporting ? "Aplicando..." : "Usar esta cifra"}</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : null}
          </View>
        </View>
      </Modal>
      <View style={styles.backRow}><AppBackButton href={backHref} /></View>
      <View style={styles.progress}><View style={[styles.progressBar, { width: step === 1 ? "50%" : "100%" }]} /></View>
      <Text style={styles.stepLabel}>Etapa {step} de 2</Text>
      {formError || error ? <Text style={styles.error}>{formError ?? error}</Text> : null}

      {step === 1 ? (
        <View style={styles.card}>
          <Text style={styles.title}>Dados da música</Text>
          <ArtistPicker selected={artist} onSelect={setArtist} onQueryChange={setArtistQuery} />
          <Text style={styles.label}>Nome da música *</Text>
          <TextInput style={styles.input} value={title} onChangeText={setTitle} placeholder="Ex: Grande é o Senhor" placeholderTextColor={colors.muted} testID="song-title-input" />
          <TouchableOpacity
            style={[styles.importButton, cifraClubLoading && styles.disabled]}
            onPress={() => void searchCifraClub()}
            accessibilityRole="button"
            disabled={cifraClubLoading}
            testID="song-cifra-club-search-button"
          >
            <Text style={styles.importButtonText}>{cifraClubLoading ? "Buscando..." : "Buscar no Cifra Club"}</Text>
          </TouchableOpacity>
          <Text style={styles.label}>Compositor</Text>
          <TextInput style={styles.input} value={composer} onChangeText={setComposer} placeholder="Opcional" placeholderTextColor={colors.muted} testID="song-composer-input" />
          <Text style={styles.label}>Tom *</Text>
          <View style={styles.keyGrid}>
            {MUSICAL_KEYS.map((key) => (
              <TouchableOpacity key={key} style={[styles.key, originalKey === key && styles.keyActive]} onPress={() => setOriginalKey(key)} testID={`song-key-${key}`}>
                <Text style={[styles.keyText, originalKey === key && styles.keyTextActive]}>{key}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <Text style={styles.label}>BPM</Text>
          <TextInput style={styles.input} value={bpm} onChangeText={setBpm} placeholder="Opcional (30 a 300)" placeholderTextColor={colors.muted} keyboardType="number-pad" testID="song-bpm-input" />
          <Text style={styles.sectionTitle}>Links externos</Text>
          <Text style={styles.helperText}>Adicione links opcionais de cifra, letra, áudio e vídeo.</Text>
          <Text style={styles.label}>Cifra</Text>
          <TextInput style={styles.input} value={cifraUrl} onChangeText={setCifraUrl} placeholder="https://..." placeholderTextColor={colors.muted} autoCapitalize="none" autoCorrect={false} keyboardType="url" testID="song-cifra-url-input" />
          <Text style={styles.label}>Letra</Text>
          <TextInput style={styles.input} value={letraUrl} onChangeText={setLetraUrl} placeholder="https://..." placeholderTextColor={colors.muted} autoCapitalize="none" autoCorrect={false} keyboardType="url" testID="song-letra-url-input" />
          <Text style={styles.label}>Áudio</Text>
          <TextInput style={styles.input} value={audioUrl} onChangeText={setAudioUrl} placeholder="https://..." placeholderTextColor={colors.muted} autoCapitalize="none" autoCorrect={false} keyboardType="url" testID="song-audio-url-input" />
          <Text style={styles.label}>Vídeo</Text>
          <TextInput style={styles.input} value={videoUrl} onChangeText={setVideoUrl} placeholder="https://..." placeholderTextColor={colors.muted} autoCapitalize="none" autoCorrect={false} keyboardType="url" testID="song-video-url-input" />
          <View style={styles.commentsEditor}><RichCommentEditor value={comments} onChange={setComments} label="Comentários" placeholder="Observações sobre a música, execução ou repertório..." testID="song-comments-input" /></View>
          <TouchableOpacity style={styles.primaryButton} onPress={next} testID="song-next-button"><Text style={styles.primaryText}>Continuar para a cifra</Text></TouchableOpacity>
        </View>
      ) : (
        <View style={styles.card}>
          <View style={styles.summary}>
            <View style={{ flex: 1 }}><Text style={styles.title}>{title}</Text><Text style={styles.meta}>{artist?.name} · Tom {originalKey}{bpm ? ` · ${bpm} BPM` : ""}</Text></View>
            <TouchableOpacity onPress={() => setStep(1)} testID="song-edit-metadata-button"><Text style={styles.editLink}>Editar dados</Text></TouchableOpacity>
          </View>
          <Text style={styles.label}>Cifra *</Text>
          <TextInput
            style={styles.editor}
            value={content}
            onChangeText={setContent}
            placeholder={"Use ChordPro: [G]Grande é o [D]Senhor"}
            placeholderTextColor={colors.muted}
            multiline
            textAlignVertical="top"
            autoCorrect={false}
            autoCapitalize="none"
            testID="song-chord-input"
          />
          <TouchableOpacity style={[styles.primaryButton, saving && styles.disabled]} onPress={() => void save()} disabled={saving} testID="song-save-button">
            <Text style={styles.primaryText}>{saving ? "Salvando..." : "Salvar música"}</Text>
          </TouchableOpacity>
        </View>
      )}
    </ScrollView>
  );
}

function normalizeCatalogName(value: string): string {
  return value.normalize("NFD").replace(/\p{Diacritic}/gu, "").trim().replace(/\s+/g, " ").toLocaleLowerCase("pt-BR");
}

function isValidExternalLink(value: string): boolean {
  try {
    const url = new URL(value.trim());
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

const styles = StyleSheet.create({
  container: { width: "100%", maxWidth: screen.formMaxWidth, alignSelf: "center", padding: spacing.xl, paddingBottom: screen.contentBottomPadding },
  editorContainer: { width: "100%", maxWidth: "100%" },
  backRow: { marginBottom: spacing.md },
  progress: { height: 4, borderRadius: radii.sm, backgroundColor: colors.line, overflow: "hidden", marginBottom: spacing.sm },
  progressBar: { height: "100%", backgroundColor: colors.accent },
  stepLabel: { color: colors.muted, fontSize: 12, fontWeight: "800", letterSpacing: 0.8, textTransform: "uppercase", marginBottom: spacing.lg },
  card: { backgroundColor: "transparent", borderTopWidth: 1, borderBottomWidth: 1, borderColor: colors.line, paddingVertical: spacing.lg },
  title: { color: colors.ink, fontSize: 22, fontWeight: "900", marginBottom: spacing.md },
  label: { color: colors.text, fontSize: 13, fontWeight: "800", marginTop: spacing.md, marginBottom: spacing.sm },
  commentsEditor: { marginTop: spacing.md },
  input: { minHeight: 44, borderWidth: 1, borderColor: colors.line, borderRadius: radii.md, backgroundColor: colors.surface, color: colors.ink, paddingHorizontal: spacing.md, fontSize: 15 },
  keyGrid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  key: { minWidth: 45, height: 40, borderWidth: 1, borderColor: colors.line, borderRadius: radii.md, backgroundColor: colors.surfaceMuted, alignItems: "center", justifyContent: "center" },
  keyActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  keyText: { color: colors.text, fontSize: 13, fontWeight: "800" },
  keyTextActive: { color: colors.surface },
  importButton: { minHeight: 44, marginTop: spacing.sm, borderRadius: radii.md, backgroundColor: colors.primarySoft, borderWidth: 1, borderColor: colors.line, alignItems: "center", justifyContent: "center", paddingHorizontal: spacing.lg },
  importButtonText: { color: colors.primary, fontSize: 13, fontWeight: "900" },
  sectionTitle: { color: colors.ink, fontSize: 18, fontWeight: "900", marginTop: spacing.xl, paddingTop: spacing.lg, borderTopWidth: 1, borderTopColor: colors.line, marginBottom: spacing.xs },
  helperText: { color: colors.muted, fontSize: 13, lineHeight: 19 },
  primaryButton: { minHeight: 44, marginTop: spacing.xl, borderRadius: radii.md, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center", paddingHorizontal: spacing.lg },
  primaryText: { color: colors.surface, fontSize: 14, fontWeight: "900" },
  disabled: { opacity: 0.65 },
  error: { color: colors.danger, fontSize: 13, fontWeight: "800", backgroundColor: colors.dangerSoft, padding: spacing.md, borderRadius: radii.md, marginBottom: spacing.md },
  summary: { flexDirection: "row", alignItems: "flex-start", gap: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.line, paddingBottom: spacing.md },
  meta: { color: colors.muted, fontSize: 13, fontWeight: "600", marginTop: -spacing.md },
  editLink: { color: colors.primary, fontSize: 13, fontWeight: "800" },
  editor: { minHeight: 496, borderWidth: 1, borderColor: colors.line, borderRadius: radii.md, backgroundColor: colors.surface, color: colors.ink, padding: spacing.md, fontSize: 14, lineHeight: 21, fontFamily: Platform.select({ ios: "Menlo", android: "monospace", web: "monospace" }) },
  modalBackdrop: { flex: 1, backgroundColor: "rgba(16, 32, 26, 0.46)", alignItems: "center", justifyContent: "center", padding: spacing.lg },
  modalCard: { width: "100%", maxWidth: 680, maxHeight: "90%", backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, borderRadius: radii.lg, padding: spacing.lg, ...shadow },
  modalHeader: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: spacing.md, marginBottom: spacing.lg },
  modalTitle: { color: colors.ink, fontSize: 20, fontWeight: "900", marginBottom: spacing.xs },
  modalSubtitle: { color: colors.muted, fontSize: 13, fontWeight: "700" },
  modalClose: { width: 38, height: 38, borderRadius: radii.pill, backgroundColor: colors.surfaceMuted, alignItems: "center", justifyContent: "center" },
  modalCloseText: { color: colors.text, fontSize: 24, fontWeight: "700", lineHeight: 28 },
  modalLoader: { marginVertical: spacing.lg },
  modalList: { maxHeight: 420 },
  modalListContent: { gap: spacing.sm },
  resultCard: { borderBottomWidth: 1, borderBottomColor: colors.line, backgroundColor: colors.surface, paddingVertical: spacing.md },
  resultTitle: { color: colors.ink, fontSize: 16, fontWeight: "900", marginBottom: spacing.xs },
  resultMeta: { color: colors.primary, fontSize: 13, fontWeight: "800", marginBottom: spacing.xs },
  resultUrl: { color: colors.muted, fontSize: 12, fontWeight: "600" },
  previewLabel: { color: colors.text, fontSize: 13, fontWeight: "900", marginTop: spacing.lg, marginBottom: spacing.sm },
  previewText: { maxHeight: 260, borderWidth: 1, borderColor: colors.line, borderRadius: radii.md, backgroundColor: colors.surfaceMuted, color: colors.ink, padding: spacing.md, fontSize: 13, lineHeight: 19, fontFamily: Platform.select({ ios: "Menlo", android: "monospace", web: "monospace" }) },
  modalActions: { flexDirection: "row", justifyContent: "flex-end", gap: spacing.sm, marginTop: spacing.lg, flexWrap: "wrap" },
  secondaryButton: { minHeight: 44, borderRadius: radii.md, backgroundColor: colors.surfaceMuted, alignItems: "center", justifyContent: "center", paddingHorizontal: spacing.lg },
  secondaryButtonText: { color: colors.text, fontSize: 13, fontWeight: "900" },
  primarySmallButton: { minHeight: 44, borderRadius: radii.md, backgroundColor: colors.primary, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm, paddingHorizontal: spacing.lg },
});
