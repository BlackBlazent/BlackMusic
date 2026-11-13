import { useEffect, useRef, useState } from "react";
import { FloatingWindow } from "@/app/components/FloatingWindow";
import { usePlayback } from "@/app/context/PlaybackContext";
import { useFolders } from "@/app/context/FoldersContext";
import { useNotifications } from "@/app/context/NotificationsContext";
import { listRemoteFolderSongs, startTransfer, type RemoteSong } from "@/lib/sync/transfer";
import type { SyncedFolder } from "@/lib/sync/syncedFolders";
import { formatBytes } from "@/lib/formatBytes";
import { formatDuration } from "@/lib/formatDuration";
import type { Track } from "@/lib/types";
import "./SyncedFolderWindow.css";

/** FEAT-14 / IMP-08 — open a folder that lives on another device: play a song (copy or buffered stream per Settings) or copy them all. */
export function SyncedFolderWindow({ folder, onClose }: { folder: SyncedFolder; onClose: () => void }) {
  const [songs, setSongs] = useState<RemoteSong[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const { playTrack } = usePlayback();
  const { addFolderPath } = useFolders();
  const { push } = useNotifications();
  const abort = useRef(false);

  useEffect(() => {
    let alive = true;
    listRemoteFolderSongs(folder.deviceId, folder.deviceName, folder.name)
      .then((s) => alive && setSongs(s))
      .catch((e) => alive && setError(e instanceof Error ? e.message : String(e)));
    return () => { alive = false; abort.current = true; };
  }, [folder]);

  const asTrack = (s: RemoteSong, url: string): Track => ({ id: `sync:${s.fp}`, path: "", title: s.title, artist: s.artist || "Unknown artist", album: s.album || "Unknown album", duration: s.durationSec, sourceUrl: url, addedAt: Date.now() });

  const play = async (s: RemoteSong) => {
    setBusy(s.fp); setProgress(null);
    try {
      const t = await startTransfer(s, (done, total) => setProgress({ done, total }));
      const url = await t.incoming.ready;
      playTrack(asTrack(s, url), [asTrack(s, url)]);
      const saved = await t.finish();
      if (saved.folder) { await addFolderPath(saved.folder); push("Copied to this device", `“${s.title}” is saved and will appear in your library.`); }
    } catch (e) {
      push("Couldn't get that song", e instanceof Error ? e.message : String(e));
    } finally { setBusy(null); setProgress(null); }
  };

  const copyAll = async () => {
    if (!songs?.length) return;
    abort.current = false;
    let ok = 0;
    for (const [i, s] of songs.entries()) {
      if (abort.current) break;
      setBusy(`all:${i}`); setProgress(null);
      try {
        const t = await startTransfer({ ...s }, (done, total) => setProgress({ done, total }));
        if (t.decision.action !== "copy") { await t.incoming.done; push("Stopped", `${t.decision.reason} Copying the rest was skipped.`); break; }
        await t.incoming.done;
        const saved = await t.finish();
        if (saved.folder) await addFolderPath(saved.folder);
        ok++;
      } catch (e) { push("Copy stopped", e instanceof Error ? e.message : String(e)); break; }
    }
    setBusy(null); setProgress(null);
    if (ok) push("Copy finished", `${ok} song(s) saved to this device.`);
  };

  return (
    <FloatingWindow title={`${folder.name} · ${folder.deviceName}`} onClose={onClose} width={460} height={540}>
      <div className="sfw">
        <p className="sfw__tag">Sync from your device {folder.deviceName} — {folder.trackCount} songs, {formatBytes(folder.totalBytes)}. Songs move straight from that device; nothing is stored online.</p>
        <div className="sfw__bar">
          <button type="button" disabled={!songs?.length || busy !== null} onClick={() => void copyAll()}>Copy all to this device</button>
          {busy?.startsWith("all:") && <button type="button" onClick={() => { abort.current = true; }}>Stop</button>}
          {progress && <span className="sfw__pct">{progress.total ? `${Math.round((progress.done / progress.total) * 100)}%` : "…"}</span>}
        </div>
        {error && <p className="sfw__err" role="alert">{error}</p>}
        {!songs && !error && <p className="sfw__muted">Loading the song list…</p>}
        {songs?.length === 0 && <p className="sfw__muted">Nothing listed for this folder yet. Open BlackMusic on {folder.deviceName} and let it sync.</p>}
        <ul className="sfw__list">
          {songs?.map((s) => (
            <li key={s.fp}>
              <button type="button" disabled={busy !== null} onClick={() => void play(s)} title={`Play “${s.title}”`}>
                <strong>{s.title}</strong>
                <small>{s.artist} · {formatDuration(s.durationSec)} · {formatBytes(s.sizeBytes)}</small>
                <em>{busy === s.fp ? (progress?.total ? `${Math.round((progress.done / progress.total) * 100)}%` : "connecting…") : "▶"}</em>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </FloatingWindow>
  );
}
