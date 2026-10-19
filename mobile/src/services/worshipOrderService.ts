import { File, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";
import { Platform } from "react-native";
import { api } from "./api";
import { Schedule } from "../types";
import { AxiosError } from "axios";

import { worshipMoments } from "../utils/worshipOrder";
export { worshipMoments } from "../utils/worshipOrder";
export type WorshipMoment = typeof worshipMoments[number];
export type WorshipOrder = { date: string; churchName?: string | null; morning: Schedule | null; evening: Schedule | null };
export type WorshipOrderPayload = Record<"morning" | "evening", {
  scheduleId: string;
  songs: Array<{ songId: string; moment: string; momentDescription?: string | null; videoUrlOverride?: string | null }>;
} | null>;
const endpoint = (date: string) => `/schedules/worship-order/${date}`;

export const worshipOrderService = {
  async get(date: string): Promise<WorshipOrder | null> {
    return (await api.get<{ data: WorshipOrder | null }>(endpoint(date))).data.data;
  },
  async save(date: string, payload: WorshipOrderPayload): Promise<WorshipOrder> {
    return (await api.put<{ data: WorshipOrder }>(endpoint(date), payload)).data.data;
  },
  async exportPdf(date: string, preview = false): Promise<void> {
    // Open synchronously to retain the browser's user gesture during the API request.
    const target = Platform.OS === "web" && preview ? window.open("", "_blank") : null;
    if (Platform.OS === "web" && preview && !target) throw new Error("Permita pop-ups para visualizar o PDF.");
    try {
      const response = await api.get<ArrayBuffer>(`${endpoint(date)}/pdf`, { responseType: "arraybuffer" });
      const bytes = new Uint8Array(response.data);
      const filename = `Ordem_de_Culto_${date.split("-").reverse().join("-")}.pdf`;
      if (Platform.OS === "web") {
        const url = URL.createObjectURL(new Blob([bytes], { type: "application/pdf" }));
        if (target) target.location.href = url;
        else {
          const anchor = document.createElement("a");
          anchor.href = url; anchor.download = filename; anchor.click();
        }
        setTimeout(() => URL.revokeObjectURL(url), 60000);
      } else {
        const file = new File(Paths.cache, filename);
        file.create({ overwrite: true }); file.write(bytes);
        if (!await Sharing.isAvailableAsync()) throw new Error("Compartilhamento indisponível neste dispositivo.");
        await Sharing.shareAsync(file.uri, { mimeType: "application/pdf", UTI: "com.adobe.pdf", dialogTitle: "Ordem de Culto" });
      }
    } catch (error) {
      target?.close();
      if (error instanceof AxiosError && error.response?.data instanceof ArrayBuffer) {
        let message: string | undefined;
        try {
          const encoded = Array.from(new Uint8Array(error.response.data)).map((byte) => `%${byte.toString(16).padStart(2, "0")}`).join("");
          message = (JSON.parse(decodeURIComponent(encoded)) as { error?: string }).error;
        } catch { /* Preserve the original error when the response is not JSON. */ }
        if (message) throw new Error(message);
      }
      throw error;
    }
  },
};
