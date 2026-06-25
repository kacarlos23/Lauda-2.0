import { useChordStore } from "./chordStore";

describe("chordStore", () => {
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
});
