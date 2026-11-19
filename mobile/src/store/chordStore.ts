import { fontSizes } from "../tokens/primitives";
import { create } from "zustand";
import { transposeKey } from "../utils/chordEngine";

const CHORD_PREFERENCES_STORAGE_KEY = "lauda.chord.preferences.v1";

type PersistedChordPreferences = {
  fontSize: number;
  scrollSpeed: number;
  songOffsets: Record<string, number>;
};

function clampFontSize(value: number): number {
  return Math.max(12, Math.min(32, value));
}

function clampScrollSpeed(value: number): number {
  return Math.max(0.5, Math.min(3, Math.round(value * 100) / 100));
}

function clampOffset(value: number): number {
  return Math.max(-11, Math.min(11, Math.trunc(value)));
}

function readPersistedChordPreferences(): PersistedChordPreferences {
  const defaults: PersistedChordPreferences = {
    fontSize: fontSizes.s16,
    scrollSpeed: 1,
    songOffsets: {},
  };
  if (typeof window === "undefined" || !window.localStorage) {
    return defaults;
  }

  try {
    const raw = window.localStorage.getItem(CHORD_PREFERENCES_STORAGE_KEY);
    if (!raw) return defaults;
    const parsed = JSON.parse(raw) as Partial<PersistedChordPreferences>;
    const songOffsets: Record<string, number> = {};
    if (parsed.songOffsets && typeof parsed.songOffsets === "object") {
      for (const [songId, offset] of Object.entries(parsed.songOffsets)) {
        if (typeof offset === "number" && Number.isFinite(offset)) {
          songOffsets[songId] = clampOffset(offset);
        }
      }
    }
    return {
      fontSize: typeof parsed.fontSize === "number" && Number.isFinite(parsed.fontSize)
        ? clampFontSize(parsed.fontSize)
        : defaults.fontSize,
      scrollSpeed: typeof parsed.scrollSpeed === "number" && Number.isFinite(parsed.scrollSpeed)
        ? clampScrollSpeed(parsed.scrollSpeed)
        : defaults.scrollSpeed,
      songOffsets,
    };
  } catch {
    return defaults;
  }
}

function writePersistedChordPreferences(preferences: PersistedChordPreferences): void {
  if (typeof window === "undefined" || !window.localStorage) {
    return;
  }
  try {
    window.localStorage.setItem(CHORD_PREFERENCES_STORAGE_KEY, JSON.stringify(preferences));
  } catch {
    // Storage failures must never interrupt chord viewing or transposition.
  }
}

type ChordState = {
  activeSongId: string | null;
  originalKey: string;
  currentKey: string;
  semitoneOffset: number;
  fontSize: number;
  scrollSpeed: number;
  songOffsets: Record<string, number>;
  initializeSong: (songId: string, originalKey: string) => void;
  transpose: (delta: number) => void;
  resetTranspose: () => void;
  acceptDefaultKey: (songId: string, key: string) => void;
  changeFontSize: (delta: number) => void;
  changeScrollSpeed: (delta: number) => void;
  reset: () => void;
};

const initialPreferences = readPersistedChordPreferences();

export const useChordStore = create<ChordState>((set, get) => ({
  activeSongId: null,
  originalKey: "C",
  currentKey: "C",
  semitoneOffset: 0,
  fontSize: initialPreferences.fontSize,
  scrollSpeed: initialPreferences.scrollSpeed,
  songOffsets: initialPreferences.songOffsets,
  initializeSong: (songId, originalKey) => set((state) => {
    const offset = state.songOffsets[songId] ?? 0;
    return { activeSongId: songId, originalKey, semitoneOffset: offset, currentKey: transposeKey(originalKey, offset) };
  }),
  transpose: (delta) => set((state) => {
    if (!state.activeSongId) return state;
    const offset = clampOffset(state.semitoneOffset + delta);
    const songOffsets = { ...state.songOffsets, [state.activeSongId]: offset };
    writePersistedChordPreferences({ fontSize: state.fontSize, scrollSpeed: state.scrollSpeed, songOffsets });
    return {
      semitoneOffset: offset,
      currentKey: transposeKey(state.originalKey, offset),
      songOffsets,
    };
  }),
  resetTranspose: () => set((state) => {
    const songOffsets = state.activeSongId ? { ...state.songOffsets, [state.activeSongId]: 0 } : state.songOffsets;
    writePersistedChordPreferences({ fontSize: state.fontSize, scrollSpeed: state.scrollSpeed, songOffsets });
    return {
      semitoneOffset: 0,
      currentKey: state.originalKey,
      songOffsets,
    };
  }),
  acceptDefaultKey: (songId, key) => set((state) => {
    const songOffsets = { ...state.songOffsets, [songId]: 0 };
    writePersistedChordPreferences({ fontSize: state.fontSize, scrollSpeed: state.scrollSpeed, songOffsets });
    return {
      songOffsets,
      ...(state.activeSongId === songId ? { originalKey: key, currentKey: key, semitoneOffset: 0 } : {}),
    };
  }),
  changeFontSize: (delta) => set((state) => {
    const fontSize = clampFontSize(state.fontSize + delta);
    writePersistedChordPreferences({ fontSize, scrollSpeed: state.scrollSpeed, songOffsets: state.songOffsets });
    return { fontSize };
  }),
  changeScrollSpeed: (delta) => set((state) => {
    const scrollSpeed = clampScrollSpeed(state.scrollSpeed + delta);
    writePersistedChordPreferences({ fontSize: state.fontSize, scrollSpeed, songOffsets: state.songOffsets });
    return { scrollSpeed };
  }),
  reset: () => {
    const { fontSize, scrollSpeed } = get();
    writePersistedChordPreferences({ fontSize, scrollSpeed, songOffsets: {} });
    set({
      activeSongId: null,
      originalKey: "C",
      currentKey: "C",
      semitoneOffset: 0,
      songOffsets: {},
    });
  },
}));

