import { MusicalKey, Song } from "../types";

export const MAX_SONG_SELECTION = 50;

export type SongSelectionSnapshot = {
  id: string;
  title: string;
  originalKey: MusicalKey;
  artist: { id: string; name: string; imageUrl?: string | null };
};

export function songSelectionSnapshot(song: Song): SongSelectionSnapshot {
  return {
    id: song.id,
    title: song.title,
    originalKey: song.originalKey,
    artist: {
      id: song.artist.id,
      name: song.artist.name,
      imageUrl: song.artist.imageUrl,
    },
  };
}

function snapshotChanged(left: SongSelectionSnapshot, right: SongSelectionSnapshot): boolean {
  return left.title !== right.title
    || left.originalKey !== right.originalKey
    || left.artist.id !== right.artist.id
    || left.artist.name !== right.artist.name
    || left.artist.imageUrl !== right.artist.imageUrl;
}

export function reconcileSongSelection(
  current: Map<string, SongSelectionSnapshot>,
  visibleSongs: Song[]
): Map<string, SongSelectionSnapshot> {
  let next: Map<string, SongSelectionSnapshot> | null = null;
  visibleSongs.forEach((song) => {
    const existing = current.get(song.id);
    if (!existing) return;
    const updated = songSelectionSnapshot(song);
    if (!snapshotChanged(existing, updated)) return;
    if (!next) next = new Map(current);
    next.set(song.id, updated);
  });
  return next ?? current;
}

export function toggleSongSelection(
  current: Map<string, SongSelectionSnapshot>,
  song: Song,
  limit = MAX_SONG_SELECTION
): { selection: Map<string, SongSelectionSnapshot>; limitReached: boolean } {
  const next = new Map(current);
  if (next.has(song.id)) {
    next.delete(song.id);
    return { selection: next, limitReached: false };
  }
  if (next.size >= limit) return { selection: current, limitReached: true };
  next.set(song.id, songSelectionSnapshot(song));
  return { selection: next, limitReached: false };
}

export function toggleSongPageSelection(
  current: Map<string, SongSelectionSnapshot>,
  visibleSongs: Song[],
  limit = MAX_SONG_SELECTION
): {
  selection: Map<string, SongSelectionSnapshot>;
  action: "selected" | "deselected" | "none";
  candidates: number;
  added: number;
} {
  if (!visibleSongs.length) return { selection: current, action: "none", candidates: 0, added: 0 };
  const next = new Map(current);
  if (visibleSongs.every((song) => next.has(song.id))) {
    visibleSongs.forEach((song) => next.delete(song.id));
    return { selection: next, action: "deselected", candidates: visibleSongs.length, added: 0 };
  }

  const candidates = visibleSongs.filter((song) => !next.has(song.id));
  const additions = candidates.slice(0, Math.max(0, limit - next.size));
  additions.forEach((song) => next.set(song.id, songSelectionSnapshot(song)));
  return { selection: next, action: "selected", candidates: candidates.length, added: additions.length };
}
