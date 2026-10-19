import type { Track } from "@/lib/types";
import { isTauri } from "@/lib/platform";
import { serviceJson } from "./serviceFetch";

/**
 * 2.2.0 — makes "listed but not playable" tracks playable (the Last.fm / YouTube bug: music was fetched
 * and shown, but had no stream URL so nothing played).
 *
 * Resolution order for a track with no `sourceUrl`:
 *   1. `resolve.kind === "youtube"`  → bundled yt-dlp extracts the best audio stream of that video.
 *   2. `resolve.kind === "search"`   → yt-dlp `ytsearch1:` for "artist title" (full-length audio).
 *   3. Fallback (no yt-dlp, e.g. browser dev): Deezer public search → 30-second preview, then Audius.
 * Results are cached in memory (stream URLs expire, so the cache is short-lived).
 */

const TTL_MS = 25 * 60 * 1000;
const cache = new Map<string, { url: string; at: number }>();

export function needsResolving(track: Track): boolean {
  return !track.sourceUrl && !track.path && Boolean(track.resolve);
}

function cleanQuery(t: Track): string {
  const artist = t.artist && t.artist !== "Unknown artist" ? t.artist : "";
  return `${artist} ${t.title}`.replace(/\s*[\(\[].*?(official|video|audio|lyrics?).*?[\)\]]/gi, "").replace(/\s+/g, " ").trim();
}

async function viaYtDlp(target: string): Promise<string> {
  const { ytdlp } = await import("@/lib/tools/ytdlpRunner");
  const stdout = await ytdlp([
    target,
    "--no-playlist",
    "--no-warnings",
    "-f",
    "bestaudio[ext=m4a]/bestaudio/best",
    "-g",
  ]);
  const url = stdout.trim().split("\n")[0]?.trim();
  if (!url) throw new Error("yt-dlp returned no stream.");
  return url;
}

async function viaDeezer(query: string): Promise<string | null> {
  const data = await serviceJson<{ data?: { preview?: string }[] }>(`https://api.deezer.com/search?q=${encodeURIComponent(query)}&limit=1`);
  return data.data?.[0]?.preview || null;
}

async function viaAudius(query: string): Promise<string | null> {
  try {
    const host = await serviceJson<{ data?: string[] }>("https://api.audius.co");
    const base = host.data?.[0];
    if (!base) return null;
    const data = await serviceJson<{ data?: { id: string }[] }>(`${base}/v1/tracks/search?query=${encodeURIComponent(query)}&limit=1&app_name=BlackMusic`);
    const id = data.data?.[0]?.id;
    return id ? `${base}/v1/tracks/${id}/stream?app_name=BlackMusic` : null;
  } catch {
    return null;
  }
}

export interface ResolvedStream {
  url: string;
  /** True when only a 30-second preview could be found. */
  preview: boolean;
}

export async function resolveStream(track: Track): Promise<ResolvedStream> {
  if (track.sourceUrl) return { url: track.sourceUrl, preview: false };
  const recipe = track.resolve;
  if (!recipe) throw new Error("This track has no playable source.");

  const key = recipe.kind === "youtube" ? `yt:${recipe.videoId}` : `q:${recipe.query}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL_MS) return { url: hit.url, preview: false };

  const errors: string[] = [];
  if (isTauri()) {
    try {
      const target = recipe.kind === "youtube" ? `https://www.youtube.com/watch?v=${recipe.videoId}` : `ytsearch1:${recipe.query || cleanQuery(track)}`;
      const url = await viaYtDlp(target);
      cache.set(key, { url, at: Date.now() });
      return { url, preview: false };
    } catch (e) {
      errors.push(e instanceof Error ? e.message : String(e));
    }
  }

  const query = recipe.kind === "search" ? recipe.query : cleanQuery(track);
  const deezer = await viaDeezer(query).catch(() => null);
  if (deezer) return { url: deezer, preview: true };
  const audius = await viaAudius(query);
  if (audius) return { url: audius, preview: false };

  throw new Error(errors[0] ?? "No playable match found for this track.");
}
