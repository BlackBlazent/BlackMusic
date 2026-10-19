import type { Track } from "@/lib/types";
import { serviceJson } from "./serviceFetch";

/**
 * Last.fm — music metadata + listening habits (spec §2): two decades of catalog data, charts, tags,
 * similar artists, artist bios, and a user's scrobble history. Read-only calls only need the API key.
 * Last.fm lists music but never streams it, so every track carries a `resolve` recipe (see streamResolver).
 */
const BASE = "https://ws.audioscrobbler.com/2.0/";
const BLANK_ART = "2a96cbd8b46e442fc41c2b86b821562f";

type Img = { "#text": string; size?: string }[];
export const bestImage = (images?: Img): string | undefined =>
  [...(images ?? [])].reverse().find((i) => i["#text"] && !i["#text"].includes(BLANK_ART))?.["#text"];

async function call<T>(apiKey: string, method: string, params: Record<string, string | number> = {}): Promise<T> {
  const q = new URLSearchParams({ method, api_key: apiKey, format: "json", ...Object.fromEntries(Object.entries(params).map(([k, v]) => [k, String(v)])) });
  const data = await serviceJson<T & { error?: number; message?: string }>(`${BASE}?${q}`);
  if ((data as { error?: number }).error) throw new Error((data as { message?: string }).message ?? "Last.fm error");
  return data;
}

export function lastfmTrack(t: { name: string; artist: string | { name: string }; duration?: string | number; image?: Img; listeners?: string; playcount?: string }): Track {
  const artist = typeof t.artist === "string" ? t.artist : t.artist.name;
  return {
    id: `lastfm:${artist}:${t.name}`,
    path: "",
    title: t.name,
    artist,
    album: "",
    duration: Number(t.duration ?? 0) > 36000 ? Number(t.duration) / 1000 : Number(t.duration ?? 0),
    sourceUrl: "",
    artworkUrl: bestImage(t.image),
    addedAt: Date.now(),
    provider: "lastfm",
    resolve: { kind: "search", query: `${artist} ${t.name}` },
  };
}

interface TrackList { track?: Parameters<typeof lastfmTrack>[0][] }

export async function lastfmChartTracks(key: string, limit = 50): Promise<Track[]> {
  const d = await call<{ tracks?: TrackList }>(key, "chart.gettoptracks", { limit });
  return (d.tracks?.track ?? []).map(lastfmTrack);
}

export async function lastfmSearchTracks(key: string, query: string, limit = 30): Promise<Track[]> {
  const d = await call<{ results?: { trackmatches?: TrackList } }>(key, "track.search", { track: query, limit });
  return (d.results?.trackmatches?.track ?? []).map(lastfmTrack);
}

export interface LastfmArtist {
  name: string;
  image?: string;
  listeners?: string;
  url?: string;
  bio?: string;
  tags?: string[];
  similar?: string[];
}

export async function lastfmSearchArtists(key: string, query: string, limit = 10): Promise<LastfmArtist[]> {
  const d = await call<{ results?: { artistmatches?: { artist?: { name: string; listeners?: string; url?: string; image?: Img }[] } } }>(key, "artist.search", { artist: query, limit });
  return (d.results?.artistmatches?.artist ?? []).map((a) => ({ name: a.name, listeners: a.listeners, url: a.url, image: bestImage(a.image) }));
}

/** Artist biography, tags and similar artists in one shot. */
export async function lastfmArtistInfo(key: string, artist: string): Promise<LastfmArtist> {
  const d = await call<{ artist: { name: string; url?: string; image?: Img; stats?: { listeners?: string }; bio?: { summary?: string }; tags?: { tag?: { name: string }[] }; similar?: { artist?: { name: string }[] } } }>(key, "artist.getinfo", { artist, autocorrect: 1 });
  const a = d.artist;
  return {
    name: a.name,
    url: a.url,
    image: bestImage(a.image),
    listeners: a.stats?.listeners,
    bio: a.bio?.summary?.replace(/<a [^>]*>.*?<\/a>/gi, "").trim(),
    tags: a.tags?.tag?.map((t) => t.name),
    similar: a.similar?.artist?.map((s) => s.name),
  };
}

export async function lastfmArtistTopTracks(key: string, artist: string, limit = 20): Promise<Track[]> {
  const d = await call<{ toptracks?: TrackList }>(key, "artist.gettoptracks", { artist, limit, autocorrect: 1 });
  return (d.toptracks?.track ?? []).map((t) => lastfmTrack({ ...t, artist: t.artist ?? artist }));
}

export async function lastfmTagTopTracks(key: string, tag: string, limit = 30): Promise<Track[]> {
  const d = await call<{ tracks?: TrackList }>(key, "tag.gettoptracks", { tag, limit });
  return (d.tracks?.track ?? []).map(lastfmTrack);
}

export async function lastfmTopArtists(key: string, limit = 20): Promise<LastfmArtist[]> {
  const d = await call<{ artists?: { artist?: { name: string; listeners?: string; url?: string; image?: Img }[] } }>(key, "chart.gettopartists", { limit });
  return (d.artists?.artist ?? []).map((a) => ({ name: a.name, listeners: a.listeners, url: a.url, image: bestImage(a.image) }));
}

/** A user's recent scrobbles (Settings → Last.fm username). */
export async function lastfmRecentTracks(key: string, user: string, limit = 50): Promise<Track[]> {
  const d = await call<{ recenttracks?: { track?: { name: string; artist: { "#text": string }; album?: { "#text": string }; image?: Img }[] } }>(key, "user.getrecenttracks", { user, limit });
  return (d.recenttracks?.track ?? []).map((t) => ({ ...lastfmTrack({ name: t.name, artist: t.artist["#text"], image: t.image }), album: t.album?.["#text"] ?? "" }));
}

/** Track-level lookup used by the metadata tools (album, tags, duration, MBID). */
export async function lastfmTrackInfo(key: string, artist: string, track: string): Promise<{ album?: string; tags: string[]; mbid?: string; artwork?: string } | null> {
  try {
    const d = await call<{ track?: { mbid?: string; album?: { title?: string; image?: Img }; toptags?: { tag?: { name: string }[] } } }>(key, "track.getinfo", { artist, track, autocorrect: 1 });
    return { album: d.track?.album?.title, mbid: d.track?.mbid, tags: d.track?.toptags?.tag?.map((t) => t.name) ?? [], artwork: bestImage(d.track?.album?.image) };
  } catch {
    return null;
  }
}

// ---- Preserved from 2.1.0 (used by LibraryContext's album-art backfill) -------------------------------------------
interface LastfmAlbumInfo {
  album?: { image?: { "#text": string; size: string }[] };
}

/** Largest non-empty image Last.fm returns for the album, or null if none / not found. */
export async function fetchAlbumArtwork(artist: string, album: string): Promise<string | null> {
  const apiKey = import.meta.env.VITE_LASTFM_API_KEY;
  if (!apiKey || !artist || !album || artist === "Unknown artist" || album === "Unknown album") return null;

  const params = new URLSearchParams({ method: "album.getinfo", api_key: apiKey, artist, album, format: "json" });
  try {
    const response = await fetch(`${BASE}?${params.toString()}`);
    if (!response.ok) return null;
    const data = (await response.json()) as LastfmAlbumInfo;
    const best = [...(data.album?.image ?? [])].reverse().find((img) => img["#text"]);
    return best?.["#text"] || null;
  } catch {
    return null;
  }
}
