import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { usePlayback } from "@/app/context/PlaybackContext";
import { usePersistentState } from "@/lib/usePersistentState";
import { lyricsManager } from "../services/LyricsManager";
import { cacheWhisperLyrics, cachedWhisperLyrics, segmentsToLyrics, transcribe } from "@/lib/whisper";
import { useNotifications } from "@/app/context/NotificationsContext";
import { DEFAULT_LYRICS_SETTINGS, type LyricsDocument, type LyricsOverlaySettings } from "../types/lyrics.types";

type Status = "idle" | "loading" | "ready" | "unavailable";

interface LyricsContextValue {
  document: LyricsDocument | null;
  status: Status;
  settings: LyricsOverlaySettings;
  updateSettings: (patch: Partial<LyricsOverlaySettings>) => void;
  resetSettings: () => void;
  /** Transcribe the current local track with whisper.cpp (offline) and use the result as synced lyrics. */
  generateFromAudio: () => Promise<void>;
  transcribing: boolean;
}

const LyricsContext = createContext<LyricsContextValue | null>(null);

export function LyricsProvider({ children }: { children: ReactNode }) {
  const { currentTrack } = usePlayback();
  const [document, setDocument] = useState<LyricsDocument | null>(null);
  const [status, setStatus] = useState<Status>("idle");
  const [transcribing, setTranscribing] = useState(false);
  const { push } = useNotifications();
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
      .then(async (doc) => {
        if (cancelled) return;
        // Not found online → reuse a previous whisper transcription of this track, if there is one.
        const found = doc ?? (await cachedWhisperLyrics(currentTrack.id));
        if (cancelled) return;
        setDocument(found);
        setStatus(found ? "ready" : "unavailable");
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
      transcribing,
      generateFromAudio: async () => {
        if (!currentTrack?.path) {
          push("Can't transcribe this track", "whisper.cpp works on local files — play a track from your library.");
          return;
        }
        setTranscribing(true);
        try {
          const segments = await transcribe(currentTrack.path);
          if (segments.length === 0) throw new Error("No speech was detected.");
          const doc = segmentsToLyrics(currentTrack, segments);
          await cacheWhisperLyrics(doc);
          setDocument(doc);
          setStatus("ready");
          push("Lyrics generated", `Transcribed “${currentTrack.title}” with whisper.cpp.`);
        } catch (e) {
          push("Transcription failed", e instanceof Error ? e.message : String(e));
        } finally {
          setTranscribing(false);
        }
      },
    }),
    [document, status, settings, setSettings, transcribing, currentTrack, push],
  );
  return <LyricsContext.Provider value={value}>{children}</LyricsContext.Provider>;
}

export function useLyrics(): LyricsContextValue {
  const ctx = useContext(LyricsContext);
  if (!ctx) throw new Error("useLyrics must be used within a LyricsProvider");
  return ctx;
}
