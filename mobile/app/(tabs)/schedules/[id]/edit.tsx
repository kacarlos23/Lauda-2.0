import React, { useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Alert, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, useWindowDimensions, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { AppBackButton } from "../../../../src/components/AppBackButton";
import { Button, ErrorBanner, LoadingState } from "../../../../src/components/ui";
import { RichCommentEditor } from "../../../../src/components/ui/RichCommentEditor";
import { ArrowLeft, Download, Search, Trash2, X } from "lucide-react-native";
import { DateTimeInput } from "../../../../src/components/DateTimeInput";
import { memberService } from "../../../../src/services/memberService";
import { ministryApi } from "../../../../src/services/ministryApi";
import { musicService } from "../../../../src/services/musicService";
import { useAuthStore } from "../../../../src/store/authStore";
import { useScheduleStore } from "../../../../src/store/scheduleStore";
import { scheduleService } from "../../../../src/services/scheduleService";
import { Member, Ministry, MinistryMember, ScheduleAssignment, Song } from "../../../../src/types";
import { colors, radii, screen, shadow, spacing } from "../../../../src/theme";
import { combineDisplayDateTimeToIso, toDisplayDate } from "../../../../src/utils/dateTimeInput";
import { canManageMusic } from "../../../../src/utils/musicPermissions";
import { canDeleteSchedule, canEditSchedule } from "../../../../src/utils/schedulePermissions";

function timeValue(value: string) {
  const date = new Date(value);
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

export default function EditScheduleScreen() {
  const { width } = useWindowDimensions();
  const compactLayout = width < 700;
  const params = useLocalSearchParams<{ id?: string | string[] }>();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const canEditSchedules = canEditSchedule(user);
  const canDeleteSchedules = canDeleteSchedule(user);
  const canExportSongs = canManageMusic(user, "song:view");
  const { allSchedules, loadSchedules, updateSchedule, deleteSchedule, saving, error } = useScheduleStore();
  const schedule = allSchedules.find((item) => item.id === id);
  const [title, setTitle] = useState("");
  const [date, setDate] = useState("");
  const [hour, setHour] = useState("19:00");
  const [comments, setComments] = useState("");
  const [ministries, setMinistries] = useState<Ministry[]>([]);
  const [ministryId, setMinistryId] = useState("");
  const [members, setMembers] = useState<Member[]>([]);
  const [ministryMembers, setMinistryMembers] = useState<MinistryMember[]>([]);
  const [songs, setSongs] = useState<Song[]>([]);
  const [visibleSongs, setVisibleSongs] = useState<Song[]>([]);
  const [songSearch, setSongSearch] = useState("");
  const [songSearchLoading, setSongSearchLoading] = useState(false);
  const [songSearchError, setSongSearchError] = useState<string | null>(null);
  const [selectedMembers, setSelectedMembers] = useState<Array<{ userId: string; role: string; status?: ScheduleAssignment["status"] }>>([]);
  const [selectedSongIds, setSelectedSongIds] = useState<string[]>([]);
  const [membersModal, setMembersModal] = useState(false);
  const [songsModal, setSongsModal] = useState(false);
  const [songOrderModal, setSongOrderModal] = useState(false);
  const [draggedSongIndex, setDraggedSongIndex] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [exportingSongs, setExportingSongs] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteModalVisible, setDeleteModalVisible] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const deletingRef = useRef(false);

  useEffect(() => {
    void loadSchedules();
  }, [loadSchedules]);

  useEffect(() => {
    if (!schedule) return;
    const scheduleDate = new Date(schedule.date);
    setTitle(schedule.title);
    setDate(toDisplayDate(scheduleDate));
    setHour(timeValue(schedule.date));
    setComments(schedule.comments ?? "");
    setMinistryId(schedule.ministryId);
    setSelectedSongIds(schedule.songs?.map((entry) => entry.songId) ?? []);
    setSelectedMembers(schedule.assignments?.map((entry) => ({ userId: entry.userId, role: entry.role, status: entry.status })) ?? []);
  }, [schedule?.id]);

  useEffect(() => {
    if (!canEditSchedules) return;
    let mounted = true;
    Promise.all([ministryApi.getMinistries(), memberService.listMembers(), musicService.listSongs("", 1, 100)])
      .then(([ministryResult, memberResult, songResult]) => {
        if (!mounted) return;
        setMinistries(ministryResult);
        setMembers(memberResult);
        setSongs(songResult.items);
        setVisibleSongs(songResult.items);
      })
      .catch((reason) => Alert.alert("Erro", reason instanceof Error ? reason.message : "Não foi possível carregar dados da escala."))
      .finally(() => { if (mounted) setLoading(false); });
    return () => { mounted = false; };
  }, [canEditSchedules]);

  useEffect(() => {
    if (!songsModal) return;
    let cancelled = false;
    const timer = setTimeout(async () => {
      setSongSearchLoading(true);
      setSongSearchError(null);
      try {
        const result = await musicService.listSongs(songSearch.trim(), 1, 100);
        if (cancelled) return;
        setVisibleSongs(result.items);
        setSongs((current) => {
          const merged = new Map(current.map((song) => [song.id, song]));
          result.items.forEach((song) => merged.set(song.id, song));
          return [...merged.values()];
        });
      } catch (reason) {
        if (!cancelled) setSongSearchError(reason instanceof Error ? reason.message : "Não foi possível buscar músicas.");
      } finally {
        if (!cancelled) setSongSearchLoading(false);
      }
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [songSearch, songsModal]);

  useEffect(() => {
    if (!ministryId) {
      setMinistryMembers([]);
      return;
    }
    void ministryApi.listMembers(ministryId, { status: "ACTIVE", limit: 100 }).then((result) => setMinistryMembers(result.items)).catch(() => setMinistryMembers([]));
  }, [ministryId]);

  const availableMembers = useMemo(() => {
    if (user?.role === "MINISTRY_LEADER") {
      const ids = new Set(ministryMembers.map((item) => item.userId));
      return members.filter((member) => ids.has(member.id));
    }
    return members;
  }, [members, ministryMembers, user?.role]);

  const selectedMemberDetails = useMemo(
    () => selectedMembers.map((entry) => ({ ...entry, member: members.find((member) => member.id === entry.userId) })).filter((entry) => entry.member),
    [members, selectedMembers]
  );
  const selectedSongs = useMemo(() => selectedSongIds.map((songId) => songs.find((song) => song.id === songId)).filter(Boolean) as Song[], [selectedSongIds, songs]);

  const toggleSong = (songId: string) => setSelectedSongIds((current) => current.includes(songId) ? current.filter((item) => item !== songId) : [...current, songId]);
  const closeSongsModal = () => {
    setSongsModal(false);
    setSongSearch("");
    setSongSearchError(null);
    setVisibleSongs(songs);
  };
  const toggleMember = (userId: string) => setSelectedMembers((current) => current.some((item) => item.userId === userId)
    ? current.filter((item) => item.userId !== userId)
    : [...current, { userId, role: "Membro", status: "PENDING" }]);

  const getSongOrder = (songId: string) => {
    const index = selectedSongIds.indexOf(songId);
    return index >= 0 ? index + 1 : null;
  };

  const reorderSong = (fromIndex: number, toIndex: number) => {
    setSelectedSongIds((current) => {
      if (fromIndex === toIndex || fromIndex < 0 || toIndex < 0 || fromIndex >= current.length || toIndex >= current.length) return current;
      const next = [...current];
      const [moved] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, moved);
      return next;
    });
  };

  const moveSong = (index: number, direction: -1 | 1) => {
    reorderSong(index, index + direction);
  };

  const getSongDragProps = (index: number) => Platform.OS === "web" ? ({
    draggable: true,
    onDragStart: () => setDraggedSongIndex(index),
    onDragOver: (event: { preventDefault?: () => void }) => event.preventDefault?.(),
    onDrop: () => {
      if (draggedSongIndex !== null) reorderSong(draggedSongIndex, index);
      setDraggedSongIndex(null);
    },
    onDragEnd: () => setDraggedSongIndex(null),
  } as any) : {};

  const save = async () => {
    if (!id) return;
    if (!title.trim()) return Alert.alert("Dados incompletos", "Informe o nome da escala.");
    const isoDate = combineDisplayDateTimeToIso(date, hour);
    if (!isoDate) return Alert.alert("Data ou horário inválido", "Informe data no formato DD/MM/AAAA e horário no formato HH:mm.");
    try {
      await updateSchedule(id, {
        title: title.trim(),
        date: isoDate,
        comments: comments || null,
        ministryId,
        songIds: selectedSongIds,
        assignments: selectedMembers.map((entry) => ({ userId: entry.userId, role: entry.role, status: entry.status ?? "PENDING" })),
      });
      router.replace("/schedules" as never);
    } catch (reason) {
      Alert.alert("Erro", reason instanceof Error ? reason.message : "Não foi possível atualizar a escala.");
    }
  };

  const exportReport = async () => {
    if (!schedule) return;
    setExporting(true);
    try {
      const reportDate = new Date(schedule.date).toISOString().slice(0, 10);
      await scheduleService.exportScheduleReport(schedule.id, `Escala - ${schedule.title} - ${reportDate}.pdf`, schedule);
    } catch (reason) {
      Alert.alert("Erro", reason instanceof Error ? reason.message : "Não foi possível gerar o relatório da escala.");
    } finally {
      setExporting(false);
    }
  };

  const exportScheduleSongs = async () => {
    if (!schedule) return;
    const songIds = [...(schedule.songs ?? [])]
      .sort((first, second) => first.order - second.order)
      .map((entry) => entry.songId);
    if (!songIds.length) return;
    if (songIds.length > 50) {
      Alert.alert("Limite de cifras", "É possível exportar até 50 músicas por PDF.");
      return;
    }
    setExportingSongs(true);
    try {
      const reportDate = new Date(schedule.date).toISOString().slice(0, 10);
      await musicService.exportSongs(songIds, `Cifras - ${schedule.title} - ${reportDate}.pdf`);
    } catch (reason) {
      Alert.alert("Erro", reason instanceof Error ? reason.message : "Não foi possível exportar as cifras da escala.");
    } finally {
      setExportingSongs(false);
    }
  };

  const handleDelete = async () => {
    if (!id || deletingRef.current) return;
    deletingRef.current = true;
    setDeleting(true);
    setDeleteError(null);
    try {
      await deleteSchedule(id);
      setDeleteModalVisible(false);
      router.replace("/schedules" as never);
    } catch (reason) {
      setDeleteError(reason instanceof Error ? reason.message : "Não foi possível excluir a escala.");
    } finally {
      deletingRef.current = false;
      setDeleting(false);
    }
  };

  const openDeleteModal = () => {
    if (!schedule || deleting) return;
    setDeleteError(null);
    setDeleteModalVisible(true);
  };

  const closeDeleteModal = () => {
    if (deleting) return;
    setDeleteModalVisible(false);
    setDeleteError(null);
  };

  if (!canEditSchedules) {
    return <View style={styles.center}><Text style={styles.error}>Você não tem permissão para editar escalas.</Text><AppBackButton href="/schedules" /></View>;
  }

  if (loading) {
    return <LoadingState message="Carregando escala..." />;
  }

  if (!schedule) {
    return (
      <View style={styles.center}>
        <ErrorBanner
          message="Escala não encontrada."
          style={styles.error}
          action={<Button title="Tentar novamente" variant="secondary" onPress={() => loadSchedules()} />}
        />
        <AppBackButton href="/schedules" />
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={[styles.container, compactLayout && styles.containerCompact]} keyboardShouldPersistTaps="handled">
      <Modal visible={deleteModalVisible} transparent animationType="fade" onRequestClose={closeDeleteModal}>
        <Pressable
          style={styles.deleteModalBackdrop}
          onPress={closeDeleteModal}
          accessible={false}
          testID="delete-schedule-modal-backdrop"
        >
          <Pressable
            style={[styles.deleteModalCard, compactLayout && styles.deleteModalCardCompact]}
            onPress={(event) => event.stopPropagation()}
            accessibilityViewIsModal
            accessibilityLabel="Confirmação para excluir escala"
            testID="delete-schedule-modal"
          >
            <View style={styles.deleteModalHeader}>
              <View style={styles.deleteIconCircle}>
                <Trash2 color={colors.danger} size={26} strokeWidth={2.2} />
              </View>
              <TouchableOpacity
                style={[styles.deleteModalClose, deleting && styles.disabled]}
                onPress={closeDeleteModal}
                disabled={deleting}
                accessibilityRole="button"
                accessibilityLabel="Fechar"
              >
                <X color={colors.muted} size={22} strokeWidth={2.4} />
              </TouchableOpacity>
            </View>
            <Text style={styles.deleteModalTitle}>Excluir escala?</Text>
            <Text style={styles.deleteModalScheduleName}>{schedule.title}</Text>
            <Text style={styles.deleteModalDescription}>
              A escala sairá das listas ativas. As músicas e atribuições relacionadas serão desativadas para preservar o histórico de aceite, recusa e pendência.
            </Text>
            {deleteError ? (
              <View style={styles.deleteModalError} testID="delete-schedule-error">
                <Text style={styles.deleteModalErrorTitle}>Não foi possível excluir</Text>
                <Text style={styles.deleteModalErrorText}>{deleteError}</Text>
              </View>
            ) : null}
            <View style={[styles.deleteModalActions, compactLayout && styles.deleteModalActionsCompact]}>
              <TouchableOpacity
                style={[styles.deleteCancelButton, deleting && styles.disabled]}
                onPress={closeDeleteModal}
                disabled={deleting}
                accessibilityRole="button"
                accessibilityLabel="Manter escala"
              >
                <Text style={styles.deleteCancelButtonText}>Manter escala</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.deleteConfirmButton, deleting && styles.disabled]}
                onPress={() => void handleDelete()}
                disabled={deleting}
                accessibilityRole="button"
                accessibilityLabel="Confirmar exclusão da escala"
                testID="delete-schedule-confirm-button"
              >
                {deleting ? <ActivityIndicator color={colors.surface} size="small" /> : <Trash2 color={colors.surface} size={18} strokeWidth={2.4} />}
                <Text style={styles.deleteConfirmButtonText}>{deleting ? "Excluindo..." : "Excluir escala"}</Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
      <Modal visible={songsModal} transparent animationType="fade" onRequestClose={closeSongsModal}>
        <View style={styles.backdrop}><View style={styles.modalCard}>
          <View style={styles.modalHeaderRow}>
            <TouchableOpacity style={styles.modalBackButton} onPress={closeSongsModal} accessibilityRole="button" accessibilityLabel="Voltar">
              <ArrowLeft color={colors.primary} size={20} strokeWidth={2.4} />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Editar músicas</Text>
            <View style={styles.modalHeaderSpacer} />
          </View>
          <Text style={styles.helper}>O número ao lado indica a ordem atual da música na escala.</Text>
          <View style={styles.songSearchRow}>
            <Search color={colors.muted} size={19} />
            <TextInput
              style={styles.songSearchInput}
              value={songSearch}
              onChangeText={setSongSearch}
              placeholder="Buscar por música ou artista"
              placeholderTextColor={colors.muted}
              accessibilityLabel="Buscar músicas da escala"
              testID="schedule-song-search-input"
              returnKeyType="search"
            />
            {songSearchLoading ? <ActivityIndicator color={colors.primary} size="small" /> : null}
          </View>
          {songSearchError ? <Text style={styles.songSearchError}>{songSearchError}</Text> : null}
          <ScrollView style={styles.modalList}>
            {visibleSongs.map((song) => {
              const selected = selectedSongIds.includes(song.id);
              const order = getSongOrder(song.id);
              return <TouchableOpacity key={song.id} style={[styles.option, selected && styles.optionSelected]} onPress={() => toggleSong(song.id)}>
                <View style={styles.optionTitleRow}>
                  <Text style={styles.optionTitle}>{song.title}</Text>
                  {order ? <Text style={styles.orderBadge}>{order}</Text> : null}
                </View>
                <Text style={styles.optionMeta}>{song.artist.name} · Tom {song.originalKey}</Text>
              </TouchableOpacity>;
            })}
            {!songSearchLoading && !visibleSongs.length ? <Text style={styles.emptyText}>Nenhuma música encontrada.</Text> : null}
          </ScrollView>
          <View style={styles.modalActions}>
            <TouchableOpacity style={styles.modalActionSecondary} onPress={() => setSongOrderModal(true)} disabled={selectedSongIds.length < 2}><Text style={styles.secondaryText}>Organizar ordem</Text></TouchableOpacity>
            <TouchableOpacity style={styles.modalActionPrimary} onPress={closeSongsModal}><Text style={styles.primaryText}>Concluir</Text></TouchableOpacity>
          </View>
        </View></View>
      </Modal>

      <Modal visible={songOrderModal} transparent animationType="fade" onRequestClose={() => setSongOrderModal(false)}>
        <View style={styles.backdrop}><View style={styles.modalCard}>
          <View style={styles.modalHeaderRow}>
            <TouchableOpacity style={styles.modalBackButton} onPress={() => setSongOrderModal(false)} accessibilityRole="button" accessibilityLabel="Voltar">
              <ArrowLeft color={colors.primary} size={20} strokeWidth={2.4} />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Organizar ordem das músicas</Text>
            <View style={styles.modalHeaderSpacer} />
          </View>
          <Text style={styles.helper}>Arraste as músicas para reorganizar no desktop ou use os botões subir/descer.</Text>
          {selectedSongs.length === 0 ? <Text style={styles.emptyText}>Nenhuma música selecionada.</Text> : (
            <ScrollView style={styles.modalList}>
              {selectedSongs.map((song, index) => (
                <View key={song.id} style={[styles.orderItem, draggedSongIndex === index && styles.orderItemDragging]} {...getSongDragProps(index)}>
                  <View style={styles.orderItemMain}>
                    <Text style={styles.orderBadgeLarge}>{index + 1}</Text>
                    <View style={styles.orderItemText}>
                      <Text style={styles.optionTitle}>{song.title}</Text>
                      <Text style={styles.optionMeta}>{song.artist.name} · Tom {song.originalKey}</Text>
                    </View>
                  </View>
                  <View style={styles.orderActions}>
                    <TouchableOpacity style={[styles.orderButton, index === 0 && styles.disabled]} disabled={index === 0} onPress={() => moveSong(index, -1)}>
                      <Text style={styles.orderButtonText}>↑</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.orderButton, index === selectedSongs.length - 1 && styles.disabled]} disabled={index === selectedSongs.length - 1} onPress={() => moveSong(index, 1)}>
                      <Text style={styles.orderButtonText}>↓</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ))}
            </ScrollView>
          )}
          <TouchableOpacity style={styles.primaryButton} onPress={() => setSongOrderModal(false)}><Text style={styles.primaryText}>Concluir organização</Text></TouchableOpacity>
        </View></View>
      </Modal>

      <Modal visible={membersModal} transparent animationType="fade" onRequestClose={() => setMembersModal(false)}>
        <View style={styles.backdrop}><View style={styles.modalCard}>
          <View style={styles.modalHeaderRow}>
            <TouchableOpacity style={styles.modalBackButton} onPress={() => setMembersModal(false)} accessibilityRole="button" accessibilityLabel="Voltar">
              <ArrowLeft color={colors.primary} size={20} strokeWidth={2.4} />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Editar membros</Text>
            <View style={styles.modalHeaderSpacer} />
          </View>
          <ScrollView style={styles.modalList}>
            {availableMembers.map((member) => {
              const selected = selectedMembers.some((entry) => entry.userId === member.id);
              return <TouchableOpacity key={member.id} style={[styles.option, selected && styles.optionSelected]} onPress={() => toggleMember(member.id)}>
                <Text style={styles.optionTitle}>{member.name}</Text>
                <Text style={styles.optionMeta}>{selected ? "Selecionado" : "Toque para selecionar"}</Text>
              </TouchableOpacity>;
            })}
          </ScrollView>
          <TouchableOpacity style={styles.primaryButton} onPress={() => setMembersModal(false)}><Text style={styles.primaryText}>Concluir</Text></TouchableOpacity>
        </View></View>
      </Modal>

      <View style={styles.backRow}><AppBackButton href="/schedules" /></View>
      <View style={[styles.titleRow, compactLayout && styles.titleRowCompact]}>
        <View style={styles.titleGroup}>
          <Text style={styles.title}>Editar Escala</Text>
          <Text style={styles.subtitle}>Atualize os dados, músicas e membros da escala.</Text>
        </View>
        <View style={[styles.exportActions, compactLayout && styles.exportActionsCompact]}>
          <TouchableOpacity
            style={styles.reportButton}
            onPress={() => void exportReport()}
            disabled={exporting}
            accessibilityRole="button"
            accessibilityLabel="Gerar relatório da escala"
          >
            {exporting ? <ActivityIndicator color={colors.primary} /> : <Download color={colors.primary} size={16} strokeWidth={2.4} />}
            <Text style={styles.reportButtonText}>{exporting ? "Gerando..." : "Gerar relatório"}</Text>
          </TouchableOpacity>
          {canExportSongs && schedule.songs?.length ? (
            <TouchableOpacity
              style={styles.reportButton}
              onPress={() => void exportScheduleSongs()}
              disabled={exportingSongs}
              accessibilityRole="button"
              accessibilityLabel="Exportar cifras da escala"
            >
              {exportingSongs ? <ActivityIndicator color={colors.primary} /> : <Download color={colors.primary} size={16} strokeWidth={2.4} />}
              <Text style={styles.reportButtonText}>{exportingSongs ? "Gerando..." : "Gerar cifras"}</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      </View>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <View style={[styles.card, compactLayout && styles.cardCompact]}>
        <Text style={styles.label}>Nome da escala *</Text>
        <TextInput style={styles.input} value={title} onChangeText={setTitle} placeholder="Ex: Culto de Domingo" placeholderTextColor={colors.muted} />
        <Text style={styles.label}>Ministério *</Text>
        <View style={styles.chips}>{ministries.map((ministry) => (
          <TouchableOpacity key={ministry.id} style={[styles.chip, ministryId === ministry.id && styles.chipActive]} onPress={() => { setMinistryId(ministry.id); setSelectedMembers([]); }}>
            <Text style={[styles.chipText, ministryId === ministry.id && styles.chipTextActive]}>{ministry.name}</Text>
          </TouchableOpacity>
        ))}</View>
        <View style={[styles.rowFields, compactLayout && styles.rowFieldsCompact]}>
          <View style={compactLayout ? styles.fieldCompact : styles.field}>
            <DateTimeInput type="date" label="Dia *" value={date} onChange={setDate} />
          </View>
          <View style={compactLayout ? styles.fieldCompact : styles.field}>
            <DateTimeInput type="time" label="Horário *" value={hour} onChange={setHour} />
          </View>
        </View>
        <View style={styles.commentsEditor}><RichCommentEditor value={comments} onChange={setComments} label="Comentários" placeholder="Orientações, avisos ou observações para esta escala..." testID="schedule-comments-input" /></View>
        <View style={[styles.sectionHeader, compactLayout && styles.sectionHeaderCompact]}>
          <View style={styles.sectionText}>
            <Text style={styles.sectionTitle}>Músicas</Text>
            <Text style={styles.helper}>{selectedSongs.length ? selectedSongs.map((song, index) => `${index + 1}. ${song.title}`).join(", ") : "Nenhuma música adicionada."}</Text>
          </View>
          <View style={[styles.sectionActions, compactLayout && styles.sectionActionsCompact]}>
            <TouchableOpacity style={styles.secondaryButton} onPress={() => setSongsModal(true)}><Text style={styles.secondaryText}>Editar músicas</Text></TouchableOpacity>
            <TouchableOpacity style={styles.secondaryButton} onPress={() => setSongOrderModal(true)} disabled={selectedSongIds.length < 2}><Text style={styles.secondaryText}>Organizar ordem</Text></TouchableOpacity>
          </View>
        </View>
        <View style={[styles.sectionHeader, compactLayout && styles.sectionHeaderCompact]}><View style={styles.sectionText}><Text style={styles.sectionTitle}>Membros</Text><Text style={styles.helper}>{selectedMemberDetails.length ? `${selectedMemberDetails.length} membro(s) selecionado(s)` : "Nenhum membro adicionado."}</Text></View><TouchableOpacity style={styles.secondaryButton} onPress={() => setMembersModal(true)}><Text style={styles.secondaryText}>Editar membros</Text></TouchableOpacity></View>
        <View style={styles.selectedList}>{selectedMemberDetails.map((entry) => <View key={entry.userId} style={styles.selectedChip}><Text style={styles.selectedChipTitle}>{entry.member?.name}</Text><Text style={styles.selectedChipMeta}>{entry.role}</Text></View>)}</View>
        <TouchableOpacity style={[styles.primaryButton, saving && styles.disabled]} onPress={() => void save()} disabled={saving}><Text style={styles.primaryText}>{saving ? "Salvando..." : "Salvar alterações"}</Text></TouchableOpacity>
        {canDeleteSchedules ? <View style={styles.dangerZone}>
          <Text style={styles.dangerTitle}>Área de perigo</Text>
          <Text style={styles.dangerText}>Excluir a escala remove o item das listas ativas e desativa suas atribuições relacionadas.</Text>
          <TouchableOpacity
            style={[styles.dangerButton, deleting && styles.disabled]}
            onPress={openDeleteModal}
            disabled={deleting}
            accessibilityRole="button"
            accessibilityLabel="Excluir escala"
          >
            <Text style={styles.dangerButtonText}>{deleting ? "Excluindo..." : "Excluir escala"}</Text>
          </TouchableOpacity>
        </View> : null}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { width: "100%", maxWidth: screen.listMaxWidth, alignSelf: "center", padding: spacing.xl, paddingBottom: screen.contentBottomPadding },
  containerCompact: { padding: spacing.md, paddingBottom: screen.contentBottomPadding },
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.background, padding: spacing.xl },
  backRow: { marginBottom: spacing.lg },
  title: { color: colors.ink, fontSize: 30, fontWeight: "900" },
  titleRow: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: spacing.md, marginBottom: spacing.lg },
  titleRowCompact: { flexDirection: "column" },
  titleGroup: { flex: 1 },
  subtitle: { color: colors.muted, fontSize: 15, fontWeight: "600", marginTop: spacing.xs, marginBottom: spacing.lg },
  exportActions: { flexDirection: "row", flexWrap: "wrap", justifyContent: "flex-end", gap: spacing.sm },
  exportActionsCompact: { width: "100%", justifyContent: "flex-start" },
  reportButton: { minHeight: 44, borderRadius: radii.md, backgroundColor: colors.primarySoft, borderWidth: 1, borderColor: colors.line, paddingHorizontal: spacing.md, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm },
  reportButtonText: { color: colors.primary, fontSize: 13, fontWeight: "900" },
  card: { backgroundColor: "transparent", borderTopWidth: 1, borderBottomWidth: 1, borderColor: colors.line, paddingVertical: spacing.lg },
  cardCompact: { paddingVertical: spacing.md },
  commentsEditor: { marginTop: spacing.md, marginBottom: spacing.md },
  label: { color: colors.text, fontSize: 13, fontWeight: "900", marginTop: spacing.md, marginBottom: spacing.sm },
  input: { minHeight: 44, borderWidth: 1, borderColor: colors.line, borderRadius: radii.md, backgroundColor: colors.surface, color: colors.ink, paddingHorizontal: spacing.md, fontSize: 15 },
  rowFields: { flexDirection: "row", gap: spacing.md },
  rowFieldsCompact: { flexDirection: "column" },
  field: { flex: 1 },
  fieldCompact: { width: "100%" },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  chip: { minHeight: 38, borderRadius: radii.pill, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surfaceMuted, justifyContent: "center", paddingHorizontal: spacing.md },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { color: colors.text, fontWeight: "800" },
  chipTextActive: { color: colors.surface },
  sectionHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.md, marginTop: spacing.xl, paddingTop: spacing.lg, borderTopWidth: 1, borderTopColor: colors.line },
  sectionHeaderCompact: { flexDirection: "column", alignItems: "stretch" },
  sectionText: { flex: 1 },
  sectionActions: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, justifyContent: "flex-end" },
  sectionActionsCompact: { justifyContent: "flex-start" },
  sectionTitle: { color: colors.ink, fontSize: 17, fontWeight: "900" },
  helper: { color: colors.muted, fontSize: 13, lineHeight: 19, marginTop: spacing.xs },
  secondaryButton: { minHeight: 44, borderRadius: radii.md, backgroundColor: colors.primarySoft, borderWidth: 1, borderColor: "#BFE7DE", justifyContent: "center", alignItems: "center", paddingHorizontal: spacing.md },
  secondaryText: { color: colors.primary, fontSize: 13, fontWeight: "900" },
  primaryButton: { minHeight: 44, marginTop: spacing.xl, borderRadius: radii.md, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center", paddingHorizontal: spacing.lg },
  primaryText: { color: colors.surface, fontSize: 14, fontWeight: "900" },
  disabled: { opacity: 0.65 },
  error: { color: colors.danger, fontSize: 13, fontWeight: "800", backgroundColor: colors.dangerSoft, padding: spacing.md, borderRadius: radii.md, marginBottom: spacing.md },
  selectedList: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, marginTop: spacing.md },
  selectedChip: { borderWidth: 1, borderColor: colors.line, borderRadius: radii.md, backgroundColor: colors.surfaceMuted, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  selectedChipTitle: { color: colors.ink, fontSize: 13, fontWeight: "900" },
  selectedChipMeta: { color: colors.muted, fontSize: 12, fontWeight: "700", marginTop: 2 },
  dangerZone: { marginTop: spacing.xl, borderWidth: 1, borderColor: colors.danger, borderRadius: radii.md, backgroundColor: colors.dangerSoft, padding: spacing.lg },
  dangerTitle: { color: colors.danger, fontSize: 16, fontWeight: "900", marginBottom: spacing.xs },
  dangerText: { color: colors.text, fontSize: 13, fontWeight: "600", lineHeight: 19, marginBottom: spacing.md },
  dangerButton: { minHeight: 46, borderRadius: radii.md, backgroundColor: colors.danger, alignItems: "center", justifyContent: "center", paddingHorizontal: spacing.lg, alignSelf: "flex-start" },
  dangerButtonText: { color: colors.surface, fontSize: 14, fontWeight: "900" },
  deleteModalBackdrop: { flex: 1, backgroundColor: "rgba(16, 32, 26, 0.56)", alignItems: "center", justifyContent: "center", padding: spacing.lg },
  deleteModalCard: { width: "100%", maxWidth: 500, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, borderRadius: radii.xl, padding: spacing.xl, ...shadow },
  deleteModalCardCompact: { padding: spacing.lg },
  deleteModalHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: spacing.md },
  deleteIconCircle: { width: 52, height: 52, borderRadius: 26, backgroundColor: colors.dangerSoft, borderWidth: 1, borderColor: colors.danger, alignItems: "center", justifyContent: "center" },
  deleteModalClose: { width: 44, height: 44, borderRadius: radii.pill, backgroundColor: colors.surfaceMuted, alignItems: "center", justifyContent: "center" },
  deleteModalTitle: { color: colors.ink, fontSize: 24, fontWeight: "900", marginBottom: spacing.xs },
  deleteModalScheduleName: { color: colors.danger, fontSize: 16, fontWeight: "900", marginBottom: spacing.md },
  deleteModalDescription: { color: colors.text, fontSize: 14, fontWeight: "600", lineHeight: 21 },
  deleteModalError: { marginTop: spacing.lg, borderWidth: 1, borderColor: colors.danger, borderRadius: radii.md, backgroundColor: colors.dangerSoft, padding: spacing.md },
  deleteModalErrorTitle: { color: colors.danger, fontSize: 13, fontWeight: "900", marginBottom: spacing.xs },
  deleteModalErrorText: { color: colors.text, fontSize: 13, fontWeight: "600", lineHeight: 19 },
  deleteModalActions: { flexDirection: "row", justifyContent: "flex-end", gap: spacing.sm, marginTop: spacing.xl },
  deleteModalActionsCompact: { flexDirection: "column-reverse" },
  deleteCancelButton: { minHeight: 48, borderRadius: radii.md, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surfaceMuted, alignItems: "center", justifyContent: "center", paddingHorizontal: spacing.lg },
  deleteCancelButtonText: { color: colors.text, fontSize: 14, fontWeight: "900" },
  deleteConfirmButton: { minHeight: 48, borderRadius: radii.md, backgroundColor: colors.danger, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm, paddingHorizontal: spacing.lg },
  deleteConfirmButtonText: { color: colors.surface, fontSize: 14, fontWeight: "900" },
  backdrop: { flex: 1, backgroundColor: "rgba(15, 23, 42, 0.46)", alignItems: "center", justifyContent: "center", padding: spacing.lg },
  modalCard: { width: "100%", maxWidth: 680, maxHeight: "88%", backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, borderRadius: radii.xl, padding: spacing.lg, ...shadow },
  modalHeaderRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.md },
  modalBackButton: { width: 40, height: 40, borderRadius: radii.pill, backgroundColor: colors.primarySoft, alignItems: "center", justifyContent: "center" },
  modalHeaderSpacer: { width: 40, height: 40 },
  modalTitle: { flex: 1, color: colors.ink, fontSize: 22, fontWeight: "900", textAlign: "center" },
  songSearchRow: { minHeight: 48, flexDirection: "row", alignItems: "center", gap: spacing.sm, marginTop: spacing.md, borderWidth: 1, borderColor: colors.line, borderRadius: radii.md, backgroundColor: colors.surfaceMuted, paddingHorizontal: spacing.md },
  songSearchInput: { flex: 1, minHeight: 46, color: colors.ink, fontSize: 15, outlineStyle: "none" } as any,
  songSearchError: { color: colors.danger, fontSize: 12, fontWeight: "700", marginTop: spacing.xs },
  modalList: { maxHeight: 440, marginTop: spacing.md },
  option: { borderWidth: 1, borderColor: colors.line, borderRadius: radii.md, backgroundColor: colors.surfaceMuted, padding: spacing.md, marginBottom: spacing.sm },
  optionSelected: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  optionTitleRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.md },
  optionTitle: { color: colors.ink, fontSize: 15, fontWeight: "900" },
  optionMeta: { color: colors.muted, fontSize: 12, fontWeight: "700", marginTop: spacing.xs },
  orderBadge: { minWidth: 26, height: 26, borderRadius: 13, overflow: "hidden", backgroundColor: colors.primary, color: colors.surface, textAlign: "center", lineHeight: 26, fontSize: 12, fontWeight: "900" },
  orderBadgeLarge: { width: 34, height: 34, borderRadius: 17, overflow: "hidden", backgroundColor: colors.primary, color: colors.surface, textAlign: "center", lineHeight: 34, fontSize: 14, fontWeight: "900" },
  orderItem: { borderWidth: 1, borderColor: colors.line, borderRadius: radii.md, backgroundColor: colors.surfaceMuted, padding: spacing.md, marginBottom: spacing.sm, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.md },
  orderItemDragging: { borderColor: colors.primary, backgroundColor: colors.primarySoft, opacity: 0.82 },
  orderItemMain: { flex: 1, flexDirection: "row", alignItems: "center", gap: spacing.md },
  orderItemText: { flex: 1 },
  orderActions: { flexDirection: "row", gap: spacing.xs },
  orderButton: { width: 38, height: 38, borderRadius: radii.md, backgroundColor: colors.primarySoft, borderWidth: 1, borderColor: "#BFE7DE", alignItems: "center", justifyContent: "center" },
  orderButtonText: { color: colors.primary, fontSize: 18, fontWeight: "900" },
  modalActions: { flexDirection: "row", justifyContent: "flex-end", gap: spacing.sm, marginTop: spacing.lg, flexWrap: "wrap" },
  modalActionSecondary: { minHeight: 48, borderRadius: radii.md, backgroundColor: colors.primarySoft, borderWidth: 1, borderColor: "#BFE7DE", alignItems: "center", justifyContent: "center", paddingHorizontal: spacing.lg },
  modalActionPrimary: { minHeight: 48, borderRadius: radii.md, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center", paddingHorizontal: spacing.lg },
  emptyText: { color: colors.muted, fontSize: 14, fontWeight: "800", paddingVertical: spacing.lg },
});
