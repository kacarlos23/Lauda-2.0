import { useEffect, useState } from "react";
import { Alert, Image, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Redirect } from "expo-router";
import { Edit3, Save, UserRound, X } from "lucide-react-native";
import { useAuthStore } from "../../../src/store/authStore";
import { musicService } from "../../../src/services/musicService";
import { Artist } from "../../../src/types";
import { canManageMusic } from "../../../src/utils/musicPermissions";
import { colors, radii, spacing, typography } from "../../../src/theme";
import { AppBackButton } from "../../../src/components/AppBackButton";
import {
  AppInput,
  Button,
  EmptyState,
  LoadingState,
  PageHeader,
  Screen,
  SearchField,
  Toolbar,
} from "../../../src/components/ui";

export default function ArtistsScreen() {
  const user = useAuthStore((state) => state.user);
  const [search, setSearch] = useState("");
  const [artists, setArtists] = useState<Artist[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState<Artist | null>(null);
  const [name, setName] = useState("");
  const [imageUrl, setImageUrl] = useState("");

  const load = async (value = search) => {
    setLoading(true);
    try {
      setArtists((await musicService.listArtists(value)).items);
    } catch (reason) {
      Alert.alert("Erro", reason instanceof Error ? reason.message : "Não foi possível carregar artistas.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => void load(search), 250);
    return () => clearTimeout(timer);
  }, [search]);

  if (!canManageMusic(user, "song:edit")) return <Redirect href={"/songs" as never} />;

  const startEdit = (artist: Artist) => {
    setEditing(artist);
    setName(artist.name);
    setImageUrl(artist.imageUrl ?? "");
  };

  const cancel = () => {
    setEditing(null);
    setName("");
    setImageUrl("");
  };

  const save = async () => {
    if (!editing || name.trim().length < 2) {
      Alert.alert("Dados inválidos", "Informe um nome com ao menos 2 caracteres.");
      return;
    }
    setSaving(true);
    try {
      await musicService.updateArtist(editing.id, { name: name.trim(), imageUrl: imageUrl.trim() || undefined });
      cancel();
      await load();
    } catch (reason) {
      Alert.alert("Erro", reason instanceof Error ? reason.message : "Não foi possível atualizar o artista.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Screen scroll>
      <View style={styles.backRow}><AppBackButton href="/songs" /></View>
      <PageHeader title="Artistas" subtitle="Catálogo usado nas músicas e cifras." />

      <Toolbar style={styles.toolbar}>
        <SearchField
          value={search}
          onChangeText={setSearch}
          placeholder="Buscar artista"
          accessibilityLabel="Buscar artista"
          containerStyle={styles.search}
        />
      </Toolbar>

      {editing ? (
        <View style={styles.editor}>
          <Text style={styles.editorTitle}>Editar artista</Text>
          <View style={styles.editorFields}>
            <AppInput
              label="Nome"
              value={name}
              onChangeText={setName}
              placeholder="Nome do artista"
              containerStyle={styles.editorField}
            />
            <AppInput
              label="URL da imagem"
              value={imageUrl}
              onChangeText={setImageUrl}
              placeholder="https://..."
              autoCapitalize="none"
              containerStyle={styles.editorField}
            />
          </View>
          <View style={styles.editorActions}>
            <Button
              title="Salvar"
              icon={<Save color={colors.inverse} size={17} strokeWidth={2.2} />}
              loading={saving}
              onPress={() => void save()}
            />
            <Button
              title="Cancelar"
              icon={<X color={colors.primary} size={17} strokeWidth={2.2} />}
              variant="secondary"
              onPress={cancel}
              disabled={saving}
            />
          </View>
        </View>
      ) : null}

      <View style={styles.listHeader}>
        <Text style={styles.sectionTitle}>Catálogo</Text>
        <Text style={styles.count}>{artists.length} artista(s)</Text>
      </View>

      {loading && !artists.length ? (
        <LoadingState centered={false} message="Carregando artistas..." style={styles.loading} />
      ) : artists.length ? (
        <View style={styles.list}>
          {artists.map((artist) => (
            <View key={artist.id} style={styles.row}>
              {artist.imageUrl ? (
                <Image source={{ uri: artist.imageUrl }} style={styles.avatar} />
              ) : (
                <View style={styles.placeholder}><UserRound color={colors.primary} size={19} /></View>
              )}
              <Text style={styles.name}>{artist.name}</Text>
              <TouchableOpacity
                style={styles.edit}
                onPress={() => startEdit(artist)}
                accessibilityRole="button"
                accessibilityLabel={`Editar ${artist.name}`}
              >
                <Edit3 color={colors.primary} size={18} strokeWidth={2.1} />
              </TouchableOpacity>
            </View>
          ))}
        </View>
      ) : (
        <EmptyState
          title="Nenhum artista encontrado"
          description={search ? "Ajuste a busca para ver outros artistas." : "Os artistas cadastrados nas músicas aparecerão aqui."}
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  backRow: { marginBottom: spacing.sm },
  toolbar: { marginBottom: spacing.xl },
  search: { flex: 1, minWidth: 240 },
  editor: {
    borderLeftWidth: 3,
    borderLeftColor: colors.accent,
    backgroundColor: colors.surfaceMuted,
    padding: spacing.lg,
    marginBottom: spacing.xl,
  },
  editorTitle: { ...typography.sectionTitle, color: colors.ink, marginBottom: spacing.md },
  editorFields: { flexDirection: "row", flexWrap: "wrap", gap: spacing.md },
  editorField: { flex: 1, minWidth: 240 },
  editorActions: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, marginTop: spacing.lg },
  listHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.md,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.lineStrong,
  },
  sectionTitle: { ...typography.sectionTitle, color: colors.ink },
  count: { ...typography.metadata, color: colors.muted },
  loading: { paddingVertical: spacing.xl, alignItems: "flex-start" },
  list: { borderBottomWidth: 1, borderBottomColor: colors.line },
  row: {
    minHeight: 60,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
    paddingVertical: spacing.sm,
  },
  avatar: { width: 38, height: 38, borderRadius: 19, backgroundColor: colors.surfaceMuted },
  placeholder: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.primarySoft,
    alignItems: "center",
    justifyContent: "center",
  },
  name: { ...typography.label, flex: 1, color: colors.ink },
  edit: {
    width: 44,
    height: 44,
    borderRadius: radii.md,
    alignItems: "center",
    justifyContent: "center",
  },
});
