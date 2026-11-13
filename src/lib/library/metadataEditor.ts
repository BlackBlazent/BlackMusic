import { isTauri } from "@/lib/platform";
import { isMobileOs } from "@/lib/useIsMobile";
import { nativeCall } from "@/lib/mobileNative";
import "@/lib/library/androidFolders"; // declares window.BMStorage

async function openAndroidWriteFd(path: string): Promise<number | undefined> {
  if (!isMobileOs() || !window.BMStorage) return undefined;

  const bridge = window.BMStorage;
  const answer = await nativeCall(
    (id) => bridge.openForWrite!(id, path),
    180_000
  );

  const r = JSON.parse(answer) as {
    ok: boolean;
    fd?: number;
    error?: string;
  };

  if (!r.ok || typeof r.fd !== "number") {
    throw new Error(
      r.error ?? "Android didn't allow BlackMusic to edit this file."
    );
  }

  return r.fd;
}

/** `undefined` = leave the field alone; `""` = clear it; `year: 0` clears the year. */
export interface MetadataPatch {
  title?: string;
  artist?: string;
  album?: string;
  albumArtist?: string;
  year?: number;
  genre?: string;
  composer?: string;
  comment?: string;
  lyrics?: string;
  /** Image file path to embed as the front cover (resized to < 500 KB on the Rust side). */
  coverPath?: string;
}

export interface FullTags {
  title: string;
  artist: string;
  album: string;
  albumArtist: string;
  year: number | null;
  genre: string;
  composer: string;
  comment: string;
  lyrics: string;
}

/**
 * Writes tags into the audio file itself (MP3/ID3, FLAC, M4A, OGG, Opus, WAV, AIFF) through the Rust
 * `write_metadata` command, which uses `lofty`. Only the tag block is rewritten — the audio stream is untouched.
 */

/*
export async function writeMetadata(path: string, patch: MetadataPatch): Promise<void> {
  if (!isTauri()) throw new Error("Editing tags needs the desktop app.");
  const { invoke } = await import("@tauri-apps/api/core");
  await invoke("write_metadata", { path, patch });
}
*/

export async function writeMetadata(path: string, patch: MetadataPatch): Promise<void> {
  if (!isTauri()) throw new Error("Editing tags needs the desktop app.");

  const { invoke } = await import("@tauri-apps/api/core");

  const fd = await openAndroidWriteFd(path);
  await invoke("write_metadata", { path, patch, fd });
}

export async function readFullTags(path: string): Promise<FullTags> {
  if (!isTauri()) throw new Error("Reading tags needs the desktop app.");
  const { invoke } = await import("@tauri-apps/api/core");
  return invoke<FullTags>("read_full_tags", { path });
}

// ---- filename → tags (Smart tag guesser) -------------------------------------------------------------
export interface FilenamePattern {
  id: string;
  label: string;
  /** Tokens: %artist% %title% %album% %track% %year% */
  pattern: string;
}

export const FILENAME_PATTERNS: FilenamePattern[] = [
  { id: "artist-title", label: "Artist - Title", pattern: "%artist% - %title%" },
  { id: "track-title", label: "01 - Title", pattern: "%track% - %title%" },
  { id: "track-artist-title", label: "01 - Artist - Title", pattern: "%track% - %artist% - %title%" },
  { id: "title-artist", label: "Title - Artist", pattern: "%title% - %artist%" },
  { id: "album-track-title", label: "Album - 01 - Title", pattern: "%album% - %track% - %title%" },
];

export function guessTagsFromFilename(path: string, pattern: string): Partial<Record<"artist" | "title" | "album" | "track" | "year", string>> {
  const base = (path.split(/[/\\]/).pop() ?? path).replace(/\.[^.]+$/, "").replace(/_/g, " ").trim();
  const tokens: string[] = [];
  const source = pattern
    .split(/(%[a-z]+%)/)
    .map((part) => {
      const m = part.match(/^%([a-z]+)%$/);
      if (m) {
        tokens.push(m[1]);
        return m[1] === "track" || m[1] === "year" ? "(\\d{1,4})" : "(.+?)";
      }
      return part.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\s+/g, "\\s*");
    })
    .join("");
  const match = base.match(new RegExp(`^${source}$`, "i"));
  if (!match) return {};
  const out: Record<string, string> = {};
  tokens.forEach((t, i) => (out[t] = match[i + 1].trim()));
  return out;
}
