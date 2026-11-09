import React, { useRef, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { SONG_TAG_NAME_MAX, SONG_TAGS_MAX, sortSongTagNames } from "../../../../src/constants/songTags";
import { cleanCatalogText, normalizeCatalogText } from "../../../../src/utils/catalogNormalization";
import { musicService, SongThemeChange } from "../../services/musicService";
import { colors, fontSizes, radiusValues, spacing } from "../../theme";
import { Song } from "../../types";
import { Button } from "../ui";
import { InputControl } from "../ui/InputControl";
import { SongThemeAnchor, SongThemeChecklist, SongThemeMenu, songThemeOptions } from "./SongThemeMenu";

type Props = {
  song: Song;
  anchor: SongThemeAnchor | null;
  knownNames: string[];
  onClose: () => void;
  onPreview: (change: SongThemeChange | null) => void;
  onSaved: (change: SongThemeChange) => void;
  onError: (message: string) => void;
};

export function SongQuickThemeEditor({ song, anchor, knownNames, onClose, onPreview, onSaved, onError }: Props) {
  const [tags, setTags] = useState(song.tags ?? []);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  const checked = new Set(tags.map(normalizeCatalogText));
  const options = songThemeOptions([...knownNames, ...tags]);

  const change = async (raw: string, creating = false) => {
    if (savingRef.current) return;
    const name = cleanCatalogText(raw);
    const key = normalizeCatalogText(name);
    if (!/[^\p{Cc}\p{Cf}\s]/u.test(name)) {
      setError("Informe o nome do tema.");
      return;
    }
    if (name.includes(",") || name.length > SONG_TAG_NAME_MAX) {
      setError("Use até 40 caracteres e evite vírgulas no nome do tema.");
      return;
    }
    const alreadyChecked = checked.has(key);
    if (creating && alreadyChecked) {
      setDraft("");
      setError(null);
      return;
    }
    if (!alreadyChecked && tags.length >= SONG_TAGS_MAX) {
      setError(`Uma música pode ter no máximo ${SONG_TAGS_MAX} temas.`);
      return;
    }

    const operation = alreadyChecked ? "remove" : "add";
    const next = alreadyChecked
      ? tags.filter((tag) => normalizeCatalogText(tag) !== key)
      : sortSongTagNames([...tags, name]);
    savingRef.current = true;
    setSaving(true);
    setError(null);
    setTags(next);
    onPreview({ id: song.id, tags: next });
    try {
      const saved = await musicService.changeSongTheme(song.id, operation, name);
      setTags(saved.tags);
      onSaved(saved);
      if (creating) setDraft("");
    } catch (reason) {
      setTags(tags);
      const message = reason instanceof Error ? reason.message : "Não foi possível salvar o tema.";
      setError(message);
      onError(message);
    } finally {
      onPreview(null);
      savingRef.current = false;
      setSaving(false);
    }
  };

  const footer = (
    <View style={styles.footer}>
      {error ? <Text style={styles.error} accessibilityRole="alert">{error}</Text> : null}
      <View style={styles.createRow}>
        <InputControl
          accessibilityLabel="Criar tema"
          placeholder="Criar tema…"
          value={draft}
          editable={!saving}
          embedded
          style={styles.input}
          autoCorrect={false}
          maxLength={SONG_TAG_NAME_MAX}
          onChangeText={(value) => { setDraft(value); setError(null); }}
          onSubmitEditing={() => void change(draft, true)}
          returnKeyType="done"
        />
        <Button
          title="Adicionar"
          variant="secondary"
          size="sm"
          style={styles.button}
          disabled={saving || !draft.trim()}
          onPress={() => void change(draft, true)}
        />
      </View>
    </View>
  );

  return (
    <SongThemeMenu title="Temas" note="salva na hora" anchor={anchor} footer={footer} onClose={onClose}>
      <SongThemeChecklist options={options} checked={checked} disabled={saving} onToggle={(name) => void change(name)} />
    </SongThemeMenu>
  );
}

const styles = StyleSheet.create({
  footer: { gap: spacing.xs },
  createRow: { flexDirection: "row", alignItems: "stretch", gap: spacing.xs },
  input: {
    flex: 1, minWidth: 0, fontSize: fontSizes.s13,
    borderWidth: 1, borderColor: colors.lineStrong, borderRadius: radiusValues.r4, paddingHorizontal: spacing.sm,
  },
  button: { minHeight: 34, borderRadius: radiusValues.r4, paddingHorizontal: spacing.sm },
  error: { color: colors.danger, fontSize: fontSizes.s12 },
});
