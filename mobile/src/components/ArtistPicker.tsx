import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Image, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import React from "react";
import { Plus, UserRound } from "lucide-react-native";
import { Artist } from "../types";
import { musicService } from "../services/musicService";
import { colors, radii, spacing } from "../theme";

type Props = {
  selected: Artist | null;
  onSelect: (artist: Artist | null) => void;
  onQueryChange?: (query: string) => void;
  canCreate?: boolean;
  label?: string;
  placeholder?: string;
  testID?: string;
};

const normalize = (value: string) => value.normalize("NFKC").trim().replace(/\s+/g, " ").toLocaleLowerCase("pt-BR");

export function ArtistPicker({
  selected,
  onSelect,
  onQueryChange,
  canCreate = true,
  label = "Artista *",
  placeholder = "Digite para buscar ou criar",
  testID = "artist-search-input",
}: Props) {
  const [query, setQuery] = useState(selected?.name ?? "");
  const [artists, setArtists] = useState<Artist[]>([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!selected || normalize(query) === normalize(selected.name)) return;
    setQuery(selected.name);
    onQueryChange?.(selected.name);
  }, [onQueryChange, query, selected]);

  useEffect(() => {
    if (selected && normalize(query) === normalize(selected.name)) return;
    if (!query.trim()) { setArtists([]); setLoading(false); return; }
    const timer = setTimeout(async () => {
      setLoading(true);
      setError(null);
      try { setArtists((await musicService.listArtists(query, 1, 10)).items); }
      catch (reason) { setError(reason instanceof Error ? reason.message : "Não foi possível buscar artistas."); }
      finally { setLoading(false); }
    }, 250);
    return () => clearTimeout(timer);
  }, [query, selected]);

  const exactMatch = useMemo(() => artists.find((artist) => normalize(artist.name) === normalize(query)), [artists, query]);
  const showOptions = query.trim().length >= 2 && (!selected || normalize(selected.name) !== normalize(query));

  const choose = (artist: Artist) => {
    setQuery(artist.name);
    onQueryChange?.(artist.name);
    onSelect(artist);
    setArtists([]);
  };

  const create = async () => {
    const name = query.trim().replace(/\s+/g, " ");
    if (name.length < 2) return;
    setCreating(true);
    setError(null);
    try { choose(await musicService.createArtist({ name })); }
    catch (reason) {
      try {
        const matches = (await musicService.listArtists(name, 1, 10)).items;
        const existing = matches.find((artist) => normalize(artist.name) === normalize(name));
        if (existing) { choose(existing); return; }
      } catch { /* Preserve the original API error. */ }
      setError(reason instanceof Error ? reason.message : "Não foi possível criar o artista.");
    } finally { setCreating(false); }
  };

  return (
    <View>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.inputRow}>
        <TextInput
          style={styles.input}
          value={query}
          onChangeText={(value) => { setQuery(value); onQueryChange?.(value); onSelect(null); setError(null); }}
          placeholder={placeholder}
          placeholderTextColor={colors.muted}
          autoCapitalize="words"
          testID={testID}
        />
        {loading ? <ActivityIndicator color={colors.primary} /> : null}
      </View>
      {showOptions ? (
        <View style={styles.options}>
          {canCreate && !exactMatch ? (
            <TouchableOpacity style={styles.option} onPress={() => void create()} disabled={creating} testID="artist-create-option">
              <View style={styles.avatar}><Plus color={colors.primary} size={18} /></View>
              <Text style={styles.createText}>{creating ? "Criando..." : `Criar \u201c${query.trim().replace(/\s+/g, " ")}\u201d`}</Text>
            </TouchableOpacity>
          ) : null}
          {artists.map((artist) => (
            <TouchableOpacity key={artist.id} style={styles.option} onPress={() => choose(artist)} testID={`artist-option-${artist.id}`}>
              {artist.imageUrl ? <Image source={{ uri: artist.imageUrl }} style={styles.image} /> : <View style={styles.avatar}><UserRound color={colors.muted} size={18} /></View>}
              <Text style={styles.optionText}>{artist.name}</Text>
            </TouchableOpacity>
          ))}
          {!loading && artists.length === 0 && (!canCreate || exactMatch) ? <Text style={styles.empty}>Nenhum artista encontrado.</Text> : null}
        </View>
      ) : null}
      {selected ? <Text style={styles.selected}>Selecionado: {selected.name}</Text> : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  label: { color: colors.text, fontSize: 13, fontWeight: "800", marginBottom: spacing.sm },
  inputRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  input: { flex: 1, minHeight: 48, borderWidth: 1, borderColor: colors.line, borderRadius: radii.md, backgroundColor: colors.surfaceMuted, color: colors.ink, paddingHorizontal: spacing.md, fontSize: 15 },
  options: { borderWidth: 1, borderColor: colors.line, borderRadius: radii.md, backgroundColor: colors.surface, marginTop: spacing.xs, overflow: "hidden" },
  option: { minHeight: 52, flexDirection: "row", alignItems: "center", gap: spacing.md, paddingHorizontal: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.line },
  avatar: { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.primarySoft, alignItems: "center", justifyContent: "center" },
  image: { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.surfaceMuted },
  optionText: { color: colors.ink, fontSize: 14, fontWeight: "700", flex: 1 },
  createText: { color: colors.primary, fontSize: 14, fontWeight: "800", flex: 1 },
  empty: { color: colors.muted, padding: spacing.md, fontSize: 13 },
  selected: { color: colors.primary, fontSize: 12, fontWeight: "700", marginTop: spacing.xs },
  error: { color: colors.danger, fontSize: 12, fontWeight: "700", marginTop: spacing.xs },
});
