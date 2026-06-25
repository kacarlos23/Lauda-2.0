import { useMemo, useState } from "react";
import { Alert, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { useNavigation, useRouter } from "expo-router";
import { usePreventRemove } from "@react-navigation/native";
import { ArtistPicker } from "./ArtistPicker";
import { AppBackButton } from "./AppBackButton";
import { Artist, MUSICAL_KEYS, MusicalKey, Song } from "../types";
import { SongPayload } from "../services/musicService";
import { colors, radii, screen, shadow, spacing } from "../theme";

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
  const [title, setTitle] = useState(initial?.title ?? "");
  const [composer, setComposer] = useState(initial?.composer ?? "");
  const [originalKey, setOriginalKey] = useState<MusicalKey>(initial?.originalKey ?? "C");
  const [content, setContent] = useState(initial?.content ?? "");
  const [bpm, setBpm] = useState(initial?.bpm?.toString() ?? "");
  const [submitted, setSubmitted] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const currentSnapshot = useMemo(() => JSON.stringify({ artistId: artist?.id, title, composer, originalKey, content, bpm }), [artist?.id, title, composer, originalKey, content, bpm]);
  const initialSnapshot = useMemo(() => JSON.stringify({ artistId: initial?.artistId, title: initial?.title ?? "", composer: initial?.composer ?? "", originalKey: initial?.originalKey ?? "C", content: initial?.content ?? "", bpm: initial?.bpm?.toString() ?? "" }), [initial]);
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
    return null;
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
      const songId = await onSave({ title: title.trim(), artistId: artist.id, composer: composer.trim() || null, originalKey, content, bpm: bpm ? Number(bpm) : null });
      setSubmitted(true);
      setTimeout(() => router.replace(`/songs/${songId}` as never), 0);
    } catch { /* Store error is rendered without clearing the form. */ }
  };

  return (
    <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      <View style={styles.backRow}><AppBackButton href={backHref} /></View>
      <View style={styles.progress}><View style={[styles.progressBar, { width: step === 1 ? "50%" : "100%" }]} /></View>
      <Text style={styles.stepLabel}>Etapa {step} de 2</Text>
      {formError || error ? <Text style={styles.error}>{formError ?? error}</Text> : null}

      {step === 1 ? (
        <View style={styles.card}>
          <Text style={styles.title}>Dados da música</Text>
          <ArtistPicker selected={artist} onSelect={setArtist} />
          <Text style={styles.label}>Nome da música *</Text>
          <TextInput style={styles.input} value={title} onChangeText={setTitle} placeholder="Ex: Grande é o Senhor" placeholderTextColor={colors.muted} testID="song-title-input" />
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
          <TouchableOpacity style={styles.primaryButton} onPress={next} testID="song-next-button"><Text style={styles.primaryText}>Continuar para a cifra</Text></TouchableOpacity>
        </View>
      ) : (
        <View style={styles.card}>
          <View style={styles.summary}>
            <View style={{ flex: 1 }}><Text style={styles.title}>{title}</Text><Text style={styles.meta}>{artist?.name} · Tom {originalKey}{bpm ? ` · ${bpm} BPM` : ""}</Text></View>
            <TouchableOpacity onPress={() => setStep(1)}><Text style={styles.editLink}>Editar dados</Text></TouchableOpacity>
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

const styles = StyleSheet.create({
  container: { width: "100%", maxWidth: screen.maxWidth, alignSelf: "center", padding: spacing.xl, paddingBottom: 80 },
  backRow: { marginBottom: spacing.lg },
  progress: { height: 5, borderRadius: radii.pill, backgroundColor: colors.line, overflow: "hidden", marginBottom: spacing.sm },
  progressBar: { height: "100%", backgroundColor: colors.primary },
  stepLabel: { color: colors.muted, fontSize: 12, fontWeight: "800", marginBottom: spacing.lg },
  card: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, borderRadius: radii.lg, padding: spacing.lg, ...shadow },
  title: { color: colors.ink, fontSize: 21, fontWeight: "800", marginBottom: spacing.lg },
  label: { color: colors.text, fontSize: 13, fontWeight: "800", marginTop: spacing.lg, marginBottom: spacing.sm },
  input: { minHeight: 48, borderWidth: 1, borderColor: colors.line, borderRadius: radii.sm, backgroundColor: colors.surfaceMuted, color: colors.ink, paddingHorizontal: spacing.md, fontSize: 15 },
  keyGrid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  key: { minWidth: 45, height: 38, borderWidth: 1, borderColor: colors.line, borderRadius: radii.sm, backgroundColor: colors.surfaceMuted, alignItems: "center", justifyContent: "center" },
  keyActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  keyText: { color: colors.text, fontSize: 13, fontWeight: "800" },
  keyTextActive: { color: colors.surface },
  primaryButton: { minHeight: 48, marginTop: spacing.xl, borderRadius: radii.sm, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center", paddingHorizontal: spacing.lg },
  primaryText: { color: colors.surface, fontSize: 14, fontWeight: "800" },
  disabled: { opacity: 0.65 },
  error: { color: colors.danger, fontSize: 13, fontWeight: "700", backgroundColor: "#FDECEC", padding: spacing.md, borderRadius: radii.sm, marginBottom: spacing.md },
  summary: { flexDirection: "row", alignItems: "flex-start", gap: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.line, paddingBottom: spacing.md },
  meta: { color: colors.muted, fontSize: 13, fontWeight: "600", marginTop: -spacing.md },
  editLink: { color: colors.primary, fontSize: 13, fontWeight: "800" },
  editor: { minHeight: 420, borderWidth: 1, borderColor: colors.line, borderRadius: radii.sm, backgroundColor: colors.surfaceMuted, color: colors.ink, padding: spacing.md, fontSize: 14, lineHeight: 21, fontFamily: Platform.select({ ios: "Menlo", android: "monospace", web: "monospace" }) },
});
