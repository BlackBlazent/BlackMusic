import { isTauri } from "@/lib/platform";

export interface ToolStatus {
  /** "imported" (user-supplied), "bundled" (sidecar shipped with the app) or "system" (found on PATH). */
  source: "imported" | "bundled" | "system" | "missing";
  path: string | null;
  version: string | null;
  /** Set when the tool exists but can't run (e.g. a missing DLL) — shown instead of a bare "Not available". */
  problem?: string | null;
}

interface CmdOutput {
  code: number;
  stdout: string;
  stderr: string;
}

/** Runs yt-dlp through the Rust side (bundled sidecar → imported executable → PATH). Returns stdout. */
export async function ytdlp(args: string[]): Promise<string> {
  if (!isTauri()) throw new Error("yt-dlp needs the desktop app.");
  const { invoke } = await import("@tauri-apps/api/core");
  const out = await invoke<CmdOutput>("ytdlp_run", { args });
  if (out.code !== 0) {
    const lastLine = out.stderr.trim().split("\n").filter(Boolean).pop();
    throw new Error(lastLine || `yt-dlp exited with code ${out.code}`);
  }
  return out.stdout;
}

export async function toolStatus(tool: "yt-dlp" | "whisper-cli"): Promise<ToolStatus> {
  if (!isTauri()) return { source: "missing", path: null, version: null };
  const { invoke } = await import("@tauri-apps/api/core");
  return invoke<ToolStatus>("tool_status", { tool });
}

export async function importTool(tool: "yt-dlp" | "whisper-cli", sourcePath: string): Promise<void> {
  const { invoke } = await import("@tauri-apps/api/core");
  await invoke("tool_import", { tool, sourcePath });
}

export async function resetTool(tool: "yt-dlp" | "whisper-cli"): Promise<void> {
  const { invoke } = await import("@tauri-apps/api/core");
  await invoke("tool_reset", { tool });
}

export async function updateYtDlp(): Promise<string> {
  const { invoke } = await import("@tauri-apps/api/core");
  return invoke<string>("ytdlp_update");
}
