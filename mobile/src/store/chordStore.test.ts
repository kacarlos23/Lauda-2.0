import { useChordStore } from "./chordStore";

describe("chordStore", () => {
  it("adota o tom salvo e restaura/reabre sem duplicar a transposição", () => {
    const store = () => useChordStore.getState();
    store().initializeSong("song-1", "G");
    store().transpose(2);
    store().acceptDefaultKey("song-1", "A");
    expect(store()).toMatchObject({ originalKey: "A", currentKey: "A", semitoneOffset: 0 });
    store().transpose(-1);
    store().resetTranspose();
    expect(store().currentKey).toBe("A");
    store().initializeSong("song-2", "C");
    store().initializeSong("song-1", "A");
    expect(store()).toMatchObject({ currentKey: "A", semitoneOffset: 0 });
  });

  it("não altera a música ativa quando termina o salvamento de outra música", () => {
    useChordStore.getState().initializeSong("song-2", "D");
    useChordStore.getState().transpose(1);
    useChordStore.getState().acceptDefaultKey("song-1", "A");
    expect(useChordStore.getState()).toMatchObject({ activeSongId: "song-2", currentKey: "D#", semitoneOffset: 1, songOffsets: { "song-1": 0, "song-2": 1 } });
  });
  beforeEach(() => useChordStore.setState({ activeSongId: null, originalKey: "C", currentKey: "C", semitoneOffset: 0, fontSize: 16, scrollSpeed: 1, songOffsets: {} }));

  it("persiste a transposição por música durante a sessão", () => {
    useChordStore.getState().initializeSong("song-1", "G");
    useChordStore.getState().transpose(2);
    expect(useChordStore.getState().currentKey).toBe("A");
    useChordStore.getState().initializeSong("song-2", "C");
    useChordStore.getState().initializeSong("song-1", "G");
    expect(useChordStore.getState()).toMatchObject({ currentKey: "A", semitoneOffset: 2 });
  });

  it("limita fonte e velocidade a valores seguros", () => {
    useChordStore.getState().changeFontSize(100);
    useChordStore.getState().changeScrollSpeed(-100);
    expect(useChordStore.getState()).toMatchObject({ fontSize: 32, scrollSpeed: 0.5 });
  });

  it("reset limpa songOffsets e música ativa", () => {
    useChordStore.getState().initializeSong("song-1", "C");
    useChordStore.getState().transpose(3);
    useChordStore.getState().reset();
    expect(useChordStore.getState()).toMatchObject({
      activeSongId: null,
      originalKey: "C",
      currentKey: "C",
      semitoneOffset: 0,
      songOffsets: {},
    });
  });

  it("persiste e restaura preferências e transposições via localStorage", () => {
    const storage = new Map<string, string>();
    const previousWindow = (globalThis as { window?: unknown }).window;
    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: {
        localStorage: {
          getItem: (key: string) => storage.get(key) ?? null,
          setItem: (key: string, value: string) => storage.set(key, value),
        },
      },
    });
    try {
      jest.resetModules();
      const firstStore = require("./chordStore").useChordStore as typeof useChordStore;
      firstStore.getState().initializeSong("song-9", "D");
      firstStore.getState().transpose(2);
      firstStore.getState().changeFontSize(4);

      jest.resetModules();
      const restoredStore = require("./chordStore").useChordStore as typeof useChordStore;
      restoredStore.getState().initializeSong("song-9", "D");
      expect(restoredStore.getState()).toMatchObject({
        fontSize: 20,
        semitoneOffset: 2,
        currentKey: "E",
      });
    } finally {
      Object.defineProperty(globalThis, "window", {
        configurable: true,
        value: previousWindow,
      });
    }
  });
});

