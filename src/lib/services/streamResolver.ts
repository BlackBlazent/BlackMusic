import type { Track } from "@/lib/types";
import { isTauri } from "@/lib/platform";
// [PIPED-BUILD] uncomment these two imports when you enable the Piped block below:
// import { isMobileOs } from "@/lib/useIsMobile";
// import { getPreference } from "@/lib/preferencesStore";
import { serviceJson } from "./serviceFetch";

/**
 * 2.2.0 — makes "listed but not playable" tracks playable (the Last.fm / YouTube bug: music was fetched
 * and shown, but had no stream URL so nothing played).
 *
 * Resolution order for a track with no `sourceUrl`:
 *   1. `resolve.kind === "youtube"`  → bundled yt-dlp extracts the best audio stream of that video.
 *   2. `resolve.kind === "search"`   → yt-dlp `ytsearch1:` for "artist title" (full-length audio).
 *   3. Fallback (no yt-dlp, e.g. mobile or browser dev): Deezer public search → 30-second preview, then Audius.
 * Results are cached in memory (stream URLs expire, so the cache is short-lived).
 *
 * [PIPED-BUILD] A disabled, optional step ("Piped" stream helper for mobile) is kept below as commented code. It is OFF in this
 * file. Note that extracting YouTube audio is against YouTube's Terms of Service and Google Play policy — do not ship it there.
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

// [PIPED-BUILD] ---- START: uncomment this whole block to enable (and the 2 imports at the top) ----
// // --- 3.0.1: full-length audio without yt-dlp (mobile) ------------------------------------------------------------------
// const DEFAULT_PIPED_APIS = ["https://pipedapi.kavin.rocks", "https://api.piped.private.coffee", "https://pipedapi.adminforge.de"];
// const INSTANCES_KEY = "blackmusic:streamInstances";
//
// async function pipedInstances(): Promise<string[]> {
//   const stored = await getPreference<string[]>(INSTANCES_KEY, []).catch(() => [] as string[]);
//   const fromEnv = ((import.meta.env as unknown as Record<string, string | undefined>).VITE_PIPED_API_URLS ?? "").split(",");
//   return [...new Set([...stored, ...fromEnv, ...DEFAULT_PIPED_APIS].map((u) => u.trim().replace(/\/+$/, "")).filter((u) => /^https:\/\//i.test(u)))];
// }
//
// /** Calls `path` on each instance in turn (8 s each) and returns the first usable answer. */
// async function pipedGet<T>(path: string, usable: (data: T) => boolean): Promise<T> {
//   let lastError = "no stream instance answered";
//   for (const base of await pipedInstances()) {
//     try {
//       const data = await Promise.race([
//         serviceJson<T>(`${base}${path}`),
//         new Promise<never>((_, reject) => setTimeout(() => reject(new Error("timed out")), 8000)),
//       ]);
//       if (usable(data)) return data;
//       lastError = `${new URL(base).host} had nothing for this track`;
//     } catch (e) {
//       lastError = `${new URL(base).host}: ${e instanceof Error ? e.message : String(e)}`;
//     }
//   }
//   throw new Error(`Couldn't get a stream (${lastError}). Public stream helpers may be busy — try again, or set VITE_PIPED_API_URLS to your own.`);
// }
//
// interface PipedStreams {
//   audioStreams?: { url?: string; mimeType?: string; bitrate?: number }[];
// }
//
// async function viaPiped(videoId: string): Promise<string> {
//   const data = await pipedGet<PipedStreams>(`/streams/${encodeURIComponent(videoId)}`, (d) => Boolean(d.audioStreams?.some((a) => a.url)));
//   const usable = (data.audioStreams ?? []).filter((a) => a.url && /^audio\/(mp4|webm)/i.test(a.mimeType ?? ""));
//   // AAC (m4a) first — every Android WebView plays it — then the highest bitrate.
//   usable.sort((a, b) => Number(/mp4/i.test(b.mimeType ?? "")) - Number(/mp4/i.test(a.mimeType ?? "")) || (b.bitrate ?? 0) - (a.bitrate ?? 0));
//   const url = usable[0]?.url;
//   if (!url) throw new Error("The stream helper returned no audio for this video.");
//   return url;
// }
//
// async function pipedVideoIdFor(query: string): Promise<string> {
//   const data = await pipedGet<{ items?: { url?: string; type?: string }[] }>(
//     `/search?q=${encodeURIComponent(query)}&filter=music_songs`,
//     (d) => Boolean(d.items?.some((i) => /[?&]v=/.test(i.url ?? ""))),
//   );
//   const hit = data.items?.map((i) => /[?&]v=([\w-]{6,})/.exec(i.url ?? "")?.[1]).find(Boolean);
//   if (!hit) throw new Error("No matching video found for this track.");
//   return hit;
// }
//
// [PIPED-BUILD] ---- END ----

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

  // [PIPED-BUILD] ---- START: uncomment to enable the Piped step (runs after yt-dlp fails / is missing) ----
//   // No yt-dlp (Android/iOS, or it failed): get the full-length audio from a Piped instance before settling for a 30 s preview.
//   try {
//     const videoId = recipe.kind === "youtube" ? recipe.videoId : await pipedVideoIdFor(recipe.query || cleanQuery(track));
//     const url = await viaPiped(videoId);
//     cache.set(key, { url, at: Date.now() });
//     return { url, preview: false };
//   } catch (e) {
//     errors.push(e instanceof Error ? e.message : String(e));
//   }
//
  // [PIPED-BUILD] ---- END ----

  const query = recipe.kind === "search" ? recipe.query : cleanQuery(track);
  const deezer = await viaDeezer(query).catch(() => null);
  if (deezer) return { url: deezer, preview: true };
  const audius = await viaAudius(query);
  if (audius) return { url: audius, preview: false };

  throw new Error(errors[0] ?? "No playable match found for this track.");
  // [PIPED-BUILD] when the Piped block is enabled, use this line INSTEAD of the one above (shows the useful error on mobile):
  // throw new Error((isMobileOs() ? errors[errors.length - 1] : errors[0]) ?? "No playable match found for this track.");
}