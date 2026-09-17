import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { getPreference, setPreference } from "@/lib/preferencesStore";
import { isTauri } from "@/lib/platform";

const STORAGE_KEY = "blackmusic:watchedFolders";

interface FoldersContextValue {
  folders: string[];
  /** False until the persisted folder list has actually loaded — lets consumers
   * (LibraryContext) tell "genuinely no folders" apart from "haven't checked yet". */
  hydrated: boolean;
  addFolder: () => Promise<void>;
  removeFolder: (path: string) => void;
}

const FoldersContext = createContext<FoldersContextValue | null>(null);

export function FoldersProvider({ children }: { children: ReactNode }) {
  const [folders, setFolders] = useState<string[]>([]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    getPreference<string[]>(STORAGE_KEY, []).then((stored) => {
      setFolders(stored);
      setHydrated(true);
    });
  }, []);

  const persist = (next: string[]) => {
    setFolders(next);
    void setPreference(STORAGE_KEY, next);
  };

  const addFolder = async () => {
    if (!isTauri()) {
      // eslint-disable-next-line no-console -- dev-mode signal, not an error
      console.warn("Folder picking requires the Tauri shell — run `pnpm tauri:dev`.");
      return;
    }
    const { open } = await import("@tauri-apps/plugin-dialog");
    const selected = await open({ directory: true, multiple: false, title: "Add a music folder" });
    if (typeof selected !== "string") return;
    if (folders.includes(selected)) return;
    persist([...folders, selected]);
  };

  const removeFolder = (path: string) => {
    persist(folders.filter((f) => f !== path));
  };

  return (
    <FoldersContext.Provider value={{ folders, hydrated, addFolder, removeFolder }}>
      {children}
    </FoldersContext.Provider>
  );
}

export function useFolders(): FoldersContextValue {
  const ctx = useContext(FoldersContext);
  if (!ctx) throw new Error("useFolders must be used within a FoldersProvider");
  return ctx;
}
