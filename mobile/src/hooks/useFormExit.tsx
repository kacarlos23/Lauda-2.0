import React, { useCallback, useEffect, useRef, useState } from "react";
import { Alert, BackHandler, Modal, Platform, StyleSheet, Text, View } from "react-native";
import { useFocusEffect, useNavigation } from "expo-router";
import { useIsFocused, usePreventRemove } from "@react-navigation/native";
import { Button } from "../components/ui/Button";
import { useAuthStore } from "../store/authStore";
import { readFormDraft, removeFormDraft, writeFormDraft } from "../services/formDraftStorage";
import { colors, fontSizes, fontWeights, overlays, radii, spacing } from "../theme";
import { registerFormExitGuard, rememberFormHistoryPosition } from "../navigation/formExitGuard";

type Options<T> = {
  id: string;
  value: T;
  restore: (value: T) => void;
  save: () => Promise<unknown>;
  ready?: boolean;
};

export function useFormExit<T>({ id, value, restore, save, ready = true }: Options<T>) {
  const navigation = useNavigation();
  const focused = useIsFocused();
  const user = useAuthStore((state) => state.user);
  const key = `lauda-form-v1:${user?.tenantId}:${user?.id}:${id}`;
  const snapshot = JSON.stringify(value);
  const [baseline, setBaseline] = useState<string | null>(null);
  const [pending, setPending] = useState<(() => void) | null>(null);
  const [draft, setDraft] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [focusVersion, setFocusVersion] = useState(0);
  const allowed = useRef(false);
  const dirty = focused && ready && baseline !== null && snapshot !== baseline;
  const initial = useRef<string | null>(null);
  const latest = useRef({ snapshot, restore, baseline, save, dirty, key });
  latest.current = { snapshot, restore, baseline, save, dirty, key };

  useEffect(() => {
    if (focused && ready && baseline === null) { initial.current = snapshot; setBaseline(snapshot); }
  }, [focused, ready, baseline, snapshot]);
  useEffect(() => { allowed.current = false; }, [snapshot]);

  useFocusEffect(useCallback(() => {
    allowed.current = false;
    setPending(null);
    setError(null);
    setFocusVersion((current) => current + 1);
    const unregister = registerFormExitGuard((leave) => {
      if (!latest.current.dirty || allowed.current) leave();
      else { setError(null); setPending(() => leave); }
    });
    return () => {
      unregister();
      if (initial.current !== null) latest.current.restore(JSON.parse(initial.current));
      initial.current = null;
      setBaseline(null);
      setDraft(null);
      setPending(null);
    };
  }, []));

  useEffect(() => {
    if (!focused) return;
    let active = true;
    setDraft(null);
    void readFormDraft(key).then((saved) => { if (active) setDraft(saved); }).catch(() => {
      if (active) setError("Não foi possível consultar o rascunho neste dispositivo.");
    });
    return () => { active = false; };
  }, [key, focused, focusVersion]);

  useEffect(() => {
    if (Platform.OS === "web" || !focused) return;
    const subscription = BackHandler.addEventListener("hardwareBackPress", () => {
      if (!latest.current.dirty || allowed.current) return false;
      setError(null);
      setPending(() => () => navigation.canGoBack() ? navigation.goBack() : BackHandler.exitApp());
      return true;
    });
    return () => subscription.remove();
  }, [focused, navigation]);

  usePreventRemove(dirty, ({ data }) => {
    if (allowed.current) { navigation.dispatch(data.action); return; }
    setError(null);
    setPending(() => () => navigation.dispatch(data.action));
  });

  useEffect(() => { if (focused) rememberFormHistoryPosition(); }, [focused, snapshot]);

  // Browsers only allow their own confirmation when reloading/closing the tab.
  useEffect(() => {
    if (Platform.OS !== "web" || typeof window === "undefined" || !dirty) return;
    const warn = (event: BeforeUnloadEvent) => {
      if (allowed.current) return;
      event.preventDefault(); event.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  function reset(saved: T) {
    const clean = JSON.stringify(saved);
    initial.current = clean;
    setBaseline(clean);
  }

  async function complete(saved?: T) {
    // The server has already saved. A local storage error must not make a
    // successful create look like a failure and invite duplicate submissions.
    try { await removeFormDraft(key); }
    catch { Alert.alert("Dados salvos", "Não foi possível remover o rascunho deste dispositivo. Descarte-o caso apareça novamente."); }
    allowed.current = true;
    setBaseline(saved === undefined ? latest.current.snapshot : JSON.stringify(saved));
    if (saved !== undefined) initial.current = JSON.stringify(saved);
    if (pending) { pending(); setPending(null); return true; }
    return false;
  }

  async function leave(keep: boolean) {
    if (busy) return;
    setBusy(true); setError(null);
    try {
      if (keep) await writeFormDraft(key, latest.current.snapshot);
      else await removeFormDraft(key);
      allowed.current = true;
      pending?.(); setPending(null);
    } catch { setError("Não foi possível atualizar o rascunho. Seus dados continuam nesta tela."); }
    finally { setBusy(false); }
  }

  const dialog = <Modal visible={Boolean(pending || draft)} transparent animationType="fade" onRequestClose={() => { if (!busy) { setPending(null); setDraft(null); } }}>
    <View style={styles.backdrop}><View style={styles.card} accessibilityViewIsModal>
      <Text style={styles.title}>{pending ? "Alterações não salvas" : "Rascunho disponível"}</Text>
      <Text>{pending ? "Ao sair, os dados preenchidos serão perdidos. O que deseja fazer?" : "Deseja recuperar o rascunho que você manteve neste dispositivo?"}</Text>
      {error ? <Text accessibilityRole="alert">{error}</Text> : null}
      {pending ? <>
        <Button title="Salvar e sair" disabled={busy} onPress={() => { setBusy(true); setError("Confira os campos obrigatórios caso o salvamento não seja concluído."); void latest.current.save().catch(() => setError("Não foi possível salvar. Confira os dados e tente novamente.")).finally(() => setBusy(false)); }} />
        <Button title="Manter rascunho e sair" variant="secondary" disabled={busy} onPress={() => void leave(true)} />
        <Button title="Sair sem salvar" variant="danger" disabled={busy} onPress={() => void leave(false)} />
        <Button title="Continuar editando" variant="ghost" disabled={busy} onPress={() => setPending(null)} />
      </> : <>
        <Button title="Recuperar rascunho" disabled={!ready || busy} onPress={() => {
          try { restore(JSON.parse(draft!)); setDraft(null); }
          catch { setError("Rascunho inválido. Descarte-o para continuar."); }
        }} />
        <Button title="Descartar rascunho" variant="ghost" disabled={busy} onPress={() => {
          setBusy(true); void removeFormDraft(key).then(() => setDraft(null)).catch(() => setError("Não foi possível descartar o rascunho.")).finally(() => setBusy(false));
        }} />
      </>}
    </View></View>
  </Modal>;
  return { dialog, complete, reset, dirty };
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, alignItems: "center", justifyContent: "center", padding: spacing.lg, backgroundColor: overlays.modal },
  card: { width: "100%", maxWidth: 440, padding: spacing.lg, gap: spacing.md, borderRadius: radii.lg, backgroundColor: colors.surface },
  title: { fontSize: fontSizes.s20, fontWeight: fontWeights.bold, color: colors.text },
});
