import { readDir, readFile } from "@tauri-apps/plugin-fs";
import { convertFileSrc } from "@tauri-apps/api/core";
import { join } from "@tauri-apps/api/path";
import type { Track } from "@/lib/types";

const AUDIO_EXTENSIONS = new Set(["mp3", "flac", "wav", "ogg", "m4a", "aac", "opus", "wma"]);
// Metadata parsing is mostly I/O + a burst of CPU (tag decode, base64 art encode)
// per file — running several in flight at once is a big win over one-at-a-time,
// without saturating the IPC bridge to the Rust side the way unlimited concurrency would.
const SCAN_CONCURRENCY = 8;

function extensionOf(name: string): string {
  const dot = name.lastIndexOf(".");
  return dot === -1 ? "" : name.slice(dot + 1).toLowerCase();
}

function mimeTypeFor(extension: string): string {
  switch (extension) {
    case "mp3":
      return "audio/mpeg";
    case "flac":
      return "audio/flac";
    case "wav":
      return "audio/wav";
    case "ogg":
    case "opus":
      return "audio/ogg";
    case "m4a":
    case "aac":
      return "audio/mp4";
    default:
      return "application/octet-stream";
  }
}

/** Chunked to avoid blowing the call stack that `String.fromCharCode(...bytes)` hits on large embedded art. */
function bytesToBase64(bytes: Uint8Array): string {
  const CHUNK_SIZE = 8192;
  let binary = "";
  for (let i = 0; i < bytes.length; i += CHUNK_SIZE) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK_SIZE));
  }
  return btoa(binary);
}

// Loaded once and reused — repeated `await import(...)` of the same specifier is
// cached by the module system anyway, but resolving it once up front means the
// first few files in a scan aren't stuck waiting on that resolution too.
let metadataModule: typeof import("music-metadata") | null = null;
async function getMetadataModule() {
  if (!metadataModule) metadataModule = await import("music-metadata");
  return metadataModule;
}

async function readTrack(path: string, name: string): Promise<Track> {
  const extension = extensionOf(name);
  const fallbackTitle = name.slice(0, name.length - extension.length - 1) || name;

  const base: Track = {
    id: path,
    path,
    title: fallbackTitle,
    artist: "Unknown artist",
    album: "Unknown album",
    duration: 0,
    sourceUrl: convertFileSrc(path),
    addedAt: Date.now(),
  };

  try {
    const { parseBuffer } = await getMetadataModule();
    const bytes = await readFile(path);
    const parsed = await parseBuffer(bytes, { mimeType: mimeTypeFor(extension), size: bytes.byteLength });

    const picture = parsed.common.picture?.[0];
    const artworkUrl = picture ? `data:${picture.format};base64,${bytesToBase64(picture.data)}` : undefined;

    return {
      ...base,
      title: parsed.common.title ?? base.title,
      artist: parsed.common.artist ?? base.artist,
      album: parsed.common.album ?? base.album,
      duration: parsed.format.duration ?? 0,
      artworkUrl,
    };
  } catch {
    // Unreadable tags (corrupt file, unsupported codec, permissions) shouldn't
    // block the rest of the scan — fall back to filename-derived metadata.
    return base;
  }
}

interface PendingFile {
  path: string;
  name: string;
}

/** Directory walk is cheap (just readDir calls) — do it all up front, sequentially, before the expensive part. */
async function collectAudioFiles(rootPath: string): Promise<PendingFile[]> {
  const files: PendingFile[] = [];

  async function walk(dirPath: string) {
    const entries = await readDir(dirPath);
    for (const entry of entries) {
      // `join` (not manual `/` concatenation) — this is the difference between
      // a path that resolves correctly on Windows (backslash-separated roots,
      // e.g. `C:\Users\...\Musics`) and one that silently ends up with mixed
      // separators, which is a real way for `convertFileSrc`/`readFile` to
      // fail to resolve the file even though it looks fine printed as a string.
      const entryPath = await join(dirPath, entry.name ?? "");
      if (entry.isDirectory) {
        await walk(entryPath);
        continue;
      }
      const extension = extensionOf(entry.name ?? "");
      if (!AUDIO_EXTENSIONS.has(extension)) continue;
      files.push({ path: entryPath, name: entry.name ?? "Untitled" });
    }
  }

  await walk(rootPath);
  return files;
}

/** Runs `task` over `items` with at most `limit` in flight at once. */
async function runWithConcurrency<T, R>(
  items: T[],
  limit: number,
  task: (item: T) => Promise<R>,
  isCancelled?: () => boolean,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let nextIndex = 0;

  async function worker() {
    while (nextIndex < items.length) {
      if (isCancelled?.()) return;
      const index = nextIndex++;
      results[index] = await task(items[index]);
    }
  }

  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

export async function scanFolder(
  folderPath: string,
  onTrackScanned?: (track: Track, count: number) => void,
  isCancelled?: () => boolean,
): Promise<Track[]> {
  const pending = await collectAudioFiles(folderPath);
  let done = 0;

  const results = await runWithConcurrency(
    pending,
    SCAN_CONCURRENCY,
    async (file) => {
      const track = await readTrack(file.path, file.name);
      done += 1;
      onTrackScanned?.(track, done);
      return track;
    },
    isCancelled,
  );
  // Cancelled workers leave trailing holes (never-assigned array slots) — drop them.
  return results.filter((t): t is Track => Boolean(t));
}
