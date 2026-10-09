import { serviceFetch } from "@/lib/services/serviceFetch";
import type { ActiveTrack, LyricsDocument, LyricsProvider, LyricsSearchResult } from "../types/lyrics.types";
import { parseLrc, parsePlain } from "../utils/lyricsNormalizer";

interface LrclibResponse {
  id: number;
  trackName: string;
  artistName: string;
  plainLyrics?: string | null;
  syncedLyrics?: string | null;
}

/** LRCLIB — open lyrics database, no key needed, returns plain AND time-synced lyrics. */
export class LrclibLyricsProvider implements LyricsProvider {
  readonly name = "lrclib";

  async searchTrack(track: ActiveTrack): Promise<LyricsSearchResult[]> {
    const params = new URLSearchParams({ track_name: track.title, artist_name: track.artist });
    const response = await serviceFetch(`https://lrclib.net/api/search?${params}`);
    if (!response.ok) return [];
    const rows = (await response.json()) as LrclibResponse[];
    return rows.slice(0, 5).map((r) => ({ id: String(r.id), title: r.trackName, artist: r.artistName }));
  }

  async fetchLyrics(result: LyricsSearchResult, track: ActiveTrack): Promise<LyricsDocument | null> {
    const response = await serviceFetch(`https://lrclib.net/api/get/${encodeURIComponent(result.id)}`);
    if (!response.ok) return null;
    return this.toDocument((await response.json()) as LrclibResponse, track);
  }

  /** Exact-match lookup by tags + duration (LRCLIB's preferred, most accurate path). */
  async fetchByTrack(track: ActiveTrack): Promise<LyricsDocument | null> {
    const params = new URLSearchParams({ track_name: track.title, artist_name: track.artist });
    if (track.album && track.album !== "Unknown album") params.set("album_name", track.album);
    if (track.duration) params.set("duration", String(Math.round(track.duration)));
    const response = await serviceFetch(`https://lrclib.net/api/get?${params}`);
    if (response.ok) return this.toDocument((await response.json()) as LrclibResponse, track);
    const [first] = await this.searchTrack(track);
    return first ? this.fetchLyrics(first, track) : null;
  }

  private toDocument(row: LrclibResponse, track: ActiveTrack): LyricsDocument | null {
    const synced = row.syncedLyrics ? parseLrc(row.syncedLyrics) : [];
    const lines = synced.length > 0 ? synced : row.plainLyrics ? parsePlain(row.plainLyrics) : [];
    if (lines.length === 0) return null;
    return { trackId: track.id, title: track.title, artist: track.artist, provider: "lrclib", fetchedAt: Date.now(), synced: synced.length > 0, lines };
  }
}
