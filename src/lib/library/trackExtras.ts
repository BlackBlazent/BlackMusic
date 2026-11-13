import { useEffect, useMemo, useSyncExternalStore } from "react";
import { getPreference, setPreference } from "@/lib/preferencesStore";
import type { Track } from "@/lib/types";

/**
 * 3.0.0 (FEAT-07 / FEAT-09) — fields that have no standard tag in every audio format: Country and Mood.
 * They live in the app's own store keyed by track id, so applying them can never corrupt an audio file.
 * (Genre, Year and Composer are real tags and are written through the existing safe metadata editor.)
 */
export interface TrackExtras {
  country?: string;
  mood?: string;
}

const KEY = "blackmusic:trackExtras";
let snapshot: Record<string, TrackExtras> = {};
let loaded = false;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

async function load() {
  if (loaded) return;
  loaded = true;
  const stored = await getPreference<Record<string, TrackExtras>>(KEY, {});
  snapshot = { ...stored, ...snapshot };
  emit();
}

export function setTrackExtras(trackId: string, extras: TrackExtras): void {
  const clean: TrackExtras = {};
  if (extras.country?.trim()) clean.country = extras.country.trim();
  if (extras.mood?.trim()) clean.mood = extras.mood.trim();
  const next = { ...snapshot };
  if (Object.keys(clean).length) next[trackId] = clean;
  else delete next[trackId];
  snapshot = next;
  emit();
  void setPreference(KEY, snapshot);
}

export function getTrackExtras(trackId: string): TrackExtras {
  return snapshot[trackId] ?? {};
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

/** Returns `tracks` with country / mood merged in (a new array only when extras exist). */
export function useTracksWithExtras(tracks: Track[]): Track[] {
  const extras = useSyncExternalStore(subscribe, () => snapshot);
  useEffect(() => void load(), []);
  return useMemo(
    () => (Object.keys(extras).length === 0 ? tracks : tracks.map((t) => (extras[t.id] ? { ...t, ...extras[t.id] } : t))),
    [tracks, extras],
  );
}

export const COUNTRY_SUGGESTIONS = ["United States", "United Kingdom", "Canada", "Philippines", "Japan", "South Korea", "Brazil", "Nigeria", "Jamaica", "France", "Germany", "Spain", "Mexico", "India", "Australia", "Sweden", "Italy", "Russia"];
export const MOOD_SUGGESTIONS = ["Chill", "Happy", "Energetic", "Romantic", "Sad", "Focus", "Workout", "Worship", "Party", "Sleep"];
