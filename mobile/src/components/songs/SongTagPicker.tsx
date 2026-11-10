import React, { useMemo, useRef, useState } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SUGGESTED_SONG_TAGS, SONG_TAG_NAME_MAX, SONG_TAGS_MAX } from "../../../../src/constants/songTags";
import { cleanCatalogText, normalizeCatalogText } from "../../../../src/utils/catalogNormalization";
import { Chip } from "../ui/Chip";
import { InputControl as TextInput } from "../ui/InputControl";
import { colors, fontSizes, fontWeights, radii, spacing, typography } from "../../theme";

type Props = {
  selected: string[];
  extraOptions?: string[];
  onChange: (tags: string[]) => void;
  allowCustom?: boolean;
  label?: string | null;
  hint?: string | null;
};

function uniqueTags(groups: readonly (readonly string[])[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const name of groups.flat()) {
    const cleaned = cleanCatalogText(name);
    const key = normalizeCatalogText(cleaned);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    result.push(cleaned);
  }
  return result;
}

export function SongTagPicker({
  selected,
  extraOptions = [],
  onChange,
  allowCustom = false,
  label = "Temas",
  hint = null,
}: Props) {
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const selectedRef = useRef(selected);
  selectedRef.current = selected;
  const choices = useMemo(
    () => uniqueTags([SUGGESTED_SONG_TAGS, extraOptions, selected]),
    [extraOptions, selected],
  );
  const selectedKeys = useMemo(() => new Set(selected.map((tag) => normalizeCatalogText(tag))), [selected]);

  const toggle = (name: string) => {
    const current = selectedRef.current;
    const key = normalizeCatalogText(name);
    const alreadySelected = current.some((tag) => normalizeCatalogText(tag) === key);
    const next = alreadySelected
      ? current.filter((tag) => normalizeCatalogText(tag) !== key)
      : current.length >= SONG_TAGS_MAX
        ? current
        : [...current, cleanCatalogText(name)];
    if (!alreadySelected && next === current) {
      setError("Uma música pode ter no máximo 12 temas.");
      return;
    }
    selectedRef.current = next;
    onChange(next);
    setError(null);
  };

  const addCustom = () => {
    const name = cleanCatalogText(draft);
    if (!name) return;
    if (name.includes(",")) {
      setError("O tema não pode conter vírgula.");
      return;
    }
    if (name.length > SONG_TAG_NAME_MAX) {
      setError("O tema deve ter no máximo 40 caracteres.");
      return;
    }
    const key = normalizeCatalogText(name);
    const current = selectedRef.current;
    if (current.some((tag) => normalizeCatalogText(tag) === key)) {
      setDraft("");
      setError(null);
      return;
    }
    if (current.length >= SONG_TAGS_MAX) {
      setError("Uma música pode ter no máximo 12 temas.");
      return;
    }
    const next = [...current, name];
    selectedRef.current = next;
    onChange(next);
    setDraft("");
    setError(null);
  };

  return (
    <View style={styles.wrap}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      {hint ? <Text style={styles.hint}>{hint}</Text> : null}
      <View style={styles.chips}>
        {choices.map((name) => {
          const active = selectedKeys.has(normalizeCatalogText(name));
          return (
            <Chip
              key={normalizeCatalogText(name)}
              label={name}
              active={active}
              onPress={() => toggle(name)}
              style={styles.chip}
              textStyle={styles.chipText}
              accessibilityLabel={`${active ? "Remover tema" : "Marcar tema"} ${name}`}
              accessibilityState={{ selected: active }}
              testID={`song-tag-${name}`}
            />
          );
        })}
      </View>
      {allowCustom ? (
        <View style={styles.addRow}>
          <TextInput
            accessibilityLabel="Outro tema"
            style={styles.input}
            value={draft}
            onChangeText={(value) => { setDraft(value); setError(null); }}
            onSubmitEditing={addCustom}
            placeholder="Outro tema"
            placeholderTextColor={colors.muted}
            autoCorrect={false}
            maxLength={SONG_TAG_NAME_MAX}
            testID="song-tag-input"
          />
          <TouchableOpacity
            style={styles.addButton}
            onPress={addCustom}
            accessibilityRole="button"
            accessibilityLabel="Adicionar tema"
            testID="song-tag-add"
          >
            <Text style={styles.addText}>Adicionar</Text>
          </TouchableOpacity>
        </View>
      ) : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

export function SongTagList({ tags, limit }: { tags?: string[]; limit?: number }) {
  if (!tags?.length) return null;
  const visible = typeof limit === "number" ? tags.slice(0, limit) : tags;
  const hidden = tags.length - visible.length;
  return (
    <View style={styles.list} accessibilityLabel={`Temas: ${tags.join(", ")}`}>
      {visible.map((tag) => <Text key={tag} style={styles.tag}>{tag}</Text>)}
      {hidden > 0 ? <Text style={styles.tag}>+{hidden}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { width: "100%", alignSelf: "stretch", gap: spacing.xs },
  label: { color: colors.text, fontSize: fontSizes.s12, fontWeight: fontWeights.extrabold, marginTop: spacing.sm },
  hint: { color: colors.muted, fontSize: fontSizes.s12, lineHeight: typography.metadata.lineHeight },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: spacing.xs },
  chip: {
    minHeight: 26,
    borderRadius: radii.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 0,
  },
  chipText: { fontSize: fontSizes.s12, fontWeight: fontWeights.semibold },
  addRow: { flexDirection: "row", alignItems: "center", gap: spacing.xs },
  input: {
    flex: 1,
    minHeight: 34,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radii.sm,
    backgroundColor: colors.surface,
    color: colors.ink,
    paddingHorizontal: spacing.sm,
    fontSize: fontSizes.s13,
  },
  addButton: {
    minHeight: 34,
    paddingHorizontal: spacing.sm,
    borderRadius: radii.sm,
    backgroundColor: colors.primarySoft,
    alignItems: "center",
    justifyContent: "center",
  },
  addText: { color: colors.primary, fontSize: fontSizes.s12, fontWeight: fontWeights.extrabold },
  error: { color: colors.danger, fontSize: fontSizes.s12, fontWeight: fontWeights.bold },
  list: { flexDirection: "row", flexWrap: "wrap", gap: spacing.xs, marginTop: spacing.xxs },
  tag: {
    color: colors.primaryDark,
    backgroundColor: colors.primarySoft,
    borderRadius: radii.sm,
    paddingHorizontal: 6,
    paddingVertical: 1,
    fontSize: fontSizes.s11,
    fontWeight: fontWeights.bold,
    overflow: "hidden",
  },
});
