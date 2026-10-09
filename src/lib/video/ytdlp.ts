import { isTauri } from "@/lib/platform";
import { getPreference, setPreference } from "@/lib/preferencesStore";

/**
 * Video Mode backend — yt-dlp instead of the YouTube Data API, so there's no API quota.
 * The active local track is turned into a search ("<artist> <title> official music video"),
 * yt-dlp resolves the top result to a video id/url, Playground embeds it, and the same
 * url is handed back to yt-dlp to download. Needs `yt-dlp` on PATH (or the user's PATH
 * equivalent on macOS/Linux/Windows); scoped in capabilities/default.json.
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
  const { Command } = await import("@tauri-apps/plugin-shell");
  const out = await Command.create("yt-dlp", args).execute();
  if (out.code !== 0) throw new Error(out.stderr.trim() || `yt-dlp exited with code ${out.code}`);
  return out.stdout;
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
