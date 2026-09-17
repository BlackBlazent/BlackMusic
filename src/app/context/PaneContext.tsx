import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { getPreference, setPreference } from "@/lib/preferencesStore";

const WIDTH_KEY = "blackmusic:sidebarWidth";
const COLLAPSED_KEY = "blackmusic:sidebarCollapsed";

export const SIDEBAR_MIN_WIDTH = 200;
export const SIDEBAR_MAX_WIDTH = 340;
export const SIDEBAR_COLLAPSED_WIDTH = 72;

interface PaneContextValue {
  collapsed: boolean;
  width: number;
  toggleCollapsed: () => void;
  setWidth: (width: number) => void;
}

const PaneContext = createContext<PaneContextValue | null>(null);

export function PaneProvider({ children }: { children: ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const [width, setWidthState] = useState(232);

  useEffect(() => {
    getPreference(COLLAPSED_KEY, false).then(setCollapsed);
    getPreference(WIDTH_KEY, 232).then(setWidthState);
  }, []);

  const toggleCollapsed = () => {
    const next = !collapsed;
    setCollapsed(next);
    void setPreference(COLLAPSED_KEY, next);
  };

  const setWidth = (next: number) => {
    const clamped = Math.min(SIDEBAR_MAX_WIDTH, Math.max(SIDEBAR_MIN_WIDTH, next));
    setWidthState(clamped);
    void setPreference(WIDTH_KEY, clamped);
  };

  return (
    <PaneContext.Provider value={{ collapsed, width, toggleCollapsed, setWidth }}>
      {children}
    </PaneContext.Provider>
  );
}

export function usePane(): PaneContextValue {
  const ctx = useContext(PaneContext);
  if (!ctx) throw new Error("usePane must be used within a PaneProvider");
  return ctx;
}
