import { useCallback, useEffect, useRef } from "react";
import { useLibrary } from "@/app/context/LibraryContext";
import { usePlaylists } from "@/app/context/PlaylistsContext";
import { useFavorites } from "@/app/context/FavoritesContext";
import { usePlaybackHistory } from "@/app/context/PlaybackHistoryContext";
import { useAuth } from "@/app/context/AuthContext";
import { useSharedSetting } from "@/lib/sharedSetting";
import { runSync, SyncError } from "./engine";
import { registerSyncTrigger, setSyncStatus } from "./syncStore";
import { startP2PHost } from "./p2p";
import { fingerprintAll } from "./fingerprint";
import type { Track } from "@/lib/types";
const EVERY_MS = 10 * 60 * 1000;

/** Runs sync shortly after start, every 10 minutes, and a few seconds after playlists/favorites change — only when enabled and signed in. */
export function useSyncRunner() {
  const { tracks, ready } = useLibrary();
  const { playlists, replaceAll: replacePlaylists } = usePlaylists();
  const { favoriteIds, replaceAll: replaceFavorites } = useFavorites();
  const { events } = usePlaybackHistory();
  const { user } = useAuth();
  const [enabled] = useSharedSetting<boolean>("sync.enabled", false);
  const running = useRef(false);
  const latest = useRef({ tracks, playlists, favoriteIds, events });
  latest.current = { tracks, playlists, favoriteIds, events };

  const syncNow = useCallback(async () => {
    if (running.current) return;
    running.current = true;
    setSyncStatus({ state: "running", label: "Starting…" });
    try {
      const report = await runSync({ ...latest.current, replacePlaylists, replaceFavorites }, (label) => setSyncStatus({ state: "running", label }));
      setSyncStatus({ state: "done", report });
    } catch (e) {
      const err = e instanceof SyncError ? e : new SyncError(e instanceof Error ? e.message : String(e));
      setSyncStatus({ state: "error", message: err.message, kind: err.kind });
    } finally {
      running.current = false;
    }
  }, [replacePlaylists, replaceFavorites]);

  useEffect(() => {
    registerSyncTrigger(() => void syncNow());
    return () => registerSyncTrigger(null);
  }, [syncNow]);

  const active = enabled && Boolean(user) && ready;
  useEffect(() => {
    if (!active) return;
    const first = setTimeout(() => void syncNow(), 5_000);
    const every = setInterval(() => void syncNow(), EVERY_MS);
    return () => { clearTimeout(first); clearInterval(every); };
  }, [active, syncNow]);

  // FEAT-14: answer other devices that want one of this device's songs (direct connection; nothing is uploaded anywhere)
  useEffect(() => {
    if (!active) return;
    let stop: (() => void) | undefined;
    let alive = true;
    void (async () => {
      const fps = await fingerprintAll(latest.current.tracks);
      const byFp = new Map<string, Track>();
      for (const t of latest.current.tracks) { const fp = fps.get(t.id); if (fp && !byFp.has(fp)) byFp.set(fp, t); }
      try {
        const s = await startP2PHost((fp) => byFp.get(fp));
        if (alive) stop = s; else s();
      } catch { /* offline or not signed in: sync status already reports it; serving simply stays off */ }
    })();
    return () => { alive = false; stop?.(); };
  }, [active, tracks.length > 0]); // eslint-disable-line react-hooks/exhaustive-deps

  // small debounce after local organization changes, so a new playlist reaches the other device quickly
  useEffect(() => {
    if (!active) return;
    const t = setTimeout(() => void syncNow(), 4_000);
    return () => clearTimeout(t);
  }, [active, playlists, favoriteIds, syncNow]);

  return { syncNow, signedIn: Boolean(user) };
}
