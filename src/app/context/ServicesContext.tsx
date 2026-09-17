import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { SERVICE_DIRECTORY } from "@/lib/services/serviceDirectory";
import { openInSystemBrowser } from "@/lib/services/serviceAuth";
import {
  buildSpotifyAuthUrl,
  disconnectSpotify,
  handleSpotifyCallback,
  isSpotifyConnected,
} from "@/lib/services/spotifyClient";
import { getPreference, setPreference } from "@/lib/preferencesStore";
import { isTauri } from "@/lib/platform";
import { useNotifications } from "./NotificationsContext";

const ACTIVE_KEY = "blackmusic:activeService";
const CONNECTED_KEY = "blackmusic:connectedServices";

interface ServicesContextValue {
  activeServiceId: string;
  connectedIds: Set<string>;
  setActiveService: (id: string) => void;
  connect: (id: string) => Promise<void>;
  disconnect: (id: string) => void;
}

const ServicesContext = createContext<ServicesContextValue | null>(null);

export function ServicesProvider({ children }: { children: ReactNode }) {
  const { push } = useNotifications();
  const [activeServiceId, setActiveServiceId] = useState("bmusic");
  const [connectedIds, setConnectedIds] = useState<Set<string>>(new Set(["bmusic"]));

  useEffect(() => {
    getPreference<string>(ACTIVE_KEY, "bmusic").then(setActiveServiceId);
    getPreference<string[]>(CONNECTED_KEY, ["bmusic"]).then(async (ids) => {
      const next = new Set(ids);
      if (await isSpotifyConnected()) next.add("spotify");
      setConnectedIds(next);
    });
  }, []);

  // Catches `blackmusic://spotify/callback?code=...` once the system browser
  // redirects back into the app (requires the deep-link plugin — see src-tauri).
  useEffect(() => {
    if (!isTauri()) return;
    let unlisten: (() => void) | undefined;

    import("@tauri-apps/plugin-deep-link").then(({ onOpenUrl }) => {
      onOpenUrl(async (urls) => {
        const callbackUrl = urls.find((u) => u.startsWith("blackmusic://spotify"));
        if (!callbackUrl) return;
        const ok = await handleSpotifyCallback(callbackUrl);
        if (ok) {
          persistConnected(new Set(connectedIds).add("spotify"));
          setActiveService("spotify");
          push("Spotify connected", "Online will now pull from your Spotify account.");
        } else {
          push("Spotify connection failed", "The callback didn't include a valid code — try again.");
        }
      }).then((fn) => {
        unlisten = fn;
      });
    });

    return () => unlisten?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only needs to register once
  }, []);

  const setActiveService = (id: string) => {
    setActiveServiceId(id);
    void setPreference(ACTIVE_KEY, id);
  };

  const persistConnected = (next: Set<string>) => {
    setConnectedIds(next);
    void setPreference(CONNECTED_KEY, [...next]);
  };

  const connect = async (id: string) => {
    const service = SERVICE_DIRECTORY.find((s) => s.id === id);
    if (!service?.available) return;

    // Audius' and BlackMusic's own catalogs are readable without a per-user
    // OAuth handshake — just an app-level API key, not a login flow.
    if (id === "audius" || id === "bmusic") {
      persistConnected(new Set(connectedIds).add(id));
      setActiveService(id);
      return;
    }

    if (id === "spotify") {
      const url = await buildSpotifyAuthUrl();
      if (url) await openInSystemBrowser(url);
      else push("Spotify isn't configured", "Add VITE_SPOTIFY_CLIENT_ID to .env first.");
      return;
    }
  };

  const disconnect = (id: string) => {
    if (id === "spotify") void disconnectSpotify();
    const next = new Set(connectedIds);
    next.delete(id);
    persistConnected(next);
    if (activeServiceId === id) setActiveService("bmusic");
  };

  return (
    <ServicesContext.Provider value={{ activeServiceId, connectedIds, setActiveService, connect, disconnect }}>
      {children}
    </ServicesContext.Provider>
  );
}

export function useServices(): ServicesContextValue {
  const ctx = useContext(ServicesContext);
  if (!ctx) throw new Error("useServices must be used within a ServicesProvider");
  return ctx;
}
