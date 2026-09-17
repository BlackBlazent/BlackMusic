import type { PlayEvent, Track } from "@/lib/types";

const DAY = 24 * 60 * 60 * 1000;

export function recentlyPlayed(events: PlayEvent[], tracks: Track[], limit: number): Track[] {
  const byId = new Map(tracks.map((t) => [t.id, t]));
  const seen = new Set<string>();
  const result: Track[] = [];
  for (let i = events.length - 1; i >= 0 && result.length < limit; i--) {
    const track = byId.get(events[i].trackId);
    if (!track || seen.has(track.id)) continue;
    seen.add(track.id);
    result.push(track);
  }
  return result;
}

export function mostPlayed(events: PlayEvent[], tracks: Track[], limit: number): { track: Track; count: number }[] {
  const byId = new Map(tracks.map((t) => [t.id, t]));
  const counts = new Map<string, number>();
  for (const event of events) counts.set(event.trackId, (counts.get(event.trackId) ?? 0) + 1);
  return [...counts.entries()]
    .map(([id, count]) => ({ track: byId.get(id), count }))
    .filter((entry): entry is { track: Track; count: number } => Boolean(entry.track))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
}

export function playedInLastNDays(events: PlayEvent[], days: number): number {
  const cutoff = Date.now() - days * DAY;
  return events.filter((event) => event.playedAt >= cutoff).length;
}

export function neverPlayed(events: PlayEvent[], tracks: Track[]): Track[] {
  const playedIds = new Set(events.map((e) => e.trackId));
  return tracks.filter((t) => !playedIds.has(t.id));
}
