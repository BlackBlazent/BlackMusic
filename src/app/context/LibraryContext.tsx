import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { Track } from "@/lib/types";
import { scanFolder } from "@/lib/library/scanFolder";
import { fastScanFolders, loadCoversByAlbum, type FolderScanReport } from "@/lib/library/fastImport";
import { isInside, owningFolder } from "@/lib/library/pathUtils";
import { fetchAlbumArtwork } from "@/lib/services/lastfmClient";
import { useFolders } from "./FoldersContext";
import { useNotifications } from "./NotificationsContext";
import { useAppSettings } from "./AppSettingsContext";
import { isTauri } from "@/lib/platform";
import { getPreference, setPreference } from "@/lib/preferencesStore";

const CACHE_KEY = "blackmusic:tracksByFolder";
const HIDDEN_KEY = "blackmusic:hiddenTrackIds";
const REMOVED_KEY = "blackmusic:removedTrackIds";
/** Per-folder outcome of the last scan (status, counts, skipped types, unreadable sub-folders) — survives restarts. */
const SCAN_STATE_KEY = "blackmusic:folderScanState";
/** An up-to-date folder isn't re-walked on every launch; one older than this gets a cheap incremental refresh. */
const REFRESH_AFTER_MS = 6 * 60 * 60 * 1000;
/** Whole-volume roots found by mobile discovery: honour .nomedia, skip hidden/system/camera folders. */
const AUTO_SCAN_OPTIONS = { respectNomedia: true, skipDirs: ["Android", "DCIM", "Pictures", "Movies", "Ringtones", "Notifications", "Alarms"] };

interface LibraryContextValue {
  /** Visible library: excludes hidden and removed tracks. */
  tracks: Track[];
  hiddenIds: Set<string>;
  hiddenCount: number;
  hideTrack: (id: string) => void;
  unhideAll: () => void;
  /** Removes from the library (files stay on disk); a rescan won't bring it back. */
  removeFromLibrary: (id: string) => void;
  updateTrack: (id: string, patch: Partial<Pick<Track, "title" | "artist" | "album" | "albumArtist" | "year" | "genre" | "composer" | "comment" | "artworkUrl">>) => void;
  /** False only until the persisted cache has been read once, right at launch. */
  ready: boolean;
  scanning: boolean;
  /** Running count of files scanned so far during the current scan (unknown total — see Folder page). */
  scanProgress: number;
  /** Total files discovered for the current scan (0 until discovery finishes). */
  scanTotal: number;
  lastScanError: string | null;
  /** Outcome of the last scan per watched folder (complete / empty / partial / inaccessible). */
  scanReports: Record<string, FolderScanReport>;
  /** Re-walks every watched folder (new files are discovered; unchanged files reuse their cached tags).
   *  `{ full: true }` additionally re-reads every file's tags. Scans are queued — never run concurrently. */
  rescan: (opts?: { full?: boolean }) => Promise<void>;
  /** Stops the running scan; tracks already in the library are untouched. */
  cancelScan: () => void;
}

const LibraryContext = createContext<LibraryContextValue | null>(null);

/** Each track lands in exactly ONE bucket (its most specific watched folder), so nested watched folders never double-count. */
function groupByFolder(tracks: Track[], folders: string[]): Record<string, Track[]> {
  const grouped: Record<string, Track[]> = {};
  for (const folder of folders) grouped[folder] = [];
  for (const t of tracks) {
    const owner = owningFolder(t.path, folders);
    if (owner) grouped[owner].push(t);
  }
  return grouped;
}

export function LibraryProvider({ children }: { children: ReactNode }) {
  const { folders, hydrated: foldersHydrated, isAutoFolder } = useFolders();
  const foldersRef = useRef<string[]>(folders);
  foldersRef.current = folders;
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
  const [scanReports, setScanReports] = useState<Record<string, FolderScanReport>>({});
  const [reportsReady, setReportsReady] = useState(false);
  const pendingScans = useRef<Map<string, { full: boolean }>>(new Map());
  const draining = useRef(false);
  const launchRefreshDone = useRef(false);

  useEffect(() => {
    getPreference<string[]>(HIDDEN_KEY, []).then((ids) => setHiddenIds(new Set(ids)));
    getPreference<string[]>(REMOVED_KEY, []).then((ids) => setRemovedIds(new Set(ids)));
    getPreference<Record<string, FolderScanReport>>(SCAN_STATE_KEY, {}).then((r) => {
      setScanReports(r);
      setReportsReady(true);
    });
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
    async (foldersToScan: string[], fullFolders: string[] = []) => {
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
        const known = allRef.current.filter((t) => foldersToScan.some((f) => isInside(t.path, f)));
        const fast = await fastScanFolders(
          foldersToScan,
          known,
          (p) => {
            if (scanRunId.current !== runId) return;
            setScanProgress(p.done);
            setScanTotal(p.total);
          },
          () => scanRunId.current !== runId,
          (folder) => (isAutoFolder(folder) ? AUTO_SCAN_OPTIONS : {}),
          fullFolders,
        );
        if (fast) {
          if (scanRunId.current !== runId) return;
          // A folder the user removed while this scan was running must not come back.
          const live = new Set(foldersRef.current);
          const reports = fast.reports.filter((r) => live.has(r.folder));
          // Only folders that were actually listed may replace their tracks. An inaccessible / cancelled folder KEEPS what it had:
          // a revoked permission or an ejected SD card is not an empty folder.
          const usable = reports.filter((r) => r.status === "complete" || r.status === "empty" || r.status === "partial").map((r) => r.folder);
          const usableTracks = fast.tracks.filter((t) => usable.some((f) => isInside(t.path, f)));
          const visible = usableTracks.filter((t) => !removedRef.current.has(t.id));
          // The single UI update for the whole import: swap in the scanned folders' tracks in one go.
          setTracks((prev) => {
            const kept = prev.filter((t) => !usable.some((f) => isInside(t.path, f)));
            const next = [...kept, ...visible];
            schedulePersist(next); // single batched write of the whole library
            return next;
          });
          usable.forEach((f) => knownFolders.current.add(f));
          setScanReports((prev) => {
            const next = { ...prev };
            for (const f of Object.keys(next)) if (!live.has(f)) delete next[f];
            for (const r of reports) next[r.folder] = r;
            void setPreference(SCAN_STATE_KEY, next);
            return next;
          });
          setScanProgress(visible.length);
          setScanning(false);
          const blocked = reports.filter((r) => r.status === "inaccessible");
          const partial = reports.filter((r) => r.status === "partial");
          const ignored = new Map<string, number>();
          for (const r of reports) for (const i of r.ignored) ignored.set(i.ext, (ignored.get(i.ext) ?? 0) + i.count);
          const topIgnored = [...ignored.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([ext, n]) => `.${ext} ×${n}`).join(", ");
          push(
            blocked.length > 0 && usable.length === 0 ? "Library scan couldn't read your folders" : "Library import complete",
            `${visible.length.toLocaleString()} track${visible.length === 1 ? "" : "s"} ready in ${(fast.elapsedMs / 1000).toFixed(1)}s` +
              (fast.reused > 0 ? ` (${fast.reread.toLocaleString()} new or changed, ${fast.reused.toLocaleString()} unchanged).` : ".") +
              (blocked.length > 0 ? ` Couldn't open ${blocked.length} folder${blocked.length === 1 ? "" : "s"} (${blocked[0].error}) — your existing tracks there were kept.` : "") +
              (partial.length > 0 ? ` ${partial.reduce((n, r) => n + r.unreadableCount, 0)} sub-folder(s) couldn't be read.` : "") +
              (topIgnored ? ` Skipped non-audio files: ${topIgnored}.` : ""),
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
      setTracks((prev) => prev.filter((t) => !foldersToScan.some((f) => isInside(t.path, f))));

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
    [push, enrichMissingArtwork, schedulePersist, isAutoFolder],
  );

  // Hydrate from the persisted per-folder cache once, on mount — instant, no scanning.
  useEffect(() => {
    getPreference<Record<string, Track[]>>(CACHE_KEY, {}).then((cache) => {
      const cachedFolders = Object.keys(cache);
      knownFolders.current = new Set(cachedFolders);
      // Older caches could hold the same file under two overlapping folders — keep one copy per path.
      const unique = new Map<string, Track>();
      for (const t of cachedFolders.flatMap((f) => cache[f])) if (!unique.has(t.path)) unique.set(t.path, t);
      setTracks([...unique.values()]);
      setCacheReady(true);
    });
  }, []);

  // ---- One coherent scan lifecycle: request -> queue -> run (never two at once) -> report. ----
  const drainScans = useCallback(async () => {
    if (draining.current) return;
    draining.current = true;
    try {
      while (pendingScans.current.size > 0) {
        const batch = [...pendingScans.current.entries()].filter(([f]) => foldersRef.current.includes(f));
        pendingScans.current.clear();
        if (batch.length === 0) continue;
        await scanFolders(batch.map(([f]) => f), batch.filter(([, o]) => o.full).map(([f]) => f));
      }
    } finally {
      draining.current = false;
    }
  }, [scanFolders]);

  const requestScan = useCallback(
    (list: string[], opts: { full?: boolean } = {}) => {
      if (!isTauri()) return;
      for (const f of list) pendingScans.current.set(f, { full: Boolean(opts.full) || Boolean(pendingScans.current.get(f)?.full) });
      void drainScans();
    },
    [drainScans],
  );

  // Folders added/removed, plus ONE launch-time refresh of anything that was never scanned, failed last time, or is stale.
  // (A folder that scanned fine recently is NOT re-walked on every launch.)
  useEffect(() => {
    if (!foldersHydrated || !cacheReady || !reportsReady) return;

    const currentSet = new Set(folders);
    const removed = [...knownFolders.current].filter((f) => !currentSet.has(f));
    const added = folders.filter((f) => !knownFolders.current.has(f));

    if (removed.length > 0) {
      removed.forEach((f) => knownFolders.current.delete(f));
      setTracks((prev) => {
        // Keep tracks still covered by another watched folder.
        const next = prev.filter((t) => owningFolder(t.path, folders) !== null || !removed.some((f) => isInside(t.path, f)));
        schedulePersist(next);
        return next;
      });
      setScanReports((prev) => {
        const next = { ...prev };
        removed.forEach((f) => delete next[f]);
        void setPreference(SCAN_STATE_KEY, next);
        return next;
      });
    }

    let toScan = added;
    if (!launchRefreshDone.current) {
      launchRefreshDone.current = true;
      const stale = folders.filter((f) => {
        const r = scanReports[f];
        if (!r) return true; // cached by an older version, or the scan never finished
        if (r.status === "inaccessible" || r.status === "cancelled" || r.status === "partial") return true;
        return Date.now() - r.finishedAt > REFRESH_AFTER_MS;
      });
      toScan = [...new Set([...added, ...stale])];
    }
    if (toScan.length > 0) requestScan(toScan);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- runs off `folders`; helpers are stable via useCallback
  }, [folders, foldersHydrated, cacheReady, reportsReady]);

  // Coming back to the app (e.g. after granting the storage permission in system settings, or re-inserting an SD card):
  // retry folders that couldn't be read last time. Cheap — a healthy library is left alone.
  useEffect(() => {
    if (!isTauri()) return;
    const onVisible = () => {
      if (document.visibilityState !== "visible") return;
      const broken = foldersRef.current.filter((f) => {
        const r = scanReports[f];
        return r && r.status === "inaccessible";
      });
      if (broken.length > 0) requestScan(broken);
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [scanReports, requestScan]);

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
    (id: string, patch: Partial<Pick<Track, "title" | "artist" | "album" | "albumArtist" | "year" | "genre" | "composer" | "comment" | "artworkUrl">>) => {
      setTracks((prev) => {
        const next = prev.map((t) => (t.id === id ? { ...t, ...patch } : t));
        schedulePersist(next);
        return next;
      });
    },
    [schedulePersist],
  );

  const rescan = useCallback(
    async (opts: { full?: boolean } = {}) => {
      if (folders.length === 0) {
        knownFolders.current = new Set();
        setTracks([]);
        void setPreference(CACHE_KEY, {});
        return;
      }
      requestScan(folders, opts);
    },
    [folders, requestScan],
  );

  const cancelScan = useCallback(() => {
    pendingScans.current.clear();
    if (!isTauri()) return;
    void import("@tauri-apps/api/core").then(({ invoke }) => invoke("cancel_scan").catch(() => undefined));
  }, []);

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
        scanReports,
        rescan,
        cancelScan,
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
