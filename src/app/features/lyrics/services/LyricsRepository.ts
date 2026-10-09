import type { ActiveTrack, LyricsDocument, LyricsProvider } from "../types/lyrics.types";
import { LyricsCache } from "./LyricsCache";

/** Cache first, then providers in priority order; first hit is saved locally. */
export class LyricsRepository {
  constructor(private readonly cache: LyricsCache, private readonly providers: LyricsProvider[]) {}

  async load(track: ActiveTrack): Promise<LyricsDocument | null> {
    const cached = await this.cache.get(track);
    if (cached) return cached;

    for (const provider of this.providers) {
      try {
        const results = await provider.searchTrack(track);
        for (const result of results.slice(0, 2)) {
          const doc = await provider.fetchLyrics(result, track);
          if (doc) {
            const normalized = { ...doc, trackId: track.id };
            await this.cache.save(track, normalized);
            return normalized;
          }
        }
      } catch {
        /* provider down / offline — try the next one */
      }
    }
    return null;
  }
}
