import { AxiosError } from "axios";
import { File, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";
import { Platform } from "react-native";
import { api } from "./api";
import { AssignmentStatus, Schedule, ScheduleAssignment } from "../types";
import { printTheme } from "../tokens/print";

type ApiResponse<T> = {
  success: boolean;
  data: T;
};

function handleApiError(error: unknown): never {
  if (error instanceof AxiosError) {
    const data = error.response?.data as { error?: string; message?: string } | undefined;
    throw new Error(data?.error ?? data?.message ?? "Não foi possível carregar as escalas.");
  }

  if (error instanceof Error) {
    throw error;
  }

  throw new Error("Não foi possível carregar as escalas.");
}

function assertAssignmentStatus(status: AssignmentStatus): void {
  if (!["PENDING", "ACCEPTED", "DECLINED"].includes(status)) {
    throw new Error("Status de escala inválido.");
  }
}

function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function assignmentStatusLabel(status?: AssignmentStatus | string): string {
  const labels: Record<string, string> = {
    PENDING: "Pendente",
    ACCEPTED: "Confirmado",
    DECLINED: "Recusado",
  };
  return status ? labels[status] ?? status : "Pendente";
}

function formatScheduleReportHtml(schedule: Schedule): string {
  const date = new Date(schedule.date);
  const dateText = new Intl.DateTimeFormat("pt-BR", { weekday: "long", day: "2-digit", month: "long", year: "numeric" }).format(date);
  const timeText = new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit" }).format(date);
  const songs = [...(schedule.songs ?? [])].sort((first, second) => first.order - second.order);
  const assignments = schedule.assignments ?? [];

  return `<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(schedule.title)} - Relatório de Escala</title>
  <style>
    @page { size: A4; margin: ${printTheme.layout.pageMargin}; }
    * { box-sizing: border-box; }
    body { margin: 0; background: ${printTheme.colors.canvas}; color: ${printTheme.colors.ink}; font-family: ${printTheme.fontFamily}; }
    main { width: 100%; max-width: ${printTheme.layout.pageMaxWidth}; margin: 0 auto; padding: ${printTheme.spacing.page}; background: ${printTheme.colors.surface}; min-height: 100vh; }
    h1 { margin: 0; text-align: center; font-size: ${printTheme.fontSizes.reportTitle}px; line-height: ${printTheme.lineHeights.title}; font-weight: ${printTheme.fontWeights.black}; }
    h2 { margin: ${printTheme.spacing.title}; text-align: center; color: ${printTheme.colors.primary}; font-size: ${printTheme.fontSizes.title}px; line-height: ${printTheme.lineHeights.heading}; }
    .summary { border: 1px solid ${printTheme.colors.line}; background: ${printTheme.colors.soft}; border-radius: ${printTheme.radii.summary}px; padding: ${printTheme.spacing.summary}px; margin: 0 0 ${printTheme.spacing.summaryBottom}px; font-size: ${printTheme.fontSizes.summary}px; line-height: ${printTheme.lineHeights.summary}; }
    .section-title { font-size: ${printTheme.fontSizes.section}px; font-weight: ${printTheme.fontWeights.black}; margin: ${printTheme.spacing.section}; padding-bottom: ${printTheme.spacing.sectionBottom}px; border-bottom: 2px solid ${printTheme.colors.line}; }
    .song { border: 1px solid ${printTheme.colors.line}; border-radius: ${printTheme.radii.song}px; padding: ${printTheme.spacing.song}; margin-bottom: ${printTheme.spacing.songBottom}px; break-inside: avoid; }
    .song-title { font-size: ${printTheme.fontSizes.song}px; font-weight: ${printTheme.fontWeights.black}; margin-bottom: ${printTheme.spacing.songTitleBottom}px; }
    .song-meta { color: ${printTheme.colors.primary}; font-size: ${printTheme.fontSizes.metadata}px; }
    .member { margin-bottom: ${printTheme.spacing.memberBottom}px; break-inside: avoid; }
    .member-line { font-size: ${printTheme.fontSizes.member}px; }
    .member-name { font-weight: 900; }
    .member-status { color: ${printTheme.colors.muted}; font-size: ${printTheme.fontSizes.body}px; margin-top: ${printTheme.spacing.memberStatusTop}px; }
    .empty { color: ${printTheme.colors.muted}; font-size: ${printTheme.fontSizes.metadata}px; }
    footer { position: fixed; bottom: ${printTheme.layout.footerBottom}; left: 0; right: 0; text-align: center; color: ${printTheme.colors.muted}; font-size: ${printTheme.fontSizes.footer}px; }
    @media print { body { background: ${printTheme.colors.surface}; } main { padding: 0; max-width: none; } }
  </style>
</head>
<body>
  <main>
    <h1>Relatório de Escala</h1>
    <h2>${escapeHtml(schedule.title)}</h2>
    <section class="summary">
      <div><strong>Ministério:</strong> ${escapeHtml(schedule.ministry?.name ?? "Não informado")}</div>
      <div><strong>Data:</strong> ${escapeHtml(dateText)}</div>
      <div><strong>Horário:</strong> ${escapeHtml(timeText)}</div>
    </section>

    <section>
      <div class="section-title">Músicas da escala</div>
      ${songs.length ? songs.map((entry, index) => {
        const song = entry.song;
        const bpm = song.bpm ? ` · ${song.bpm} BPM` : "";
        return `<article class="song">
          <div class="song-title">${index + 1}. ${escapeHtml(song.title)}</div>
          <div class="song-meta">${escapeHtml(song.artist?.name ?? "Artista não informado")} · Tom ${escapeHtml(song.originalKey)}${escapeHtml(bpm)}</div>
        </article>`;
      }).join("") : `<p class="empty">Nenhuma música adicionada.</p>`}
    </section>

    <section>
      <div class="section-title">Membros escalados</div>
      ${assignments.length ? assignments.map((assignment) => `<article class="member">
        <div class="member-line"><span class="member-name">${escapeHtml(assignment.user?.name ?? "Membro")}</span> — ${escapeHtml(assignment.role)}</div>
        <div class="member-status">Status: ${escapeHtml(assignmentStatusLabel(assignment.status))}</div>
      </article>`).join("") : `<p class="empty">Nenhum membro escalado.</p>`}
    </section>
  </main>
  <footer>Lauda</footer>
  <script>
    window.addEventListener("load", () => setTimeout(() => window.print(), 250));
  </script>
</body>
</html>`;
}

function openWebScheduleReport(schedule: Schedule): void {
  const target = window.open("", "_blank");
  if (!target) {
    throw new Error("Não foi possível abrir o relatório. Verifique se o navegador bloqueou pop-ups.");
  }
  target.document.open();
  target.document.write(formatScheduleReportHtml(schedule));
  target.document.close();
}

export type ScheduleListParams = {
  search?: string;
  ministryId?: string;
  status?: AssignmentStatus | string;
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  limit?: number;
};

export const scheduleService = {
  async listSchedules(params?: ScheduleListParams): Promise<Schedule[]> {
    try {
      const response = params
        ? await api.get<ApiResponse<Schedule[]>>("/schedules", { params })
        : await api.get<ApiResponse<Schedule[]>>("/schedules");
      return response.data.data;
    } catch (error) {
      handleApiError(error);
    }
  },

  async getMySchedules(params?: ScheduleListParams): Promise<ScheduleAssignment[]> {
    try {
      const response = params
        ? await api.get<ApiResponse<ScheduleAssignment[]>>("/schedules/me", { params })
        : await api.get<ApiResponse<ScheduleAssignment[]>>("/schedules/me");
      return response.data.data;
    } catch (error) {
      handleApiError(error);
    }
  },

  async createSchedule(payload: {
    title: string;
    date: string;
    comments?: string | null;
    ministryId: string;
    songIds: string[];
    assignments: Array<{ userId: string; role: string }>;
  }): Promise<Schedule> {
    try {
      const response = await api.post<ApiResponse<Schedule>>("/schedules", payload);
      return response.data.data;
    } catch (error) {
      handleApiError(error);
    }
  },

  async updateSchedule(id: string, payload: {
    title: string;
    date: string;
    comments?: string | null;
    ministryId: string;
    songIds: string[];
    assignments: Array<{ userId: string; role: string }>;
  }): Promise<Schedule> {
    try {
      const response = await api.patch<ApiResponse<Schedule>>(`/schedules/${id}`, payload);
      return response.data.data;
    } catch (error) {
      handleApiError(error);
    }
  },

  async deleteSchedule(id: string): Promise<{ id: string; message?: string }> {
    try {
      const response = await api.delete<ApiResponse<{ id: string; message?: string }>>(`/schedules/${id}`);
      return response.data.data;
    } catch (error) {
      handleApiError(error);
    }
  },

  async updateAssignmentStatus(
    scheduleId: string,
    assignmentId: string,
    status: AssignmentStatus,
    options?: { declineReason?: string; requestSubstitute?: boolean }
  ): Promise<ScheduleAssignment> {
    assertAssignmentStatus(status);

    try {
      const response = await api.patch<ApiResponse<ScheduleAssignment>>(
        `/schedules/${scheduleId}/assignments/${assignmentId}/status`,
        { status, ...options }
      );
      return response.data.data;
    } catch (error) {
      handleApiError(error);
    }
  },

  async resolveSubstitution(scheduleId: string, assignmentId: string, note?: string): Promise<ScheduleAssignment> {
    try {
      const response = await api.patch<ApiResponse<ScheduleAssignment>>(
        `/schedules/${scheduleId}/assignments/${assignmentId}/substitution/resolve`,
        { note }
      );
      return response.data.data;
    } catch (error) {
      handleApiError(error);
    }
  },

  async exportScheduleReport(scheduleId: string, filename: string, schedule?: Schedule): Promise<void> {
    try {
      if (Platform.OS === "web" && schedule) {
        openWebScheduleReport(schedule);
        return;
      }

      const response = await api.get<ArrayBuffer>(`/schedules/${scheduleId}/report`, { responseType: "arraybuffer" });
      const bytes = new Uint8Array(response.data);

      if (Platform.OS === "web") {
        const blob = new Blob([bytes], { type: "application/pdf" });
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement("a");
        anchor.href = url;
        anchor.download = filename;
        anchor.click();
        URL.revokeObjectURL(url);
        return;
      }

      const file = new File(Paths.cache, filename);
      file.create({ overwrite: true });
      file.write(bytes);
      if (!await Sharing.isAvailableAsync()) throw new Error("Compartilhamento não disponível neste dispositivo.");
      await Sharing.shareAsync(file.uri, { mimeType: "application/pdf", UTI: "com.adobe.pdf", dialogTitle: "Exportar relatório de escala" });
    } catch (error) {
      handleApiError(error);
    }
  },
};

export const getMySchedules = scheduleService.getMySchedules;
export const updateAssignmentStatus = scheduleService.updateAssignmentStatus;
