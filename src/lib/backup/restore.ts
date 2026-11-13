import { getPreference, setPreference } from "@/lib/preferencesStore";
import { writeSharedSetting } from "@/lib/sharedSetting";
import { BACKUP_FORMAT, validateBackup, type BackupFile } from "./build";

/** Preference keys that make up the user's data (never keys/tokens/sessions). Single place, used by backup AND restore. */
export const DATA_KEYS = {
  playlists: "blackmusic:playlists",
  favorites: "blackmusic:favorites",
  playHistory: "blackmusic:playHistory",
  skipHistory: "blackmusic:skipHistory",
  trackExtras: "blackmusic:trackExtras",
} as const;

export const SAFETY_COPY_KEY = "blackmusic:backup:beforeLastRestore";
/** Non-secret app settings that travel with a backup. */
export const PORTABLE_SETTINGS = ["seekAnimation", "fullscreenControls", "onlineArtShine", "autoUpdateCheck", "falModel"] as const;

export type RestoreResult = { ok: true; playlists: number; favorites: number; plays: number } | { ok: false; message: string };

/** Parses + validates the text of a backup file and, only when it is sound, replaces playlists/favorites/history/extras. */
export async function restoreFromText(text: string, currentSnapshot: BackupFile): Promise<RestoreResult> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { ok: false, message: "That file isn't valid JSON, so nothing was changed." };
  }
  const problem = validateBackup(parsed);
  if (problem) return { ok: false, message: problem };
  const b = parsed as BackupFile;
  if (b.format !== BACKUP_FORMAT) return { ok: false, message: "Unexpected file format." };

  // Recovery safety: keep what's there now, so a restore can itself be undone.
  await setPreference(SAFETY_COPY_KEY, currentSnapshot);

  await setPreference(DATA_KEYS.playlists, b.playlists);
  await setPreference(DATA_KEYS.favorites, b.favorites);
  await setPreference(DATA_KEYS.playHistory, b.playHistory);
  await setPreference(DATA_KEYS.skipHistory, b.skipHistory ?? []);
  await setPreference(DATA_KEYS.trackExtras, b.trackExtras ?? {});
  if (b.lifetimeStats) writeSharedSetting("lifetimeStats", b.lifetimeStats);
  for (const k of PORTABLE_SETTINGS) if (b.settings && k in b.settings) writeSharedSetting(k, b.settings[k]);
  return { ok: true, playlists: b.playlists.length, favorites: b.favorites.length, plays: b.playHistory.length };
}

/** Undo the last restore. Returns false when there is nothing to undo. */
export async function undoLastRestore(): Promise<boolean> {
  const prev = await getPreference<BackupFile | null>(SAFETY_COPY_KEY, null);
  if (!prev) return false;
  const r = await restoreFromText(JSON.stringify(prev), prev);
  return r.ok;
}
