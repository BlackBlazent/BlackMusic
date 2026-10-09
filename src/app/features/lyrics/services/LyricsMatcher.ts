import type { ActiveTrack } from "../types/lyrics.types";

/** Strips "(Official Video)", "[Remastered]", "feat. X" etc. so provider lookups hit. */
export function cleanTitle(title: string): string {
  return title
    .replace(/\s*[(\[][^)\]]*(official|video|audio|lyrics?|remaster(ed)?|live|hd|hq|mv|m\/v)[^)\]]*[)\]]/gi, "")
    .replace(/\s*[-–]\s*(official.*|lyrics?.*|remaster(ed)?.*)$/i, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function cleanArtist(artist: string): string {
  return artist.replace(/\s*(feat\.?|ft\.?|featuring)\s.*$/i, "").trim();
}

export function matchTrack(track: ActiveTrack): ActiveTrack {
  return { ...track, title: cleanTitle(track.title) || track.title, artist: cleanArtist(track.artist) || track.artist };
}
