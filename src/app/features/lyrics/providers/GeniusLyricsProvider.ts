import { serviceJson } from "@/lib/services/serviceFetch";
import type { ActiveTrack, LyricsDocument, LyricsProvider, LyricsSearchResult } from "../types/lyrics.types";
import { LrclibLyricsProvider } from "./LrclibLyricsProvider";

interface GeniusSearch {
  response?: { hits?: { type: string; result: { id: number; title: string; url: string; song_art_image_thumbnail_url?: string; primary_artist: { name: string } } }[] };
}

/**
 * Genius, used the way its public API allows: SEARCH + metadata (canonical title/artist, song page).
 * Genius has no endpoint that returns full lyric text and scraping its HTML is both brittle and
 * against its terms, so this provider deliberately does NOT scrape. After Genius identifies the
 * song, the lyric TEXT comes from LRCLIB (an open lyrics API that also offers time-synced lines),
 * and the Genius song page is kept as `sourceUrl` so the UI can link to it.
 * Needs VITE_GENIUS_ACCESS_TOKEN (a client access token — never the client secret).
 */
export class GeniusLyricsProvider implements LyricsProvider {
  readonly name = "genius";
  private readonly text = new LrclibLyricsProvider();

  async searchTrack(track: ActiveTrack): Promise<LyricsSearchResult[]> {
    const token = import.meta.env.VITE_GENIUS_ACCESS_TOKEN;
    if (!token) return [];
    const q = encodeURIComponent(`${track.title} ${track.artist === "Unknown artist" ? "" : track.artist}`.trim());
    const data = await serviceJson<GeniusSearch>(`https://api.genius.com/search?q=${q}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return (data.response?.hits ?? [])
      .filter((h) => h.type === "song")
      .slice(0, 5)
      .map((h) => ({ id: String(h.result.id), title: h.result.title, artist: h.result.primary_artist.name, url: h.result.url, thumbnail: h.result.song_art_image_thumbnail_url }));
  }

  async fetchLyrics(result: LyricsSearchResult, track: ActiveTrack): Promise<LyricsDocument | null> {
    const attempts: ActiveTrack[] = [{ ...track, title: result.title, artist: result.artist }, track];
    for (const attempt of attempts) {
      const doc = await this.text.fetchByTrack(attempt);
      if (doc) return { ...doc, provider: "genius", sourceUrl: result.url, title: track.title, artist: track.artist };
    }
    return null;
  }
}
