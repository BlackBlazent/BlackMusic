import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { getPreference, setPreference } from "@/lib/preferencesStore";
import { isTauri } from "@/lib/platform";
import { isMobileOs } from "@/lib/useIsMobile";
import { folderPathFromPicker, isInside } from "@/lib/library/pathUtils";
import { useNotifications } from "./NotificationsContext";

const STORAGE_KEY = "blackmusic:watchedFolders";
/** Folders that mobile discovery itself added (they get the gentler "skip system folders" scan options). */
const AUTO_KEY = "blackmusic:autoDiscoveredFolders";
/** Discovered folders the user explicitly removed — discovery won't re-add them unless they press "Find music on this device". */
const DECLINED_KEY = "blackmusic:declinedAutoFolders";
const MIGRATED_KEY = "blackmusic:autoFoldersMigrated2";

export interface StorageVolume {
  path: string;
  label: string;
  removable: boolean;
  readable: boolean;
}
export interface StorageProbe {
  platform: "android" | "ios" | "desktop";
  volumes: StorageVolume[];
  anyReadable: boolean;
  note: string | null;
}

export type AddFolderResult =
  | { ok: true; path: string }
  | { ok: false; reason: "cancelled" | "duplicate" | "covered" | "unsupported" | "error"; message: string };

interface FoldersContextValue {
  folders: string[];
  /** False until the persisted folder list has actually loaded — lets consumers
   * (LibraryContext) tell "genuinely no folders" apart from "haven't checked yet". */
  hydrated: boolean;
  addFolder: () => Promise<AddFolderResult>;
  removeFolder: (path: string) => void;
  /** True for folders that mobile discovery added (whole storage volumes). */
  isAutoFolder: (path: string) => boolean;
  /** Mobile: (re)detect internal storage + SD cards and watch the ones we can read. `force` also re-adds ones the user removed. */
  discover: (opts?: { force?: boolean }) => Promise<StorageProbe | null>;
  /** Last result of the storage probe (mobile) — drives the Folders page hints. */
  probe: StorageProbe | null;
}

const FoldersContext = createContext<FoldersContextValue | null>(null);

export function FoldersProvider({ children }: { children: ReactNode }) {
  const { push } = useNotifications();
  const [folders, setFolders] = useState<string[]>([]);
  const [autoFolders, setAutoFolders] = useState<string[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [probe, setProbe] = useState<StorageProbe | null>(null);
  const foldersRef = useRef<string[]>([]);
  foldersRef.current = folders;
  const autoRef = useRef<string[]>([]);
  autoRef.current = autoFolders;
  const declinedRef = useRef<string[]>([]);
  const discovering = useRef(false);

  const persistFolders = useCallback(async (next: string[]) => {
    foldersRef.current = next;
    setFolders(next);
    await setPreference(STORAGE_KEY, next); // awaited: callers only report success once this has reached disk
  }, []);

  const discover = useCallback(
    async (opts: { force?: boolean } = {}): Promise<StorageProbe | null> => {
      if (!isTauri() || !isMobileOs() || discovering.current) return null;
      discovering.current = true;
      try {
        const { invoke } = await import("@tauri-apps/api/core");
        const result = await invoke<StorageProbe>("storage_probe");
        setProbe(result);
        const declined = opts.force ? [] : declinedRef.current;
        if (opts.force) {
          declinedRef.current = [];
          await setPreference(DECLINED_KEY, []);
        }
        // Only volumes we can list right now. Before the media permission is granted (or with a card ejected) they're skipped —
        // and picked up on the next call, which fires every time the app comes back to the foreground.
        const fresh = result.volumes
          .filter((v) => v.readable)
          .map((v) => v.path)
          .filter((p) => !foldersRef.current.includes(p) && !declined.includes(p));
        if (fresh.length > 0) {
          // A whole volume supersedes the individual standard folders an older version added for it.
          const superseded = (f: string) => autoRef.current.includes(f) && fresh.some((root) => isInside(f, root));
          const kept = foldersRef.current.filter((f) => !superseded(f));
          const nextAuto = [...new Set([...autoRef.current.filter((f) => !superseded(f)), ...fresh])];
          autoRef.current = nextAuto;
          setAutoFolders(nextAuto);
          await setPreference(AUTO_KEY, nextAuto);
          await persistFolders([...kept, ...fresh]);
        }
        return result;
      } catch {
        return null;
      } finally {
        discovering.current = false;
      }
    },
    [persistFolders],
  );

  useEffect(() => {
    (async () => {
      const stored = await getPreference<string[]>(STORAGE_KEY, []);
      const auto = await getPreference<string[]>(AUTO_KEY, []);
      let declined = await getPreference<string[]>(DECLINED_KEY, []);
      // 2.2.0-initial marked every folder it ever offered as "offered once", so one removed in the Folders page
      // could never be rediscovered. Carry that forward as an explicit, reversible "declined" list.
      if (!(await getPreference<boolean>(MIGRATED_KEY, false))) {
        declined = [...new Set([...declined, ...auto.filter((f) => !stored.includes(f))])];
        await setPreference(DECLINED_KEY, declined);
        await setPreference(MIGRATED_KEY, true);
      }
      declinedRef.current = declined;
      foldersRef.current = stored;
      autoRef.current = auto;
      setAutoFolders(auto);
      setFolders(stored);
      setHydrated(true);
      void discover(); // mobile only; no-op elsewhere
    })();
  }, [discover]);

  // Mobile: every return to the app re-checks storage. This is what makes the library fill in right after the user
  // answers the permission prompt (the app is backgrounded while the dialog is up), or after an SD card is inserted.
  useEffect(() => {
    if (!isTauri() || !isMobileOs()) return;
    let last = 0;
    const onVisible = () => {
      if (document.visibilityState !== "visible" || Date.now() - last < 2500) return;
      last = Date.now();
      void discover();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [discover]);

  const addFolder = useCallback(async (): Promise<AddFolderResult> => {
    if (!isTauri()) {
      // eslint-disable-next-line no-console -- dev-mode signal, not an error
      console.warn("Folder picking requires the Tauri shell — run `pnpm tauri:dev`.");
      return { ok: false, reason: "unsupported", message: "Folder picking needs the BlackMusic app (it can't run in a plain browser tab)." };
    }
    let selected: string | string[] | null;
    try {
      const { open } = await import("@tauri-apps/plugin-dialog");
      selected = await open({ directory: true, multiple: false, title: "Add a music folder" });
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      push("Couldn't open the folder picker", message);
      return { ok: false, reason: "error", message };
    }
    const raw = Array.isArray(selected) ? selected[0] : selected;
    if (typeof raw !== "string" || raw.length === 0) return { ok: false, reason: "cancelled", message: "No folder was chosen." };

    const resolved = folderPathFromPicker(raw);
    if ("error" in resolved) {
      push("Can't add that folder", resolved.error);
      return { ok: false, reason: "unsupported", message: resolved.error };
    }
    const path = resolved.path;
    const current = foldersRef.current;
    if (current.some((f) => isInside(f, path) && isInside(path, f))) {
      push("Folder already added", `${path} is already being watched.`);
      return { ok: false, reason: "duplicate", message: "That folder is already added." };
    }
    const parent = current.find((f) => isInside(path, f));
    if (parent) {
      push("Already covered", `${path} is inside ${parent}, which is already scanned.`);
      return { ok: false, reason: "covered", message: `Already covered by ${parent}.` };
    }
    try {
      await persistFolders([...current, path]); // success is only reported after the list was written
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      push("Couldn't save the folder", message);
      return { ok: false, reason: "error", message };
    }
    push("Folder added", `${path} — scanning it now.`);
    return { ok: true, path };
  }, [persistFolders, push]);

  const removeFolder = useCallback(
    (path: string) => {
      if (autoRef.current.includes(path)) {
        // Remember the choice so discovery doesn't silently put it back.
        declinedRef.current = [...new Set([...declinedRef.current, path])];
        void setPreference(DECLINED_KEY, declinedRef.current);
      }
      void persistFolders(foldersRef.current.filter((f) => f !== path));
    },
    [persistFolders],
  );

  const isAutoFolder = useCallback((path: string) => autoRef.current.includes(path), []);

  return (
    <FoldersContext.Provider value={{ folders, hydrated, addFolder, removeFolder, isAutoFolder, discover, probe }}>
      {children}
    </FoldersContext.Provider>
  );
}

export function useFolders(): FoldersContextValue {
  const ctx = useContext(FoldersContext);
  if (!ctx) throw new Error("useFolders must be used within a FoldersProvider");
  return ctx;
}
