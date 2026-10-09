import { isTauri } from "@/lib/platform";
import type { ActiveTrack, LyricsDocument } from "../types/lyrics.types";
import { lyricsFileStem } from "../utils/lyricsKey";
import { toPlainText } from "../utils/lyricsNormalizer";

/**
 * Persistent lyrics store in the app data directory:
 *   <appData>/lyrics/<stem>.json   structured LyricsDocument (powers panel + overlay)
 *   <appData>/lyrics/<stem>.txt    plain text copy (the "standard lyrics file" from the spec)
 * Browser dev mode falls back to localStorage so the UI still works.
 */
export class LyricsCache {
  private async dir() {
    const { appDataDir, join } = await import("@tauri-apps/api/path");
    const { mkdir, exists } = await import("@tauri-apps/plugin-fs");
    const dir = await join(await appDataDir(), "lyrics");
    if (!(await exists(dir))) await mkdir(dir, { recursive: true });
    return dir;
  }

  async get(track: ActiveTrack): Promise<LyricsDocument | null> {
    const stem = lyricsFileStem(track);
    try {
      if (!isTauri()) {
        const raw = window.localStorage.getItem(`blackmusic:lyrics:${stem}`);
        return raw ? (JSON.parse(raw) as LyricsDocument) : null;
      }
      const { readTextFile, exists } = await import("@tauri-apps/plugin-fs");
      const { join } = await import("@tauri-apps/api/path");
      const file = await join(await this.dir(), `${stem}.json`);
      return (await exists(file)) ? (JSON.parse(await readTextFile(file)) as LyricsDocument) : null;
    } catch {
      return null;
    }
  }

  async save(track: ActiveTrack, doc: LyricsDocument): Promise<void> {
    const stem = lyricsFileStem(track);
    try {
      if (!isTauri()) {
        window.localStorage.setItem(`blackmusic:lyrics:${stem}`, JSON.stringify(doc));
        return;
      }
      const { writeTextFile } = await import("@tauri-apps/plugin-fs");
      const { join } = await import("@tauri-apps/api/path");
      const dir = await this.dir();
      await writeTextFile(await join(dir, `${stem}.json`), JSON.stringify(doc));
      await writeTextFile(await join(dir, `${stem}.txt`), `${doc.title} — ${doc.artist}\n\n${toPlainText(doc.lines)}\n`);
    } catch {
      /* caching is best-effort; the lyrics still display */
    }
  }
}
