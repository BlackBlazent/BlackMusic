import { isTauri } from "@/lib/platform";
import { getPreference, setPreference } from "@/lib/preferencesStore";
import type { Track } from "@/lib/types";

/**
 * Video Mode backend — yt-dlp instead of the YouTube Data API, so there's no API quota.
 * The active local track is turned into a search ("<artist> <title> official music video"),
 * yt-dlp resolves the top result to a video id/url, Playground embeds it, and the same
 * url is handed back to yt-dlp to download. yt-dlp ships WITH the app (bundled sidecar),
 * so users never install it separately; Settings → Plugins & Tools can update or replace it.
 */

export interface VideoMatch {
  id: string;
  title: string;
  url: string;
}

const CACHE_KEY = "blackmusic:videoMatches";

function searchQuery(title: string, artist: string) {
  const a = artist && artist !== "Unknown artist" ? artist : "";
  return `${a} ${title} official music video`.replace(/\s+/g, " ").trim();
}

async function runYtDlp(args: string[]) {
  // 2.2.0: yt-dlp is bundled (src-tauri/binaries/yt-dlp-<target-triple>) and run from Rust, which also
  // honours a user-imported executable and falls back to one on PATH — see src-tauri/src/tools.rs.
  const { ytdlp } = await import("@/lib/tools/ytdlpRunner");
  return ytdlp(args);
}

export async function isYtDlpAvailable(): Promise<boolean> {
  if (!isTauri()) return false;
  try {
    await runYtDlp(["--version"]);
    return true;
  } catch {
    return false;
  }
}

/** Finds (and caches) the official video for a track. Returns null when nothing matched. */
export async function findOfficialVideo(trackId: string, title: string, artist: string): Promise<VideoMatch | null> {
  const cache = await getPreference<Record<string, VideoMatch>>(CACHE_KEY, {});
  if (cache[trackId]) return cache[trackId];
  if (!isTauri()) throw new Error("Video Mode needs the desktop app (it runs yt-dlp).");

  const stdout = await runYtDlp([
    `ytsearch1:${searchQuery(title, artist)}`,
    "--no-playlist",
    "--skip-download",
    "--print",
    "%(id)s\t%(title)s",
  ]);
  const [id, ...rest] = stdout.trim().split("\n")[0]?.split("\t") ?? [];
  if (!id) return null;
  const match: VideoMatch = { id, title: rest.join("\t") || title, url: `https://www.youtube.com/watch?v=${id}` };
  await setPreference(CACHE_KEY, { ...cache, [trackId]: match });
  return match;
}

/** Downloads into the OS Downloads folder (Windows, macOS and Linux all resolve through Tauri's path API). */
export async function downloadVideo(url: string): Promise<string> {
  const { downloadDir, join } = await import("@tauri-apps/api/path");
  const dir = await downloadDir();
  await runYtDlp(["--no-playlist", "-f", "bv*[height<=1080]+ba/b[height<=1080]/b", "--merge-output-format", "mp4", "-o", await join(dir, "%(title)s.%(ext)s"), url]);
  return dir;
}

/** Extracts a YouTube video id from watch / youtu.be / shorts / embed links. */
export function parseYouTubeId(link: string): string | null {
  try {
    const u = new URL(link);
    const host = u.hostname.replace(/^www\./, "").replace(/^m\./, "");
    if (host === "youtu.be") return u.pathname.slice(1).split("/")[0] || null;
    if (host === "youtube.com" || host === "music.youtube.com") {
      if (u.pathname === "/watch") return u.searchParams.get("v");
      const m = u.pathname.match(/^\/(shorts|embed|live)\/([^/?]+)/);
      return m ? m[2] : null;
    }
  } catch {
    /* not a url */
  }
  return null;
}

/** Key-less YouTube search through the bundled yt-dlp (flat playlist = fast, no per-video extraction). */
export async function searchYouTubeWithYtDlp(query: string, limit = 25): Promise<Track[]> {
  const stdout = await runYtDlp([`ytsearch${Math.min(limit, 50)}:${query}`, "--flat-playlist", "--no-warnings", "--print", "%(id)s\t%(title)s\t%(channel)s\t%(duration)s"]);
  return stdout
    .trim()
    .split("\n")
    .filter(Boolean)
    .map((line) => {
      const [id, title, channel, duration] = line.split("\t");
      return {
        id: `youtube:${id}`,
        path: "",
        title: title || "Untitled",
        artist: (channel && channel !== "NA" ? channel : "YouTube").replace(/ - Topic$/, ""),
        album: "",
        duration: Number(duration) || 0,
        sourceUrl: "",
        artworkUrl: `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
        addedAt: Date.now(),
        provider: "youtube",
        resolve: { kind: "youtube", videoId: id },
      } satisfies Track;
    });
}
