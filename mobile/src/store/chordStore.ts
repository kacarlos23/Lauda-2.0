import { create } from "zustand";
import { transposeKey } from "../utils/chordEngine";

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
  changeFontSize: (delta: number) => void;
  changeScrollSpeed: (delta: number) => void;
};

export const useChordStore = create<ChordState>((set) => ({
  activeSongId: null,
  originalKey: "C",
  currentKey: "C",
  semitoneOffset: 0,
  fontSize: 16,
  scrollSpeed: 1,
  songOffsets: {},
  initializeSong: (songId, originalKey) => set((state) => {
    const offset = state.songOffsets[songId] ?? 0;
    return { activeSongId: songId, originalKey, semitoneOffset: offset, currentKey: transposeKey(originalKey, offset) };
  }),
  transpose: (delta) => set((state) => {
    if (!state.activeSongId) return state;
    const offset = Math.max(-11, Math.min(11, state.semitoneOffset + delta));
    return {
      semitoneOffset: offset,
      currentKey: transposeKey(state.originalKey, offset),
      songOffsets: { ...state.songOffsets, [state.activeSongId]: offset },
    };
  }),
  resetTranspose: () => set((state) => ({
    semitoneOffset: 0,
    currentKey: state.originalKey,
    songOffsets: state.activeSongId ? { ...state.songOffsets, [state.activeSongId]: 0 } : state.songOffsets,
  })),
  changeFontSize: (delta) => set((state) => ({ fontSize: Math.max(12, Math.min(32, state.fontSize + delta)) })),
  changeScrollSpeed: (delta) => set((state) => ({ scrollSpeed: Math.max(0.5, Math.min(3, Math.round((state.scrollSpeed + delta) * 100) / 100)) })),
}));
