import { isTauri } from "@/lib/platform";
import { isMobileOs } from "@/lib/useIsMobile";
import { NativeAddonMissing, nativeCall, nativeCapabilities } from "@/lib/mobileNative";

/** One entry point for audio conversion: the FFmpeg executable on desktop, the FFmpeg library add-on on mobile. */
export interface FfmpegResult { code: number; stderr: string }

export function ffmpegSupported(): boolean {
  return isMobileOs() ? nativeCapabilities().ffmpeg : isTauri();
}

export async function ffmpegRun(args: string[]): Promise<FfmpegResult> {
  if (isMobileOs()) {
    if (!nativeCapabilities().ffmpeg) throw new NativeAddonMissing("ffmpeg");
    const json = await nativeCall((id) => window.BMNative!.ffmpegRun(id, JSON.stringify(args)), 10 * 60_000);
    return JSON.parse(json) as FfmpegResult;
  }
  const { invoke } = await import("@tauri-apps/api/core");
  return invoke<FfmpegResult>("ffmpeg_run", { args });
}

/** Where converted files go. Desktop: the folder the user picks. Mobile: an app folder inside Music (picker URIs aren't writable paths). */
export async function conversionOutputDir(): Promise<string | null> {
  if (!isMobileOs()) {
    const { open } = await import("@tauri-apps/plugin-dialog");
    const dir = await open({ directory: true, title: "Choose an output folder" });
    return typeof dir === "string" ? dir : null;
  }
  if (/iPhone|iPad/i.test(navigator.userAgent)) {
    const { documentDir } = await import("@tauri-apps/api/path");
    return (await documentDir()).replace(/[\\/]+$/, "") + "/BlackMusic Converted";
  }
  return "/storage/emulated/0/Music/BlackMusic Converted";
}
