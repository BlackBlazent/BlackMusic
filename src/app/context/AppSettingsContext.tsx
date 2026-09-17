import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { getPreference, setPreference } from "@/lib/preferencesStore";

const STORAGE_KEY = "blackmusic:integrations";

export type IntegrationId = "spotify" | "audius" | "tidal" | "lastfm" | "youtube";

export const INTEGRATIONS: { id: IntegrationId; name: string; description: string }[] = [
  { id: "spotify", name: "Spotify", description: "Connect your account from the sidebar logo, browse in Online." },
  { id: "audius", name: "Audius", description: "No login needed — trending tracks, fully playable." },
  { id: "tidal", name: "Tidal", description: "Not wired up yet." },
  {
    id: "lastfm",
    name: "Last.fm",
    description: "Looks up album art for tracks with none embedded, after each scan.",
  },
  {
    id: "youtube",
    name: "YouTube",
    description: "Powers Playground's Video Mode and @youtube: search once built.",
  },
];

const DEFAULTS: Record<IntegrationId, boolean> = {
  spotify: true,
  audius: true,
  tidal: true,
  // These two reach out to a third party on their own (a scan finishing, a
  // page loading) rather than only when you click something — off by default.
  lastfm: false,
  youtube: false,
};

interface AppSettingsContextValue {
  isEnabled: (id: IntegrationId) => boolean;
  setEnabled: (id: IntegrationId, enabled: boolean) => void;
}

const AppSettingsContext = createContext<AppSettingsContextValue | null>(null);

export function AppSettingsProvider({ children }: { children: ReactNode }) {
  const [enabled, setEnabledState] = useState<Record<IntegrationId, boolean>>(DEFAULTS);

  useEffect(() => {
    getPreference<Record<string, boolean>>(STORAGE_KEY, {}).then((stored) => {
      setEnabledState({ ...DEFAULTS, ...stored });
    });
  }, []);

  const setEnabled = (id: IntegrationId, value: boolean) => {
    setEnabledState((prev) => {
      const next = { ...prev, [id]: value };
      void setPreference(STORAGE_KEY, next);
      return next;
    });
  };

  return (
    <AppSettingsContext.Provider value={{ isEnabled: (id) => enabled[id] ?? true, setEnabled }}>
      {children}
    </AppSettingsContext.Provider>
  );
}

export function useAppSettings(): AppSettingsContextValue {
  const ctx = useContext(AppSettingsContext);
  if (!ctx) throw new Error("useAppSettings must be used within an AppSettingsProvider");
  return ctx;
}
