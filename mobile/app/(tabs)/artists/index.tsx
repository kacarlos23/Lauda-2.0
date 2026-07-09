import { useEffect, useState } from "react";
import { ActivityIndicator, Alert, Image, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { Redirect } from "expo-router";
import { Edit3, Save, UserRound, X } from "lucide-react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuthStore } from "../../../src/store/authStore";
import { musicService } from "../../../src/services/musicService";
import { Artist } from "../../../src/types";
import { canManageMusic } from "../../../src/utils/musicPermissions";
import { colors, radii, screen, shadow, spacing } from "../../../src/theme";
import { AppBackButton } from "../../../src/components/AppBackButton";

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
    try { setArtists((await musicService.listArtists(value, 1, 100)).items); }
    catch (reason) { Alert.alert("Erro", reason instanceof Error ? reason.message : "Não foi possível carregar artistas."); }
    finally { setLoading(false); }
  };
  useEffect(() => { const timer = setTimeout(() => void load(search), 250); return () => clearTimeout(timer); }, [search]);
  if (!canManageMusic(user?.role)) return <Redirect href={"/songs" as never} />;

  const startEdit = (artist: Artist) => { setEditing(artist); setName(artist.name); setImageUrl(artist.imageUrl ?? ""); };
  const cancel = () => { setEditing(null); setName(""); setImageUrl(""); };
  const save = async () => {
    if (!editing || name.trim().length < 2) { Alert.alert("Dados inválidos", "Informe um nome com ao menos 2 caracteres."); return; }
    setSaving(true);
    try { await musicService.updateArtist(editing.id, { name: name.trim(), imageUrl: imageUrl.trim() || null }); cancel(); await load(); }
    catch (reason) { Alert.alert("Erro", reason instanceof Error ? reason.message : "Não foi possível atualizar o artista."); }
    finally { setSaving(false); }
  };

  return <SafeAreaView style={styles.safe} edges={["left", "right"]}><ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
    <View style={styles.backRow}><AppBackButton href="/songs" /></View>
    <Text style={styles.title}>Artistas</Text><Text style={styles.subtitle}>Atualize os dados usados no catálogo de músicas.</Text>
    <TextInput style={styles.input} value={search} onChangeText={setSearch} placeholder="Buscar artista" placeholderTextColor={colors.muted} />
    {editing ? <View style={styles.card}><Text style={styles.sectionTitle}>Editar artista</Text><Text style={styles.label}>Nome *</Text><TextInput style={styles.input} value={name} onChangeText={setName} /><Text style={styles.label}>URL da imagem</Text><TextInput style={styles.input} value={imageUrl} onChangeText={setImageUrl} autoCapitalize="none" keyboardType="url" placeholder="https://..." placeholderTextColor={colors.muted} />
      <View style={styles.actions}><TouchableOpacity style={styles.primary} onPress={() => void save()} disabled={saving}>{saving ? <ActivityIndicator color={colors.surface} /> : <Save color={colors.surface} size={17} />}<Text style={styles.primaryText}>Salvar</Text></TouchableOpacity><TouchableOpacity style={styles.secondary} onPress={cancel}><X color={colors.primary} size={17} /><Text style={styles.secondaryText}>Cancelar</Text></TouchableOpacity></View>
    </View> : null}
    <View style={styles.listHeader}><Text style={styles.sectionTitle}>Catálogo</Text>{loading ? <ActivityIndicator color={colors.primary} /> : null}</View>
    <View style={styles.list}>{artists.map((artist) => <View key={artist.id} style={styles.row}>{artist.imageUrl ? <Image source={{ uri: artist.imageUrl }} style={styles.avatar} /> : <View style={styles.placeholder}><UserRound color={colors.primary} size={20} /></View>}<Text style={styles.name}>{artist.name}</Text><TouchableOpacity style={styles.edit} onPress={() => startEdit(artist)} accessibilityLabel={`Editar ${artist.name}`}><Edit3 color={colors.primary} size={18} /></TouchableOpacity></View>)}</View>
    {!loading && !artists.length ? <Text style={styles.empty}>Nenhum artista encontrado.</Text> : null}
  </ScrollView></SafeAreaView>;
}

const styles = StyleSheet.create({ safe: { flex: 1, backgroundColor: colors.background }, container: { width: "100%", maxWidth: screen.maxWidth, alignSelf: "center", padding: spacing.xl, paddingBottom: screen.contentBottomPadding }, backRow: { marginBottom: spacing.lg }, title: { color: colors.ink, fontSize: 28, fontWeight: "800" }, subtitle: { color: colors.muted, fontSize: 14, lineHeight: 21, marginTop: spacing.xs, marginBottom: spacing.lg }, input: { minHeight: 48, borderWidth: 1, borderColor: colors.line, borderRadius: radii.md, backgroundColor: colors.surface, color: colors.ink, paddingHorizontal: spacing.md, fontSize: 15, marginBottom: spacing.md }, card: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, borderRadius: radii.xl, padding: spacing.lg, marginBottom: spacing.xl, ...shadow }, sectionTitle: { color: colors.ink, fontSize: 18, fontWeight: "800", marginBottom: spacing.md }, label: { color: colors.text, fontSize: 13, fontWeight: "800", marginBottom: spacing.sm }, actions: { flexDirection: "row", gap: spacing.sm }, primary: { minHeight: 44, flexDirection: "row", gap: spacing.sm, alignItems: "center", justifyContent: "center", backgroundColor: colors.primary, borderRadius: radii.md, paddingHorizontal: spacing.lg }, primaryText: { color: colors.surface, fontWeight: "800" }, secondary: { minHeight: 44, flexDirection: "row", gap: spacing.sm, alignItems: "center", justifyContent: "center", backgroundColor: colors.primarySoft, borderRadius: radii.md, paddingHorizontal: spacing.lg }, secondaryText: { color: colors.primary, fontWeight: "800" }, listHeader: { flexDirection: "row", justifyContent: "space-between" }, list: { gap: spacing.sm }, row: { minHeight: 66, flexDirection: "row", alignItems: "center", gap: spacing.md, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, borderRadius: radii.md, padding: spacing.md }, avatar: { width: 40, height: 40, borderRadius: 20 }, placeholder: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.primarySoft, alignItems: "center", justifyContent: "center" }, name: { flex: 1, color: colors.ink, fontSize: 15, fontWeight: "800" }, edit: { width: 40, height: 40, borderRadius: radii.md, backgroundColor: colors.primarySoft, alignItems: "center", justifyContent: "center" }, empty: { color: colors.muted, textAlign: "center", marginTop: spacing.xl } });
