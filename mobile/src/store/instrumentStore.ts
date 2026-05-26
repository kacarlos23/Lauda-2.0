import { create } from "zustand";
import { Instrument } from "../types";
import {
  CreateInstrumentPayload,
  instrumentService,
  UpdateInstrumentPayload,
} from "../services/instrumentService";

interface InstrumentState {
  instruments: Instrument[];
  loading: boolean;
  saving: boolean;
  deletingId: string | null;
  error: string | null;

  loadInstruments: () => Promise<void>;
  createInstrument: (payload: CreateInstrumentPayload) => Promise<void>;
  updateInstrument: (id: string, payload: UpdateInstrumentPayload) => Promise<void>;
  deleteInstrument: (id: string) => Promise<void>;
  clearError: () => void;
}

function getErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

function sortByName(instruments: Instrument[]): Instrument[] {
  return [...instruments].sort((a, b) => a.name.localeCompare(b.name, "pt-BR", { sensitivity: "base" }));
}

export const useInstrumentStore = create<InstrumentState>((set, get) => ({
  instruments: [],
  loading: false,
  saving: false,
  deletingId: null,
  error: null,

  clearError: () => set({ error: null }),

  loadInstruments: async () => {
    set({ loading: true, error: null });
    try {
      const instruments = await instrumentService.getInstruments();
      set({ instruments: sortByName(instruments), loading: false });
    } catch (error) {
      set({
        error: getErrorMessage(error, "Nao foi possivel carregar instrumentos."),
        loading: false,
      });
    }
  },

  createInstrument: async (payload) => {
    set({ saving: true, error: null });
    try {
      const created = await instrumentService.createInstrument(payload);
      set({
        instruments: sortByName([...get().instruments, created]),
        saving: false,
      });
    } catch (error) {
      set({
        error: getErrorMessage(error, "Nao foi possivel criar o instrumento."),
        saving: false,
      });
    }
  },

  updateInstrument: async (id, payload) => {
    set({ saving: true, error: null });
    try {
      const updated = await instrumentService.updateInstrument(id, payload);
      set({
        instruments: sortByName(get().instruments.map((item) => (item.id === id ? updated : item))),
        saving: false,
      });
    } catch (error) {
      set({
        error: getErrorMessage(error, "Nao foi possivel atualizar o instrumento."),
        saving: false,
      });
    }
  },

  deleteInstrument: async (id) => {
    set({ deletingId: id, error: null });
    try {
      await instrumentService.deleteInstrument(id);
      set({
        instruments: get().instruments.filter((item) => item.id !== id),
        deletingId: null,
      });
    } catch (error) {
      set({
        error: getErrorMessage(error, "Nao foi possivel excluir o instrumento."),
        deletingId: null,
      });
    }
  },
}));
