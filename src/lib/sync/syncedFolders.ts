import { useSharedSetting } from "@/lib/sharedSetting";

/**
 * IMP-08 §2 — folders that exist on ANOTHER signed-in device of the same account. Replicated by NAME only: no file is copied.
 * The Folder page shows them tagged "Sync from your device [name]". Filled by the sync engine (FEAT-12); empty until sync is on.
 * Whether a song is later copied or streamed to this device is decided by the sync transfer mode (FEAT-14).
 */
export interface SyncedFolder {
  /** Folder display name only — never a path (paths are device-specific and private). */
  name: string;
  deviceId: string;
  deviceName: string;
  trackCount: number;
  totalBytes: number;
  /** Folder names directly inside it (names only). */
  subfolders?: { name: string; trackCount: number; totalBytes: number }[];
}

export const useSyncedFolders = () => useSharedSetting<SyncedFolder[]>("sync.remoteFolders", [])[0];
export const syncTag = (deviceName: string) => `Sync from your device ${deviceName}`;
