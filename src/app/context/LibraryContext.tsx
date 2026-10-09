import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { Track } from "@/lib/types";
import { scanFolder } from "@/lib/library/scanFolder";
import { fastScanFolders, loadCoversByAlbum } from "@/lib/library/fastImport";
import { fetchAlbumArtwork } from "@/lib/services/lastfmClient";
import { useFolders } from "./FoldersContext";
import { useNotifications } from "./NotificationsContext";
import { useAppSettings } from "./AppSettingsContext";
import { isTauri } from "@/lib/platform";
import { getPreference, setPreference } from "@/lib/preferencesStore";

const CACHE_KEY = "blackmusic:tracksByFolder";
const HIDDEN_KEY = "blackmusic:hiddenTrackIds";
const REMOVED_KEY = "blackmusic:removedTrackIds";

interface LibraryContextValue {
  /** Visible library: excludes hidden and removed tracks. */
  tracks: Track[];
  hiddenIds: Set<string>;
  hiddenCount: number;
  hideTrack: (id: string) => void;
  unhideAll: () => void;
  /** Removes from the library (files stay on disk); a rescan won't bring it back. */
  removeFromLibrary: (id: string) => void;
  updateTrack: (id: string, patch: Partial<Pick<Track, "title" | "artist" | "album">>) => void;
  /** False only until the persisted cache has been read once, right at launch. */
  ready: boolean;
  scanning: boolean;
  /** Running count of files scanned so far during the current scan (unknown total — see Folder page). */
  scanProgress: number;
  /** Total files discovered for the current scan (0 until discovery finishes). */
  scanTotal: number;
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
  const [allTracks, setTracks] = useState<Track[]>([]);
  const [hiddenIds, setHiddenIds] = useState<Set<string>>(new Set());
  const [removedIds, setRemovedIds] = useState<Set<string>>(new Set());
  const removedRef = useRef(removedIds);
  removedRef.current = removedIds;
  const [scanning, setScanning] = useState(false);
  const [scanProgress, setScanProgress] = useState(0);
  const [scanTotal, setScanTotal] = useState(0);
  const allRef = useRef<Track[]>([]);
  allRef.current = allTracks;
  const [lastScanError, setLastScanError] = useState<string | null>(null);

  const scanRunId = useRef(0);

  useEffect(() => {
    getPreference<string[]>(HIDDEN_KEY, []).then((ids) => setHiddenIds(new Set(ids)));
    getPreference<string[]>(REMOVED_KEY, []).then((ids) => setRemovedIds(new Set(ids)));
  }, []);

  const tracks = useMemo(
    () => allTracks.filter((t) => !hiddenIds.has(t.id) && !removedIds.has(t.id)),
    [allTracks, hiddenIds, removedIds],
  );
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
        if (removedRef.current.has(track.id)) return; // user removed it from the library
        batch.push(track);
        if (!flushTimer) flushTimer = setTimeout(() => { flushTimer = null; flushBatch(); }, 120);
      };

      // ---- FAST PATH (2.1.0): discover -> parallel native metadata -> one batched write -> ONE UI update ----
      try {
        const known = allRef.current.filter((t) => foldersToScan.some((f) => t.path.startsWith(f)));
        const fast = await fastScanFolders(
          foldersToScan,
          known,
          (p) => {
            if (scanRunId.current !== runId) return;
            setScanProgress(p.done);
            setScanTotal(p.total);
          },
          () => scanRunId.current !== runId,
        );
        if (fast) {
          if (scanRunId.current !== runId) return;
          const visible = fast.tracks.filter((t) => !removedRef.current.has(t.id));
          // The single UI update for the whole import: swap in the scanned folders' tracks in one go.
          setTracks((prev) => {
            const kept = prev.filter((t) => !foldersToScan.some((f) => t.path.startsWith(f)));
            const next = [...kept, ...visible];
            schedulePersist(next); // single batched write of the whole library
            return next;
          });
          foldersToScan.forEach((f) => knownFolders.current.add(f));
          setScanProgress(visible.length);
          setScanning(false);
          push(
            "Library import complete",
            `${visible.length.toLocaleString()} track${visible.length === 1 ? "" : "s"} ready in ${(fast.elapsedMs / 1000).toFixed(1)}s` +
              (fast.reused > 0 ? ` (${fast.reread.toLocaleString()} new or changed, ${fast.reused.toLocaleString()} unchanged).` : "."),
          );
          // Album art arrives afterwards, a few batched updates in total.
          void loadCoversByAlbum(
            visible,
            fast.coverPaths,
            (artByAlbum) => {
              if (scanRunId.current !== runId) return;
              setTracks((prev) => {
                const next = prev.map((t) => {
                  const art = artByAlbum.get(`${t.artist}::${t.album}`);
                  return art && !t.artworkUrl ? { ...t, artworkUrl: art } : t;
                });
                schedulePersist(next);
                return next;
              });
            },
            () => scanRunId.current !== runId,
          ).then(() => enrichMissingArtwork(runId, visible.filter((t) => !t.artworkUrl)));
          return;
        }
      } catch (error) {
        if (scanRunId.current === runId) {
          setLastScanError(error instanceof Error ? error.message : String(error));
          setScanning(false);
        }
        return;
      }

      // ---- FALLBACK: the original JS scanner (only when the native importer isn't available) ----
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

  const hideTrack = useCallback((id: string) => {
    setHiddenIds((prev) => {
      const next = new Set(prev).add(id);
      void setPreference(HIDDEN_KEY, [...next]);
      return next;
    });
  }, []);

  const unhideAll = useCallback(() => {
    setHiddenIds(new Set());
    void setPreference(HIDDEN_KEY, []);
  }, []);

  const removeFromLibrary = useCallback(
    (id: string) => {
      setRemovedIds((prev) => {
        const next = new Set(prev).add(id);
        void setPreference(REMOVED_KEY, [...next]);
        return next;
      });
      setTracks((prev) => {
        const next = prev.filter((t) => t.id !== id);
        schedulePersist(next);
        return next;
      });
    },
    [schedulePersist],
  );

  const updateTrack = useCallback(
    (id: string, patch: Partial<Pick<Track, "title" | "artist" | "album">>) => {
      setTracks((prev) => {
        const next = prev.map((t) => (t.id === id ? { ...t, ...patch } : t));
        schedulePersist(next);
        return next;
      });
    },
    [schedulePersist],
  );

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
    <LibraryContext.Provider
      value={{
        tracks,
        hiddenIds,
        hiddenCount: hiddenIds.size,
        hideTrack,
        unhideAll,
        removeFromLibrary,
        updateTrack,
        ready: cacheReady,
        scanning,
        scanProgress,
        scanTotal,
        lastScanError,
        rescan,
      }}
    >
      {children}
    </LibraryContext.Provider>
  );
}

export function useLibrary(): LibraryContextValue {
  const ctx = useContext(LibraryContext);
  if (!ctx) throw new Error("useLibrary must be used within a LibraryProvider");
  return ctx;
}
