import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { PlayEvent } from "@/lib/types";
import { getPreference, setPreference } from "@/lib/preferencesStore";

const STORAGE_KEY = "blackmusic:playHistory";
// Keep the log bounded — Home only ever needs recent/monthly aggregates, not
// an unbounded lifetime record growing the preferences file forever.
const MAX_EVENTS = 2000;

interface PlaybackHistoryContextValue {
  events: PlayEvent[];
  recordPlay: (trackId: string) => void;
}

const PlaybackHistoryContext = createContext<PlaybackHistoryContextValue | null>(null);

export function PlaybackHistoryProvider({ children }: { children: ReactNode }) {
  const [events, setEvents] = useState<PlayEvent[]>([]);

  useEffect(() => {
    getPreference<PlayEvent[]>(STORAGE_KEY, []).then(setEvents);
  }, []);

  const recordPlay = (trackId: string) => {
    setEvents((prev) => {
      const next = [...prev, { trackId, playedAt: Date.now() }].slice(-MAX_EVENTS);
      void setPreference(STORAGE_KEY, next);
      return next;
    });
  };

  return (
    <PlaybackHistoryContext.Provider value={{ events, recordPlay }}>
      {children}
    </PlaybackHistoryContext.Provider>
  );
}

export function usePlaybackHistory(): PlaybackHistoryContextValue {
  const ctx = useContext(PlaybackHistoryContext);
  if (!ctx) throw new Error("usePlaybackHistory must be used within a PlaybackHistoryProvider");
  return ctx;
}
