import type { Track } from "@/lib/types";
import { serviceFetch } from "./serviceFetch";

/**
 * MusicBrainz — open, structured metadata (artists, recordings, releases, labels, dates). No key needed.
 * Etiquette: ≤ 1 request/second and a descriptive User-Agent, so calls are serialized through a queue
 * and made through the Rust HTTP plugin (a browser fetch can't set User-Agent).
 */
const BASE = "https://musicbrainz.org/ws/2";
const UA = "BlackMusic/2.2.0 ( https://github.com/BlackBlazent/BlackMusic )";
let chain: Promise<unknown> = Promise.resolve();
let lastAt = 0;

function throttled<T>(fn: () => Promise<T>): Promise<T> {
  const run = chain.then(async () => {
    const wait = Math.max(0, 1100 - (Date.now() - lastAt));
    if (wait) await new Promise((r) => setTimeout(r, wait));
    lastAt = Date.now();
    return fn();
  });
  chain = run.catch(() => undefined);
  return run;
}

async function get<T>(path: string, params: Record<string, string>): Promise<T> {
  const q = new URLSearchParams({ ...params, fmt: "json" });
  return throttled(async () => {
    const res = await serviceFetch(`${BASE}/${path}?${q}`, { headers: { "User-Agent": UA, Accept: "application/json" } });
    if (!res.ok) throw new Error(`MusicBrainz responded ${res.status}`);
    return (await res.json()) as T;
  });
}

interface MbRecording {
  id: string;
  title: string;
  length?: number;
  "artist-credit"?: { name: string }[];
  releases?: { id: string; title: string; date?: string }[];
  tags?: { name: string; count: number }[];
}

export interface MbMeta {
  mbid: string;
  title: string;
  artist: string;
  album?: string;
  year?: number;
  genre?: string;
  releaseId?: string;
}

export function mbRecordingToMeta(r: MbRecording): MbMeta {
  const rel = r.releases?.[0];
  const year = rel?.date ? Number(rel.date.slice(0, 4)) : undefined;
  const genre = [...(r.tags ?? [])].sort((a, b) => b.count - a.count)[0]?.name;
  return {
    mbid: r.id,
    title: r.title,
    artist: (r["artist-credit"] ?? []).map((a) => a.name).join(", ") || "Unknown artist",
    album: rel?.title,
    year: Number.isFinite(year) ? year : undefined,
    genre,
    releaseId: rel?.id,
  };
}

export async function mbSearchRecordings(query: string, limit = 25): Promise<{ metas: MbMeta[]; tracks: Track[] }> {
  const d = await get<{ recordings?: MbRecording[] }>("recording", { query, limit: String(limit) });
  const recs = d.recordings ?? [];
  return {
    metas: recs.map(mbRecordingToMeta),
    tracks: recs.map((r) => {
      const m = mbRecordingToMeta(r);
      return {
        id: `musicbrainz:${r.id}`,
        path: "",
        title: m.title,
        artist: m.artist,
        album: m.album ?? "",
        duration: (r.length ?? 0) / 1000,
        sourceUrl: "",
        addedAt: Date.now(),
        provider: "musicbrainz",
        year: m.year,
        genre: m.genre,
        resolve: { kind: "search", query: `${m.artist} ${m.title}` },
      } satisfies Track;
    }),
  };
}

export async function mbSearchArtists(query: string, limit = 10): Promise<{ id: string; name: string; type?: string; country?: string; disambiguation?: string }[]> {
  const d = await get<{ artists?: { id: string; name: string; type?: string; country?: string; disambiguation?: string }[] }>("artist", { query, limit: String(limit) });
  return d.artists ?? [];
}

/** Best single match for filling tags automatically (Batch Tag Editor → "Look up"). */
export async function mbLookupBest(artist: string, title: string): Promise<MbMeta | null> {
  const q = `recording:"${title.replace(/"/g, "")}"${artist ? ` AND artist:"${artist.replace(/"/g, "")}"` : ""}`;
  const { metas } = await mbSearchRecordings(q, 1);
  return metas[0] ?? null;
}

/** Front cover from the Cover Art Archive for a release (Cover Battle Mode uses several releases). */
export const coverArtUrl = (releaseId: string, size: 250 | 500 | 1200 = 500) => `https://coverartarchive.org/release/${releaseId}/front-${size}`;

export async function mbCoverCandidates(artist: string, album: string, limit = 6): Promise<string[]> {
  const q = `release:"${album.replace(/"/g, "")}"${artist ? ` AND artist:"${artist.replace(/"/g, "")}"` : ""}`;
  const d = await get<{ releases?: { id: string }[] }>("release", { query: q, limit: String(limit) });
  return (d.releases ?? []).map((r) => coverArtUrl(r.id, 500));
}
