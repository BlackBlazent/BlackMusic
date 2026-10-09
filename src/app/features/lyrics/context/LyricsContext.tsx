import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { usePlayback } from "@/app/context/PlaybackContext";
import { usePersistentState } from "@/lib/usePersistentState";
import { lyricsManager } from "../services/LyricsManager";
import { DEFAULT_LYRICS_SETTINGS, type LyricsDocument, type LyricsOverlaySettings } from "../types/lyrics.types";

type Status = "idle" | "loading" | "ready" | "unavailable";

interface LyricsContextValue {
  document: LyricsDocument | null;
  status: Status;
  settings: LyricsOverlaySettings;
  updateSettings: (patch: Partial<LyricsOverlaySettings>) => void;
  resetSettings: () => void;
}

const LyricsContext = createContext<LyricsContextValue | null>(null);

export function LyricsProvider({ children }: { children: ReactNode }) {
  const { currentTrack } = usePlayback();
  const [document, setDocument] = useState<LyricsDocument | null>(null);
  const [status, setStatus] = useState<Status>("idle");
  const [settings, setSettings] = usePersistentState<LyricsOverlaySettings>("lyrics.settings", DEFAULT_LYRICS_SETTINGS);

  // Fetched once per track change — never per render.
  useEffect(() => {
    if (!currentTrack) {
      setDocument(null);
      setStatus("idle");
      return;
    }
    let cancelled = false;
    setStatus("loading");
    setDocument(null);
    lyricsManager
      .loadForTrack({
        id: currentTrack.id,
        title: currentTrack.title,
        artist: currentTrack.artist,
        album: currentTrack.album,
        duration: currentTrack.duration,
        artwork: currentTrack.artworkUrl,
        path: currentTrack.path || undefined,
      })
      .then((doc) => {
        if (cancelled) return;
        setDocument(doc);
        setStatus(doc ? "ready" : "unavailable");
      })
      .catch(() => !cancelled && setStatus("unavailable"));
    return () => {
      cancelled = true;
    };
  }, [currentTrack?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const value = useMemo<LyricsContextValue>(
    () => ({
      document,
      status,
      settings: { ...DEFAULT_LYRICS_SETTINGS, ...settings },
      updateSettings: (patch) => setSettings((prev) => ({ ...prev, ...patch })),
      resetSettings: () => setSettings(DEFAULT_LYRICS_SETTINGS),
    }),
    [document, status, settings, setSettings],
  );
  return <LyricsContext.Provider value={value}>{children}</LyricsContext.Provider>;
}

export function useLyrics(): LyricsContextValue {
  const ctx = useContext(LyricsContext);
  if (!ctx) throw new Error("useLyrics must be used within a LyricsProvider");
  return ctx;
}
