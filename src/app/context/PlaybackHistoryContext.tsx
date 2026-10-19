import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { PlayEvent } from "@/lib/types";
import { getPreference, setPreference } from "@/lib/preferencesStore";

const STORAGE_KEY = "blackmusic:playHistory";
const SKIPS_KEY = "blackmusic:skipHistory";
// Keep the log bounded — Home only ever needs recent/monthly aggregates, not
// an unbounded lifetime record growing the preferences file forever.
const MAX_EVENTS = 20000; // 2.2.0: raised from 2000 so "last 30 days" / diary stay meaningful for heavy listeners

interface PlaybackHistoryContextValue {
  events: PlayEvent[];
  recordPlay: (trackId: string) => void;
  /** 2.2.0: tracks the user skipped before they were half-way through (Smart Playlists: "most skipped"). */
  skips: PlayEvent[];
  recordSkip: (trackId: string) => void;
}

const PlaybackHistoryContext = createContext<PlaybackHistoryContextValue | null>(null);

export function PlaybackHistoryProvider({ children }: { children: ReactNode }) {
  const [events, setEvents] = useState<PlayEvent[]>([]);
  const [skips, setSkips] = useState<PlayEvent[]>([]);

  useEffect(() => {
    getPreference<PlayEvent[]>(STORAGE_KEY, []).then(setEvents);
    getPreference<PlayEvent[]>(SKIPS_KEY, []).then(setSkips);
  }, []);

  const recordSkip = (trackId: string) => {
    setSkips((prev) => {
      const next = [...prev, { trackId, playedAt: Date.now() }].slice(-5000);
      void setPreference(SKIPS_KEY, next);
      return next;
    });
  };

  const recordPlay = (trackId: string) => {
    setEvents((prev) => {
      const next = [...prev, { trackId, playedAt: Date.now() }].slice(-MAX_EVENTS);
      void setPreference(STORAGE_KEY, next);
      return next;
    });
  };

  return (
    <PlaybackHistoryContext.Provider value={{ events, recordPlay, skips, recordSkip }}>
      {children}
    </PlaybackHistoryContext.Provider>
  );
}

export function usePlaybackHistory(): PlaybackHistoryContextValue {
  const ctx = useContext(PlaybackHistoryContext);
  if (!ctx) throw new Error("usePlaybackHistory must be used within a PlaybackHistoryProvider");
  return ctx;
}
