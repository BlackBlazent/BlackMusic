import type { PlayEvent, Track } from "@/lib/types";
import type { Playlist } from "@/app/context/PlaylistsContext";

/** FEAT-13 — pure builders for JSON / M3U8 / CSV. No I/O here, so they're easy to test. */

export const BACKUP_FORMAT = "blackmusic-backup";
export const BACKUP_VERSION = 1;

export interface PortableTrack {
  id: string;
  title: string;
  artist: string;
  album: string;
  duration: number;
  genre?: string;
  year?: number;
  composer?: string;
  country?: string;
  mood?: string;
  bitrate?: number;
  format?: string;
  /** Device path — informational only; another device will have a different one. */
  path?: string;
}

export interface BackupFile {
  format: typeof BACKUP_FORMAT;
  version: number;
  createdAt: string;
  appVersion: string;
  library: PortableTrack[];
  playlists: Playlist[];
  favorites: string[];
  playHistory: PlayEvent[];
  skipHistory: PlayEvent[];
  trackExtras: Record<string, { country?: string; mood?: string }>;
  lifetimeStats: Record<string, number>;
  /** Non-secret preferences only. API keys, tokens and sign-in sessions are NEVER included. */
  settings: Record<string, unknown>;
}

export const toPortable = (t: Track): PortableTrack => ({
  id: t.id, title: t.title, artist: t.artist, album: t.album, duration: t.duration,
  genre: t.genre, year: t.year, composer: t.composer, country: t.country, mood: t.mood, bitrate: t.bitrate, format: t.format, path: t.path || undefined,
});

/** Exports are always valid UTF-8 text; this strips characters that break file names on any OS. */
export const safeFileName = (name: string) => name.replace(/[\\/:*?"<>|\u0000-\u001f]/g, "_").replace(/\s+/g, " ").trim().slice(0, 80) || "untitled";

/** M3U8 (UTF-8). Paths are written exactly as this device knows them; tracks without a local file are skipped and counted. */
export function buildM3u8(playlist: Playlist, byId: Map<string, Track>): { text: string; written: number; skipped: number } {
  const lines = ["#EXTM3U", `#PLAYLIST:${playlist.name}`];
  let written = 0;
  let skipped = 0;
  for (const id of playlist.trackIds) {
    const t = byId.get(id);
    if (!t?.path) { skipped++; continue; }
    lines.push(`#EXTINF:${Math.round(t.duration || 0)},${t.artist && t.artist !== "Unknown artist" ? `${t.artist} - ` : ""}${t.title}`, t.path);
    written++;
  }
  return { text: lines.join("\n") + "\n", written, skipped };
}

/** RFC 4180 CSV. Cells starting with = + - @ are prefixed with ' so spreadsheets can't run them as formulas. */
export function csvCell(v: unknown): string {
  let s = v === undefined || v === null ? "" : String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
const csvRow = (cells: unknown[]) => cells.map(csvCell).join(",");

export function buildTracksCsv(tracks: Track[], favorites: Set<string>, plays: Map<string, number>): string {
  const head = ["title", "artist", "album", "genre", "year", "composer", "country", "mood", "duration_seconds", "bitrate_kbps", "format", "favorite", "play_count", "path"];
  const rows = tracks.map((t) => csvRow([t.title, t.artist, t.album, t.genre, t.year, t.composer, t.country, t.mood, Math.round(t.duration || 0), t.bitrate, t.format, favorites.has(t.id) ? "yes" : "", plays.get(t.id) ?? 0, t.path]));
  return "\uFEFF" + [csvRow(head), ...rows].join("\r\n") + "\r\n"; // BOM so Excel opens UTF-8 correctly
}

export function buildHistoryCsv(events: PlayEvent[], byId: Map<string, Track>): string {
  const rows = events.map((e) => {
    const t = byId.get(e.trackId);
    return csvRow([new Date(e.playedAt).toISOString(), t?.title ?? "(removed)", t?.artist ?? "", t?.album ?? ""]);
  });
  return "\uFEFF" + [csvRow(["played_at", "title", "artist", "album"]), ...rows].join("\r\n") + "\r\n";
}

/** Validates a parsed backup before anything is restored. Returns a readable problem, or null when it is safe to use. */
export function validateBackup(x: unknown): string | null {
  const b = x as Partial<BackupFile> | null;
  if (!b || typeof b !== "object") return "That file isn't a BlackMusic backup.";
  if (b.format !== BACKUP_FORMAT) return "That file isn't a BlackMusic backup (wrong format).";
  if (typeof b.version !== "number" || b.version > BACKUP_VERSION) return "This backup was made by a newer BlackMusic. Update the app, then try again.";
  if (!Array.isArray(b.playlists) || !Array.isArray(b.favorites) || !Array.isArray(b.playHistory)) return "The backup is incomplete or damaged.";
  for (const p of b.playlists) if (!p || typeof p.id !== "string" || typeof p.name !== "string" || !Array.isArray(p.trackIds)) return "A playlist in the backup is damaged, so nothing was restored.";
  return null;
}
