import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import type { Track } from "@/lib/types";
import { scanFolder } from "@/lib/library/scanFolder";
import { fetchAlbumArtwork } from "@/lib/services/lastfmClient";
import { useFolders } from "./FoldersContext";
import { useNotifications } from "./NotificationsContext";
import { useAppSettings } from "./AppSettingsContext";
import { isTauri } from "@/lib/platform";
import { getPreference, setPreference } from "@/lib/preferencesStore";

const CACHE_KEY = "blackmusic:tracksByFolder";

interface LibraryContextValue {
  tracks: Track[];
  /** False only until the persisted cache has been read once, right at launch. */
  ready: boolean;
  scanning: boolean;
  /** Running count of files scanned so far during the current scan (unknown total — see Folder page). */
  scanProgress: number;
  lastScanError: string | null;
  /** Full refresh of every watched folder. Adding/removing a folder alone does NOT
   * trigger this — only the newly added or removed folder is touched, see below. */
  rescan: () => Promise<void>;
}

const LibraryContext = createContext<LibraryContextValue | null>(null);

function groupByFolder(tracks: Track[], folders: string[]): Record<string, Track[]> {
  const grouped: Record<string, Track[]> = {};
  for (const folder of folders) {
    grouped[folder] = tracks.filter((t) => t.path.startsWith(folder));
  }
  return grouped;
}

export function LibraryProvider({ children }: { children: ReactNode }) {
  const { folders, hydrated: foldersHydrated } = useFolders();
  const { push } = useNotifications();
  const { isEnabled } = useAppSettings();
  const [tracks, setTracks] = useState<Track[]>([]);
  const [scanning, setScanning] = useState(false);
  const [scanProgress, setScanProgress] = useState(0);
  const [lastScanError, setLastScanError] = useState<string | null>(null);

  const scanRunId = useRef(0);
  const [cacheReady, setCacheReady] = useState(false);
  // Folders we already have cached tracks for — a folder only gets (re)scanned
  // when it's not in this set (newly added) or via an explicit full rescan.
  const knownFolders = useRef<Set<string>>(new Set());
  const persistTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Debounced so a burst of updates (e.g. Last.fm enrichment resolving one
  // album after another) writes to disk once, not once per track.
  const schedulePersist = useCallback(
    (nextTracks: Track[]) => {
      if (persistTimer.current) clearTimeout(persistTimer.current);
      persistTimer.current = setTimeout(() => {
        void setPreference(CACHE_KEY, groupByFolder(nextTracks, folders));
      }, 500);
    },
    [folders],
  );

  // Best-effort background pass: fills in album art for tracks whose files had
  // none embedded, via Last.fm. Runs after a scan finishes and never blocks
  // anything — updates are batched (not one setTracks per album) so it doesn't
  // cause a re-render storm across every page that reads the library.
  const enrichMissingArtwork = useCallback(
    async (runId: number, scanned: Track[]) => {
      if (!isEnabled("lastfm") || !import.meta.env.VITE_LASTFM_API_KEY || scanned.length === 0) return;

      const seen = new Set<string>();
      const albumsNeedingArt = scanned.filter((t) => {
        if (t.artworkUrl) return false;
        const key = `${t.artist}::${t.album}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
      if (albumsNeedingArt.length === 0) return;

      const resolved = new Map<string, string>();
      let flushTimer: ReturnType<typeof setTimeout> | null = null;

      const flush = () => {
        if (resolved.size === 0 || scanRunId.current !== runId) return;
        const snapshot = new Map(resolved);
        resolved.clear();
        setTracks((prev) => {
          const next = prev.map((t) => {
            const artUrl = snapshot.get(`${t.artist}::${t.album}`);
            return artUrl && !t.artworkUrl ? { ...t, artworkUrl: artUrl } : t;
          });
          schedulePersist(next);
          return next;
        });
      };

      const CONCURRENCY = 4;
      let index = 0;
      async function worker() {
        while (index < albumsNeedingArt.length) {
          if (scanRunId.current !== runId) return;
          const target = albumsNeedingArt[index++];
          const artUrl = await fetchAlbumArtwork(target.artist, target.album);
          if (artUrl && scanRunId.current === runId) {
            resolved.set(`${target.artist}::${target.album}`, artUrl);
            if (!flushTimer) flushTimer = setTimeout(() => { flushTimer = null; flush(); }, 400);
          }
        }
      }
      await Promise.all(Array.from({ length: Math.min(CONCURRENCY, albumsNeedingArt.length) }, worker));
      if (flushTimer) clearTimeout(flushTimer);
      flush();
    },
    [schedulePersist, isEnabled],
  );

  const scanFolders = useCallback(
    async (foldersToScan: string[]) => {
      if (!isTauri() || foldersToScan.length === 0) return;
      const runId = ++scanRunId.current;
      setScanning(true);
      setScanProgress(0);
      setLastScanError(null);

      // Tracks appear in the list as they're found instead of only once the
      // entire folder is done — batched every ~120ms so a fast scan doesn't
      // turn into hundreds of individual re-renders either.
      let batch: Track[] = [];
      let flushTimer: ReturnType<typeof setTimeout> | null = null;
      const flushBatch = () => {
        if (batch.length === 0 || scanRunId.current !== runId) return;
        const toAdd = batch;
        batch = [];
        setTracks((prev) => [...prev, ...toAdd]);
      };
      const queueTrack = (track: Track) => {
        batch.push(track);
        if (!flushTimer) flushTimer = setTimeout(() => { flushTimer = null; flushBatch(); }, 120);
      };

      // Clear any existing entries for these folders up front (covers both a
      // full rescan of everything and the rare case of scanning a folder that
      // already had some cached tracks) so the progressive re-additions below
      // never end up duplicated alongside stale ones.
      setTracks((prev) => prev.filter((t) => !foldersToScan.some((f) => t.path.startsWith(f))));

      try {
        let total = 0;
        const results = await Promise.all(
          foldersToScan.map((folder) =>
            scanFolder(
              folder,
              (track) => {
                if (scanRunId.current !== runId) return;
                total += 1;
                setScanProgress(total);
                queueTrack(track);
              },
              () => scanRunId.current !== runId,
            ),
          ),
        );
        const freshTracks = results.flat();
        if (scanRunId.current !== runId) return;

        if (flushTimer) clearTimeout(flushTimer);
        flushBatch();

        foldersToScan.forEach((f) => knownFolders.current.add(f));
        // The progressive batches above are the definitive source of truth for
        // what's on screen; this just makes sure the persisted cache reflects
        // the exact final set (in case a batch flush ever raced a removal).
        setTracks((prev) => {
          schedulePersist(prev);
          return prev;
        });

        push(
          "Library scan complete",
          `Found ${freshTracks.length} track${freshTracks.length === 1 ? "" : "s"} in ${
            foldersToScan.length === 1 ? "the new folder" : `${foldersToScan.length} folders`
          }.`,
        );
        void enrichMissingArtwork(runId, freshTracks);
      } catch (error) {
        if (scanRunId.current === runId) {
          setLastScanError(error instanceof Error ? error.message : "Scan failed");
        }
      } finally {
        if (scanRunId.current === runId) setScanning(false);
      }
    },
    [push, enrichMissingArtwork, schedulePersist],
  );

  // Hydrate from the persisted per-folder cache once, on mount — instant, no scanning.
  useEffect(() => {
    getPreference<Record<string, Track[]>>(CACHE_KEY, {}).then((cache) => {
      const cachedFolders = Object.keys(cache);
      knownFolders.current = new Set(cachedFolders);
      setTracks(cachedFolders.flatMap((f) => cache[f]));
      setCacheReady(true);
    });
  }, []);

  // Reacts to folders being added or removed — scans ONLY the delta, never
  // the whole library, and never on a plain remount/HMR reload.
  useEffect(() => {
    if (!foldersHydrated || !cacheReady) return;

    const currentSet = new Set(folders);
    const removed = [...knownFolders.current].filter((f) => !currentSet.has(f));
    const added = folders.filter((f) => !knownFolders.current.has(f));

    if (removed.length > 0) {
      removed.forEach((f) => knownFolders.current.delete(f));
      setTracks((prev) => {
        const next = prev.filter((t) => !removed.some((f) => t.path.startsWith(f)));
        schedulePersist(next);
        return next;
      });
    }
    if (added.length > 0) void scanFolders(added);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- runs off `folders`; helpers are stable via useCallback
  }, [folders, foldersHydrated, cacheReady]);

  const rescan = useCallback(async () => {
    if (folders.length === 0) {
      knownFolders.current = new Set();
      setTracks([]);
      void setPreference(CACHE_KEY, {});
      return;
    }
    await scanFolders(folders);
  }, [folders, scanFolders]);

  return (
    <LibraryContext.Provider value={{ tracks, ready: cacheReady, scanning, scanProgress, lastScanError, rescan }}>
      {children}
    </LibraryContext.Provider>
  );
}

export function useLibrary(): LibraryContextValue {
  const ctx = useContext(LibraryContext);
  if (!ctx) throw new Error("useLibrary must be used within a LibraryProvider");
  return ctx;
}
