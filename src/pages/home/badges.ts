import type { Track } from "@/lib/types";

/** IMP-03 — the badge-title algorithm. Pure: stats in, badges out. Thresholds are deliberately round and easy to explain. */
export interface BadgeStats {
  tracks: number;
  totalBytes: number;
  pinned: number;
  playlists: number;
  favorites: number;
  plays: number;
  editedMetadata: number;
  artists: number;
}

export interface Badge {
  id: string;
  title: string;
  emoji: string;
  image: string;
  how: string;
  value: number;
  target: number;
}

interface Def {
  id: string;
  title: string;
  emoji: string;
  image: string;
  how: (target: number) => string;
  stat: (s: BadgeStats) => number;
  tiers: number[]; // ascending; the badge title only changes for the first tier unless `tierTitles` says so
  tierTitles?: string[];
}

const GB = 1024 ** 3;

const DEFS: Def[] = [
  { id: "library", title: "Music Colosseum", emoji: "🏛️", image: "/assets/media/images/icons/general/badge/playlist-starter.svg", how: (t) => `${t.toLocaleString()} songs in your library`, stat: (s) => s.tracks, tiers: [100, 1000, 5000, 16000], tierTitles: ["Playlist Starter", "Crate Digger", "Archive Keeper", "Music Colosseum"] },
  { id: "pins", title: "Prioritizer", emoji: "📌", image: "/assets/media/images/icons/general/badge/prioritizer.svg", how: (t) => `${t} pinned songs`, stat: (s) => s.pinned, tiers: [3, 10] },
  { id: "playlists", title: "Music Collector", emoji: "🗂️", image: "/assets/media/images/icons/general/badge/music-collector.svg", how: (t) => `${t} playlists created`, stat: (s) => s.playlists, tiers: [3, 10, 25], tierTitles: ["Mixtape Maker", "Music Collector", "Playlist Architect"] },
  { id: "favorites", title: "Heart Keeper", emoji: "💖", image: "/assets/media/images/icons/general/badge/heart-keeper.svg", how: (t) => `${t} favorite songs`, stat: (s) => s.favorites, tiers: [10, 50, 200], tierTitles: ["First Loves", "Heart Keeper", "Devoted Fan"] },
  { id: "plays", title: "Marathon Listener", emoji: "🎧", image: "/assets/media/images/icons/general/badge/marathon-listener.svg", how: (t) => `${t.toLocaleString()} plays`, stat: (s) => s.plays, tiers: [50, 500, 5000], tierTitles: ["Warming Up", "Marathon Listener", "Living Soundtrack"] },
  { id: "tags", title: "Tag Surgeon", emoji: "🩺", image: "/assets/media/images/icons/general/badge/tag-surgeon.svg", how: (t) => `${t} songs with edited metadata`, stat: (s) => s.editedMetadata, tiers: [5, 25, 100] },
  { id: "size", title: "Data Hoarder", emoji: "💾", image: "/assets/media/images/icons/general/badge/data-hoarder.svg", how: (t) => `${t} GB of local music`, stat: (s) => s.totalBytes / GB, tiers: [1, 10, 50] },
  { id: "artists", title: "Scene Explorer", emoji: "🧭", image: "/assets/media/images/icons/general/badge/scene-explorer.svg", how: (t) => `${t} different artists`, stat: (s) => s.artists, tiers: [25, 100, 500] },
];

/** Earned = highest tier reached; "next" = the closest unearned goal by progress. */
export function computeBadges(stats: BadgeStats): { earned: Badge[]; next: Badge[] } {
  const earned: Badge[] = [];
  const next: Badge[] = [];
  for (const d of DEFS) {
    const value = d.stat(stats);
    let reached = -1;
    d.tiers.forEach((t, i) => value >= t && (reached = i));
    if (reached >= 0) {
      const target = d.tiers[reached];
      earned.push({ id: `${d.id}-${reached}`, title: d.tierTitles?.[reached] ?? d.title, emoji: d.emoji, image: d.image, how: d.how(target), value, target });
    }
    const nextIdx = reached + 1;
    if (nextIdx < d.tiers.length) {
      const target = d.tiers[nextIdx];
      next.push({ id: `${d.id}-${nextIdx}`, title: d.tierTitles?.[nextIdx] ?? d.title, emoji: d.emoji, image: d.image, how: d.how(target), value, target });
    }
  }
  next.sort((a, b) => b.value / b.target - a.value / a.target);
  return { earned, next: next.slice(0, 3) };
}

export function badgeStatsFrom(tracks: Track[], extra: Omit<BadgeStats, "tracks" | "totalBytes" | "artists">): BadgeStats {
  let bytes = 0;
  const artists = new Set<string>();
  for (const t of tracks) {
    bytes += t.size ?? 0;
    if (t.artist && t.artist !== "Unknown artist") artists.add(t.artist);
  }
  return { tracks: tracks.length, totalBytes: bytes, artists: artists.size, ...extra };
}
