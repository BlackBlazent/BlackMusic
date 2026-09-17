import { isTauri } from "./platform";

export interface UpdateInfo {
  version: string;
  date?: string;
  body?: string;
}

/** Returns update info if one's available, or null if already up to date. */
export async function checkForUpdate(): Promise<UpdateInfo | null> {
  if (!isTauri()) return null;
  const { check } = await import("@tauri-apps/plugin-updater");
  const update = await check();
  if (!update) return null;
  return { version: update.version, date: update.date, body: update.body };
}

/** Downloads and installs the pending update, then relaunches the app. */
export async function installUpdateAndRelaunch(onProgress?: (downloaded: number, total: number | null) => void): Promise<void> {
  if (!isTauri()) return;
  const { check } = await import("@tauri-apps/plugin-updater");
  const { relaunch } = await import("@tauri-apps/plugin-process");

  const update = await check();
  if (!update) return;

  let downloaded = 0;
  let total: number | null = null;
  await update.downloadAndInstall((event) => {
    if (event.event === "Started") total = event.data.contentLength ?? null;
    if (event.event === "Progress") downloaded += event.data.chunkLength;
    onProgress?.(downloaded, total);
  });

  await relaunch();
}
