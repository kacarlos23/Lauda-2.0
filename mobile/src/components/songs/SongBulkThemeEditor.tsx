import React, { useRef, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { SONG_TAGS_MAX } from "../../../../src/constants/songTags";
import { normalizeCatalogText } from "../../../../src/utils/catalogNormalization";
import { musicService, SongTagOption, SongThemeBatchResult, SongThemeOperation } from "../../services/musicService";
import { colors, fontSizes, radiusValues, spacing } from "../../theme";
import { Button } from "../ui";
import { SongThemeAnchor, SongThemeChecklist, SongThemeMenu, songThemeOptions } from "./SongThemeMenu";

type Props = {
  songIds: string[];
  operation: SongThemeOperation;
  anchor: SongThemeAnchor | null;
  knownTags: SongTagOption[];
  onSaved: (result: SongThemeBatchResult) => void;
  onClose: () => void;
};

export function SongBulkThemeEditor({ songIds, operation, anchor, knownTags, onSaved, onClose }: Props) {
  const [checked, setChecked] = useState<Set<string>>(() => new Set());
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  const byName = new Map(knownTags.map((tag) => [normalizeCatalogText(tag.name), tag.id]));
  const options = songThemeOptions(knownTags.map((tag) => tag.name))
    .filter((name) => operation === "add" || byName.has(normalizeCatalogText(name)));
  const title = operation === "add" ? "Adicionar tema" : "Remover tema";
  const count = songIds.length;
  const note = `${count} ${count === 1 ? "música" : "músicas"}`;

  const toggle = (name: string) => {
    const key = normalizeCatalogText(name);
    const next = new Set(checked);
    if (next.has(key)) {
      next.delete(key);
    } else if (next.size < SONG_TAGS_MAX) {
      next.add(key);
    } else {
      setError(`Selecione no máximo ${SONG_TAGS_MAX} temas.`);
      return;
    }
    setChecked(next);
    setError(null);
  };

  const apply = async () => {
    if (!checked.size || savingRef.current) return;
    const tagIds: string[] = [];
    const newTags: string[] = [];
    for (const name of options) {
      const key = normalizeCatalogText(name);
      if (!checked.has(key)) continue;
      const id = byName.get(key);
      if (id) tagIds.push(id);
      else newTags.push(name);
    }

    savingRef.current = true;
    setSaving(true);
    setError(null);
    try {
      onSaved(await musicService.changeSongThemes(songIds, operation, tagIds, newTags));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Não foi possível aplicar os temas.");
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };

  return (
    <SongThemeMenu
      title={title}
      note={note}
      anchor={anchor}
      onClose={() => { if (!savingRef.current) onClose(); }}
      footer={(
        <View style={styles.footer}>
          {error ? <Text style={styles.error} accessibilityRole="alert">{error}</Text> : null}
          <Button title="Aplicar" size="sm" loading={saving} disabled={!checked.size} onPress={() => void apply()} style={styles.button} />
        </View>
      )}
    >
      {options.length ? (
        <SongThemeChecklist options={options} checked={checked} disabled={saving} onToggle={toggle} />
      ) : (
        <Text style={styles.empty}>Nenhum tema cadastrado.</Text>
      )}
    </SongThemeMenu>
  );
}

const styles = StyleSheet.create({
  footer: { gap: spacing.xs },
  button: { minHeight: 34, borderRadius: radiusValues.r4 },
  error: { color: colors.danger, fontSize: fontSizes.s12 },
  empty: { padding: spacing.md, color: colors.muted, fontSize: fontSizes.s13 },
});
