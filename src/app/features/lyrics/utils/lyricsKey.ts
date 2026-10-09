import type { ActiveTrack } from "../types/lyrics.types";

/** Stable per-track key; local files use their library id so a rename of tags doesn't orphan the cache. */
export function createLyricsKey(track: ActiveTrack): string {
  const base = track.path ? track.id : `${track.artist}:${track.title}`;
  return base.toLowerCase().trim().replace(/\s+/g, " ");
}

/** Filesystem-safe version of the key. */
export function lyricsFileStem(track: ActiveTrack): string {
  const key = createLyricsKey(track);
  let hash = 5381;
  for (let i = 0; i < key.length; i += 1) hash = ((hash << 5) + hash + key.charCodeAt(i)) >>> 0;
  const readable = `${track.artist}-${track.title}`.replace(/[^\p{L}\p{N}]+/gu, "_").slice(0, 60);
  return `${readable}_${hash.toString(36)}`;
}
