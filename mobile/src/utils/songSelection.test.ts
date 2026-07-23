import { Song } from "../types";
import {
  reconcileSongSelection,
  songSelectionSnapshot,
  toggleSongPageSelection,
  toggleSongSelection,
} from "./songSelection";

function song(index: number, overrides: Partial<Song> = {}): Song {
  return {
    id: `song-${index}`,
    title: `Música ${index}`,
    originalKey: "C",
    content: "[C]Letra",
    artistId: `artist-${index}`,
    artist: { id: `artist-${index}`, name: `Artista ${index}`, imageUrl: null },
    createdAt: "2026-01-01",
    updatedAt: "2026-01-01",
    ...overrides,
  };
}

describe("songSelection", () => {
  it("recusa seleção individual quando o limite foi atingido", () => {
    const selected = new Map(Array.from({ length: 50 }, (_, index) => {
      const item = song(index);
      return [item.id, songSelectionSnapshot(item)];
    }));

    const result = toggleSongSelection(selected, song(51));

    expect(result.limitReached).toBe(true);
    expect(result.selection).toBe(selected);
    expect(result.selection.size).toBe(50);
  });

  it("preenche somente as vagas restantes seguindo a ordem visível", () => {
    const selected = new Map(Array.from({ length: 38 }, (_, index) => {
      const item = song(index);
      return [item.id, songSelectionSnapshot(item)];
    }));
    const page = Array.from({ length: 20 }, (_, index) => song(index + 100));

    const result = toggleSongPageSelection(selected, page);

    expect(result).toMatchObject({ action: "selected", candidates: 20, added: 12 });
    expect(result.selection.size).toBe(50);
    expect(Array.from(result.selection.keys()).slice(-12)).toEqual(page.slice(0, 12).map((item) => item.id));
  });

  it("desmarca somente a página quando todos os itens visíveis estão selecionados", () => {
    const outside = song(1);
    const page = [song(2), song(3)];
    const selected = new Map([outside, ...page].map((item) => [item.id, songSelectionSnapshot(item)]));

    const result = toggleSongPageSelection(selected, page);

    expect(result.action).toBe("deselected");
    expect(Array.from(result.selection.keys())).toEqual([outside.id]);
  });

  it("atualiza snapshots quando uma música selecionada reaparece", () => {
    const original = song(1);
    const selected = new Map([[original.id, songSelectionSnapshot(original)]]);
    const updated = song(1, { title: "Título atualizado", originalKey: "D", artist: { ...original.artist, name: "Artista atualizado" } });

    const reconciled = reconcileSongSelection(selected, [updated]);

    expect(reconciled.get(original.id)).toMatchObject({
      title: "Título atualizado",
      originalKey: "D",
      artist: { name: "Artista atualizado" },
    });
    expect(reconcileSongSelection(reconciled, [updated])).toBe(reconciled);
  });
});
