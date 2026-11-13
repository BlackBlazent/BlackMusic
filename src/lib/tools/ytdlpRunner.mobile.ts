/**
 * Mobile build replacement for ytdlpRunner.ts (IMP-09 §9.3). vite.config.ts swaps the real module for this file whenever it builds for
 * Android or iOS, so the yt-dlp call code is not in the mobile JavaScript bundle at all. Same exports, all "not available".
 */
export interface ToolStatus {
  source: "imported" | "bundled" | "system" | "missing";
  path: string | null;
  version: string | null;
  problem?: string | null;
}

const NO = "yt-dlp isn't part of the mobile app. Video search and playback use the YouTube API instead.";

export async function ytdlp(_args: string[]): Promise<string> {
  throw new Error(NO);
}
export async function toolStatus(tool: "yt-dlp" | "whisper-cli"): Promise<ToolStatus> {
  return { source: "missing", path: null, version: null, problem: tool === "yt-dlp" ? NO : "On mobile, speech-to-text uses the built-in library." };
}
export async function importTool(_tool: "yt-dlp" | "whisper-cli", _sourcePath: string): Promise<void> {
  throw new Error(NO);
}
export async function resetTool(_tool: "yt-dlp" | "whisper-cli"): Promise<void> {
  throw new Error(NO);
}
export async function updateYtDlp(): Promise<string> {
  throw new Error(NO);
}
