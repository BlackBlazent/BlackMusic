import { isMobileOs } from "@/lib/useIsMobile";

/**
 * Mobile native add-ons (3.0.0): FFmpeg (audio only) and whisper.cpp run as C/C++ libraries inside the Android app, reached through
 * `window.BMNative` (scripts/android/NativeBridge.kt.tpl). The libraries are OPTIONAL add-ons you drop into `native/` before
 * building (see docs/MOBILE_NATIVE.md); a build without them still works and every caller gets a clear "add-on not installed" error.
 */
interface NativeBridgeApi {
  capabilities(): string;
  ffmpegRun(id: string, argsJson: string): void;
  whisperTranscribe(id: string, modelPath: string, wavPath: string, language: string): void;
}
declare global {
  interface Window {
    BMNative?: NativeBridgeApi;
    __bmNativeResult?: (id: string, json: string) => void;
    /** Called by the iOS audio-session observer (scripts/ios/). */
    __bmInterruption?: (phase: "began" | "ended", shouldResume: boolean) => void;
  }
}

export class NativeAddonMissing extends Error {
  constructor(readonly addon: "ffmpeg" | "whisper") {
    super(
      addon === "ffmpeg"
        ? "Audio conversion isn't included in this build of BlackMusic. (It needs the FFmpeg add-on — see docs/MOBILE_NATIVE.md.)"
        : "Speech-to-text isn't included in this build of BlackMusic. (It needs the whisper.cpp add-on — see docs/MOBILE_NATIVE.md.)",
    );
    this.name = "NativeAddonMissing";
  }
}

export interface NativeCapabilities { ffmpeg: boolean; whisper: boolean }
export function nativeCapabilities(): NativeCapabilities {
  try {
    const c = window.BMNative?.capabilities();
    if (c) return JSON.parse(c) as NativeCapabilities;
  } catch { /* bridge missing or malformed -> no add-ons */ }
  return { ffmpeg: false, whisper: false };
}

const pending = new Map<string, { resolve: (v: string) => void; timer: ReturnType<typeof setTimeout> }>();
function ensureReceiver() {
  if (window.__bmNativeResult) return;
  window.__bmNativeResult = (id, json) => {
    const p = pending.get(id);
    if (!p) return;
    clearTimeout(p.timer);
    pending.delete(id);
    p.resolve(json);
  };
}

/** Calls a bridge method that answers later via window.__bmNativeResult. Never hangs: it gives up after `timeoutMs`. */
export function nativeCall(start: (id: string) => void, timeoutMs: number): Promise<string> {
  ensureReceiver();
  const id = crypto.randomUUID();
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => { pending.delete(id); reject(new Error("The device took too long to finish. Try a shorter file.")); }, timeoutMs);
    pending.set(id, { resolve, timer });
    try { start(id); } catch (e) { clearTimeout(timer); pending.delete(id); reject(e instanceof Error ? e : new Error(String(e))); }
  });
}

export const isMobileNative = () => isMobileOs() && Boolean(window.BMNative);
