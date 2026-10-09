import { isTauri } from "@/lib/platform";
import type { RepeatMode } from "@/lib/types";

/**
 * Native Picture-in-Picture: a second, frameless, always-on-top Tauri window ("pip").
 * It is a SEPARATE webview — the main window keeps the audio and mirrors a small state snapshot to it over
 * Tauri events; the mini window sends button presses back. (Document-PiP / <video> PiP aren't used: they're
 * Chromium-only / video-only, so they can't be the app's PiP on WebView2 + WKWebView + WebKitGTK alike.)
 */

export const PIP_LABEL = "pip";

export const PIP_EVENTS = {
  /** main -> pip: PipState snapshot */
  state: "pip:state",
  /** pip -> main: PipCommand */
  command: "pip:command",
  /** pip -> main: "my listeners are attached, send me the full state" */
  ready: "pip:ready",
  /** pip -> main: PipPlacement (so the next open restores it) */
  moved: "pip:moved",
  /** Rust -> everyone: the pip window was destroyed (X button, Alt+F4, OS, or main asked) */
  closed: "pip:closed",
} as const;

export interface PipState {
  hasTrack: boolean;
  trackId: string | null;
  title: string;
  artist: string;
  /** undefined = unchanged since the last snapshot (artwork is only sent when it changes). */
  artwork?: string | null;
  isPlaying: boolean;
  position: number;
  duration: number;
  rate: number;
  repeatMode: RepeatMode;
  /** YouTube id when Video Mode is showing a video; the mini window shows it muted, in sync. */
  videoId: string | null;
  /** Wall-clock ms when `position` was sampled — lets the mini window interpolate smoothly. */
  at: number;
}

export type PipCommand =
  | { action: "toggle" | "next" | "previous" | "repeat" | "stop" | "showMain" | "close" }
  | { action: "seek"; seconds: number }
  /** Relative jump, e.g. -10 / +10. The main window clamps it to the track. */
  | { action: "skip"; seconds: number };

export interface PipPlacement {
  x: number;
  y: number;
  width: number;
  height: number;
}

export const PIP_HASH = "#/pip";

export function isPipWindow(): boolean {
  return window.location.hash.startsWith(PIP_HASH);
}

export function pipThemeFromUrl(): "dark" | "light" {
  return new URLSearchParams(window.location.search).get("theme") === "light" ? "light" : "dark";
}

/** Same order as PlaybackContext.cycleRepeatMode — lets the mini window predict the next mode instantly. */
export function nextRepeatMode(mode: RepeatMode): RepeatMode {
  return mode === "off" ? "queue" : mode === "queue" ? "track" : "off";
}

const DEFAULT_SIZE = { width: 360, height: 250 };
export const PIP_MIN_SIZE = { width: 280, height: 150 };

/** Bottom-right of the monitor the main window is on, clear of the taskbar. Logical pixels. */
async function defaultCorner(width: number, height: number): Promise<{ x: number; y: number } | null> {
  try {
    const { currentMonitor } = await import("@tauri-apps/api/window");
    const monitor = await currentMonitor();
    if (!monitor) return null;
    const scale = monitor.scaleFactor || 1;
    return {
      x: Math.max(0, Math.round((monitor.position.x + monitor.size.width) / scale - width - 24)),
      y: Math.max(0, Math.round((monitor.position.y + monitor.size.height) / scale - height - 72)),
    };
  } catch {
    return null;
  }
}

/** Opens (or re-focuses) the native mini player window. Rejects if the OS refuses to create it. */
export async function openPipWindow(theme: "dark" | "light", saved: PipPlacement | null): Promise<void> {
  if (!isTauri()) throw new Error("Picture-in-picture is a native window — it needs the desktop app, not a browser tab.");
  const { WebviewWindow } = await import("@tauri-apps/api/webviewWindow");

  const existing = await WebviewWindow.getByLabel(PIP_LABEL);
  if (existing) {
    await existing.show();
    return;
  }

  const width = Math.max(PIP_MIN_SIZE.width, saved?.width ?? DEFAULT_SIZE.width);
  const height = Math.max(PIP_MIN_SIZE.height, saved?.height ?? DEFAULT_SIZE.height);
  const position = saved ? { x: saved.x, y: saved.y } : await defaultCorner(width, height);

  await new Promise<void>((resolve, reject) => {
    const win = new WebviewWindow(PIP_LABEL, {
      url: `index.html?theme=${theme}${PIP_HASH}`,
      title: "BlackMusic — Mini player",
      width,
      height,
      minWidth: PIP_MIN_SIZE.width,
      minHeight: PIP_MIN_SIZE.height,
      ...(position ? { x: position.x, y: position.y } : { center: true }),
      decorations: false, // we draw our own slim header (drag region + close)
      alwaysOnTop: true, // this is what makes it picture-in-picture
      skipTaskbar: true,
      resizable: true,
      maximizable: false,
      minimizable: false,
      focus: false, // don't steal keyboard focus
      shadow: true,
    });
    void win.once("tauri://created", () => resolve());
    void win.once("tauri://error", (event) => reject(new Error(String(event.payload))));
  });
}

/**
 * Closes the mini window through a Rust command (`close_pip`). The previous JS close path needed an extra
 * `core:window:allow-destroy` permission and silently did nothing without it. Rust destroys the window and the
 * window-event hook in main.rs emits `pip:closed`, so every close route ends the same way.
 */
export async function closePipWindow(): Promise<void> {
  if (!isTauri()) return;
  const { invoke } = await import("@tauri-apps/api/core");
  await invoke("close_pip");
}

/** Bring the main window back to the front (the mini player's "open BlackMusic" button). */
export async function focusMainWindow(): Promise<void> {
  const { getCurrentWindow } = await import("@tauri-apps/api/window");
  const win = getCurrentWindow();
  await win.unminimize();
  await win.show();
  await win.setFocus();
}