import { useMemo, useState } from "react";
import { useLibrary } from "@/app/context/LibraryContext";
import { usePlaylists } from "@/app/context/PlaylistsContext";
import { useFavorites } from "@/app/context/FavoritesContext";
import { usePlaybackHistory } from "@/app/context/PlaybackHistoryContext";
import { useNotifications } from "@/app/context/NotificationsContext";
import { getPreference } from "@/lib/preferencesStore";
import { readSharedSetting } from "@/lib/sharedSetting";
import { APP_VERSION } from "@/lib/appVersion";
import { getTrackExtras } from "@/lib/library/trackExtras";
import { BACKUP_FORMAT, BACKUP_VERSION, buildHistoryCsv, buildM3u8, buildTracksCsv, safeFileName, toPortable, type BackupFile } from "@/lib/backup/build";
import { PORTABLE_SETTINGS, DATA_KEYS, restoreFromText, undoLastRestore } from "@/lib/backup/restore";
import { pickTextFile, saveFilesToFolder, saveTextFile } from "@/lib/backup/files";

const stamp = () => new Date().toISOString().slice(0, 10);

/** FEAT-13 — Backup, export and portability. Everything stays on the user's device; the user chooses where files go. */
export function BackupSection() {
  const { tracks } = useLibrary();
  const { playlists } = usePlaylists();
  const { favoriteIds } = useFavorites();
  const { events, skips } = usePlaybackHistory();
  const { push } = useNotifications();
  const [busy, setBusy] = useState<string | null>(null);
  const byId = useMemo(() => new Map(tracks.map((t) => [t.id, t])), [tracks]);

  const run = async (label: string, job: () => Promise<void>) => {
    setBusy(label);
    try {
      await job();
    } catch (e) {
      push(`${label} failed`, e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  };

  const snapshot = async (): Promise<BackupFile> => {
    const extras = await getPreference<Record<string, { country?: string; mood?: string }>>(DATA_KEYS.trackExtras, {});
    for (const t of tracks) { const x = getTrackExtras(t.id); if (x.country || x.mood) extras[t.id] = x; }
    const settings: Record<string, unknown> = {};
    for (const k of PORTABLE_SETTINGS) settings[k] = readSharedSetting<unknown>(k, undefined);
    return {
      format: BACKUP_FORMAT, version: BACKUP_VERSION, createdAt: new Date().toISOString(), appVersion: APP_VERSION,
      library: tracks.map(toPortable), playlists, favorites: [...favoriteIds], playHistory: events, skipHistory: skips,
      trackExtras: extras, lifetimeStats: readSharedSetting<Record<string, number>>("lifetimeStats", {}), settings,
    };
  };

  const onBackup = () => run("Backup", async () => {
    const where = await saveTextFile(`BlackMusic-backup-${stamp()}.json`, JSON.stringify(await snapshot(), null, 2), "application/json");
    if (where) push("Backup saved", `Your playlists, favorites, history and settings were saved to ${where}. Music files are not included.`);
  });

  const onRestore = () => run("Restore", async () => {
    const text = await pickTextFile(["json"]);
    if (text === null) return;
    if (!window.confirm("Restore from this backup? It replaces your current playlists, favorites and listening history. BlackMusic keeps a copy of what you have now so you can undo this.")) return;
    const result = await restoreFromText(text, await snapshot());
    if (!result.ok) { push("Restore stopped", result.message); return; }
    push("Restore complete", `${result.playlists} playlists, ${result.favorites} favorites and ${result.plays} plays restored. Reloading…`);
    setTimeout(() => window.location.reload(), 900);
  });

  const onUndo = () => run("Undo restore", async () => {
    if (!(await undoLastRestore())) { push("Nothing to undo", "No restore has been made on this device."); return; }
    push("Restore undone", "Your previous data is back. Reloading…");
    setTimeout(() => window.location.reload(), 900);
  });

  const onJson = () => run("Library export", async () => {
    const where = await saveTextFile(`BlackMusic-library-${stamp()}.json`, JSON.stringify(await snapshot(), null, 2), "application/json");
    if (where) push("Library exported", `Saved to ${where}.`);
  });

  const onM3u = () => run("Playlist export", async () => {
    if (playlists.length === 0) { push("No playlists yet", "Create a playlist first, then export it."); return; }
    let skipped = 0;
    const files = playlists.map((p) => {
      const r = buildM3u8(p, byId);
      skipped += r.skipped;
      return { name: `${safeFileName(p.name)}.m3u8`, content: r.text };
    });
    const where = await saveFilesToFolder(files);
    if (where) push("Playlists exported", `${files.length} .m3u8 file(s) saved to ${where}.${skipped ? ` ${skipped} song(s) without a local file were skipped.` : ""} Paths are this device's — on another device, open the playlist from the folder that holds the music.`);
  });

  const onCsv = () => run("CSV export", async () => {
    const plays = new Map<string, number>();
    events.forEach((e) => plays.set(e.trackId, (plays.get(e.trackId) ?? 0) + 1));
    const where = await saveFilesToFolder([
      { name: `BlackMusic-tracks-${stamp()}.csv`, content: buildTracksCsv(tracks, favoriteIds, plays) },
      { name: `BlackMusic-listening-history-${stamp()}.csv`, content: buildHistoryCsv(events, byId) },
    ]);
    if (where) push("CSV exported", `Track metadata and listening history saved to ${where}.`);
  });

  const btn = (label: string, onClick: () => void, hint: string) => (
    <div className="settings__integration-row" key={label}>
      <div><span className="settings__integration-name">{label}</span><span className="settings__integration-desc">{hint}</span></div>
      <button type="button" className="settings__update-btn" disabled={busy !== null} onClick={onClick}>{busy === label ? "Working…" : label}</button>
    </div>
  );

  return (
    <section className="settings__section">
      <h2>Backup &amp; export</h2>
      <p>Your music files are never uploaded or changed. These tools save your <em>organization</em> — playlists, favorites, ratings-style data, play history and settings — so you are never locked in. API keys and sign-in sessions are never included.</p>
      {btn("Back up", onBackup, "Save everything above to one .json file you keep.")}
      {btn("Restore", onRestore, "Load a backup. The file is checked first; your current data is kept so you can undo.")}
      {btn("Undo restore", onUndo, "Go back to how things were before the last restore.")}
      {btn("Export library (JSON)", onJson, "A portable copy of your library metadata, playlists and history.")}
      {btn("Export playlists (M3U8)", onM3u, "One .m3u8 file per playlist, readable by most other players.")}
      {btn("Export CSV", onCsv, "Track metadata and listening history for spreadsheets.")}
    </section>
  );
}
