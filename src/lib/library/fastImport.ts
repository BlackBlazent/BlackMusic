import { Channel, convertFileSrc, invoke } from "@tauri-apps/api/core";
import type { Track } from "@/lib/types";
import { shrinkArtwork } from "./scanFolder";

/**
 * Fast library import (2.1.0)
 *
 *   OLD  song 1 -> metadata -> DB -> UI ; song 2 -> metadata -> DB -> UI ; ...   (~3 songs / second)
 *   NEW  DISCOVER FILES -> PARALLEL METADATA EXTRACTION -> ONE batched write -> ONE UI update
 *
 * The heavy lifting happens in Rust (`scan_folder_fast`, src-tauri/src/importer.rs):
 *   1. walk the folder tree,
 *   2. stat every file and skip any whose path+size+mtime match the cached scan (rescans are near-instant),
 *   3. read tags for the rest on every CPU core — header-only reads, no whole-file IPC transfer, no cover decoding,
 *   4. hand back everything in a single response.
 * This module turns that response into Track objects. Cover art is NOT part of the import: it's loaded
 * lazily afterwards, once per album (see `loadCoversByAlbum`), so 17,000 songs never wait on image decoding.
 */

interface RustTags {
  title: string | null;
  artist: string | null;
  album: string | null;
  duration: number;
  hasCover: boolean;
}
interface RustFile {
  path: string;
  size: number;
  mtime: number;
  tags: RustTags | null;
}
interface RustResult {
  files: RustFile[];
  elapsedMs: number;
}
interface RustProgress {
  phase: "discovering" | "reading";
  done: number;
  total: number;
}

export interface FastScanProgress {
  phase: "discovering" | "reading";
  done: number;
  total: number;
}

export interface FastScanResult {
  tracks: Track[];
  /** Paths of tracks that have embedded art but no thumbnail yet. */
  coverPaths: Set<string>;
  elapsedMs: number;
  /** How many files were re-read vs. reused from the cache (for the completion message). */
  reread: number;
  reused: number;
}

function fileStem(path: string): string {
  const name = path.split(/[/\\]/).pop() ?? path;
  const dot = name.lastIndexOf(".");
  return (dot > 0 ? name.slice(0, dot) : name) || name;
}

/** Returns null when the native command isn't available (old binary / browser) so the caller can fall back. */
export async function fastScanFolders(
  folders: string[],
  knownTracks: Track[],
  onProgress: (progress: FastScanProgress) => void,
  isCancelled: () => boolean,
): Promise<FastScanResult | null> {
  const knownByPath = new Map(knownTracks.map((t) => [t.path, t]));
  const out: Track[] = [];
  const coverPaths = new Set<string>();
  let elapsedMs = 0;
  let reread = 0;
  let reused = 0;
  let doneBefore = 0;

  for (const folder of folders) {
    if (isCancelled()) break;
    const known = knownTracks
      .filter((t) => t.path.startsWith(folder) && t.size !== undefined && t.mtime !== undefined)
      .map((t) => ({ path: t.path, size: t.size!, mtime: t.mtime! }));

    const channel = new Channel<RustProgress>();
    channel.onmessage = (p) => onProgress({ phase: p.phase, done: doneBefore + p.done, total: p.total });

    let result: RustResult;
    try {
      result = await invoke<RustResult>("scan_folder_fast", { folder, known, onProgress: channel });
    } catch (error) {
      // "Command scan_folder_fast not found" => running an older shell: let the JS scanner handle it.
      if (String(error).includes("not found")) return null;
      throw error;
    }
    elapsedMs += result.elapsedMs;
    doneBefore += result.files.length;

    const now = Date.now();
    for (const file of result.files) {
      const previous = knownByPath.get(file.path);
      if (!file.tags) {
        // Unchanged since last scan — reuse the cached track untouched (art and all).
        if (previous) {
          out.push(previous);
          reused += 1;
          continue;
        }
      }
      reread += 1;
      const tags = file.tags;
      const track: Track = {
        id: file.path,
        path: file.path,
        title: tags?.title ?? fileStem(file.path),
        artist: tags?.artist ?? "Unknown artist",
        album: tags?.album ?? "Unknown album",
        duration: tags?.duration ?? 0,
        sourceUrl: convertFileSrc(file.path),
        addedAt: previous?.addedAt ?? now,
        size: file.size,
        mtime: file.mtime,
        // A re-read file keeps the thumbnail it already had.
        artworkUrl: previous?.artworkUrl,
      };
      out.push(track);
      if (tags?.hasCover && !track.artworkUrl) coverPaths.add(file.path);
    }
  }

  return { tracks: out, coverPaths, elapsedMs, reread, reused };
}

/**
 * Lazy cover pass. One representative file per (artist, album) is asked for its embedded cover, the thumbnail
 * is shared by every track of that album, and results are delivered in batches so the UI updates a few times
 * total — not once per song. Runs after the import, never blocks it.
 */
export async function loadCoversByAlbum(
  tracks: Track[],
  coverPaths: Set<string>,
  onBatch: (artByAlbumKey: Map<string, string>) => void,
  isCancelled: () => boolean,
): Promise<void> {
  const albumKey = (t: Track) => `${t.artist}::${t.album}`;
  const haveArt = new Set(tracks.filter((t) => t.artworkUrl).map(albumKey));
  const reps = new Map<string, Track>();
  for (const track of tracks) {
    const key = albumKey(track);
    if (haveArt.has(key) || reps.has(key) || !coverPaths.has(track.path)) continue;
    reps.set(key, track);
  }

  const queue = [...reps.entries()];
  let pending = new Map<string, string>();
  let lastFlush = Date.now();
  const flush = () => {
    if (pending.size === 0) return;
    const batch = pending;
    pending = new Map();
    lastFlush = Date.now();
    onBatch(batch);
  };

  let cursor = 0;
  const worker = async () => {
    while (cursor < queue.length) {
      if (isCancelled()) return;
      const [key, track] = queue[cursor++];
      try {
        const bytes = new Uint8Array(await invoke<ArrayBuffer>("read_cover", { path: track.path }));
        if (bytes.byteLength === 0) continue;
        const art = await shrinkArtwork(bytes, sniffMime(bytes));
        if (art) pending.set(key, art);
      } catch {
        /* unreadable cover — skip it */
      }
      if (Date.now() - lastFlush > 1500) flush(); // a handful of updates over the whole pass
    }
  };
  await Promise.all(Array.from({ length: Math.min(4, queue.length) }, worker));
  flush();
}

function sniffMime(bytes: Uint8Array): string {
  if (bytes[0] === 0x89 && bytes[1] === 0x50) return "image/png";
  if (bytes[0] === 0xff && bytes[1] === 0xd8) return "image/jpeg";
  if (bytes[0] === 0x47 && bytes[1] === 0x49) return "image/gif";
  if (bytes[0] === 0x52 && bytes[1] === 0x49) return "image/webp";
  return "image/jpeg";
}
