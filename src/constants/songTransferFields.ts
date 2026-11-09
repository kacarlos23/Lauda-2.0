export const SONG_TRANSFER_FIELDS = [
  "originalKey",
  "content",
  "bpm",
  "cifraUrl",
  "letraUrl",
  "audioUrl",
  "videoUrl",
  "comments",
  "tags",
] as const;

export type SongTransferField = (typeof SONG_TRANSFER_FIELDS)[number];

/** Fields written when the request does not name any. Matches catalogs exported before field selection. */
export const LEGACY_SONG_TRANSFER_FIELDS = ["originalKey", "content", "cifraUrl", "tags"] as const satisfies readonly SongTransferField[];

export const SONG_TRANSFER_EXISTING_MODES = ["create", "update", "skip"] as const;
export type SongTransferExistingMode = (typeof SONG_TRANSFER_EXISTING_MODES)[number];
