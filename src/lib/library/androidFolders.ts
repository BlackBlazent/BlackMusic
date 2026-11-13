import { isMobileOs } from "@/lib/useIsMobile";
import { nativeCall } from "@/lib/mobileNative";

/** Android bridge installed by scripts/android/StorageBridge.kt.tpl. */
declare global {
  interface Window {
    BMStorage?: {
      openForWrite?(id: string, path: string): void;
      pickFolder?(id: string): void;
      listAudioDirs?(id: string): void;
    };
  }
}

/** True when this APK has the native folder picker (tauri-plugin-dialog can't pick folders on Android). */
export const hasNativeFolderPicker = () => isMobileOs() && typeof window.BMStorage?.pickFolder === "function";

/** Opens Android's "choose a folder" screen. Returns the content:// tree URI, or null when cancelled. */
export async function pickAndroidFolder(): Promise<string | null> {
  const bridge = window.BMStorage;
  if (!bridge?.pickFolder) throw new Error("This build of BlackMusic can't open the folder picker. Update the app.");
  const r = JSON.parse(await nativeCall((id) => bridge.pickFolder!(id), 300_000)) as { ok: boolean; uri?: string | null; error?: string };
  if (!r.ok) throw new Error(r.error ?? "The folder picker failed.");
  return r.uri ?? null;
}

/** Folders that contain music according to Android's media index — covers SD cards and USB drives. [] when unavailable. */
export async function mediaStoreAudioDirs(): Promise<string[]> {
  const bridge = window.BMStorage;
  if (!isMobileOs() || !bridge?.listAudioDirs) return [];
  try {
    const r = JSON.parse(await nativeCall((id) => bridge.listAudioDirs!(id), 30_000)) as { ok: boolean; dirs?: string[] };
    return r.ok && Array.isArray(r.dirs) ? r.dirs : [];
  } catch {
    return [];
  }
}
