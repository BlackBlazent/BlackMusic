import { isTauri } from "@/lib/platform";
import type { ActiveTrack, LyricsDocument, LyricsProvider, LyricsSearchResult } from "../types/lyrics.types";
import { parseLrc, parsePlain } from "../utils/lyricsNormalizer";

/** Lyrics sitting next to the audio file: `song.lrc` (synced) or `song.txt` (plain). */
export class LocalLyricsProvider implements LyricsProvider {
  readonly name = "local";

  async searchTrack(track: ActiveTrack): Promise<LyricsSearchResult[]> {
    return track.path && isTauri() ? [{ id: track.path, title: track.title, artist: track.artist }] : [];
  }

  async fetchLyrics(_result: LyricsSearchResult, track: ActiveTrack): Promise<LyricsDocument | null> {
    if (!track.path || !isTauri()) return null;
    const { readTextFile, exists } = await import("@tauri-apps/plugin-fs");
    const stem = track.path.replace(/\.[^./\\]+$/, "");
    for (const [ext, synced] of [["lrc", true], ["txt", false]] as const) {
      const file = `${stem}.${ext}`;
      try {
        if (!(await exists(file))) continue;
        const raw = await readTextFile(file);
        const lines = synced ? parseLrc(raw) : parsePlain(raw);
        if (lines.length > 0) return { trackId: track.id, title: track.title, artist: track.artist, provider: "local", fetchedAt: Date.now(), synced, lines };
      } catch {
        /* unreadable sibling — try the next */
      }
    }
    return null;
  }
}
