import type { ActiveTrack, LyricsDocument } from "../types/lyrics.types";
import { LyricsCache } from "./LyricsCache";
import { LyricsRepository } from "./LyricsRepository";
import { matchTrack } from "./LyricsMatcher";
import { LocalLyricsProvider } from "../providers/LocalLyricsProvider";
import { GeniusLyricsProvider } from "../providers/GeniusLyricsProvider";
import { LrclibLyricsProvider } from "../providers/LrclibLyricsProvider";

/**
 * Track -> (local cache) -> providers -> LyricsDocument. The UI never touches a provider.
 * Order: sidecar .lrc/.txt next to the file, Genius-identified lookup (when a token is set),
 * then plain LRCLIB.
 */
class LyricsManager {
  private repo = new LyricsRepository(new LyricsCache(), [new LocalLyricsProvider(), new GeniusLyricsProvider(), new LrclibLyricsProvider()]);
  private inflight = new Map<string, Promise<LyricsDocument | null>>();

  loadForTrack(track: ActiveTrack): Promise<LyricsDocument | null> {
    const existing = this.inflight.get(track.id);
    if (existing) return existing;
    const promise = this.repo.load(matchTrack(track)).finally(() => this.inflight.delete(track.id));
    this.inflight.set(track.id, promise);
    return promise;
  }
}

export const lyricsManager = new LyricsManager();
