import type { Track } from "@/lib/types";
import { serviceFetch } from "./serviceFetch";
import { APP_VERSION } from "@/lib/appVersion";

/**
 * MusicBrainz — open, structured metadata (artists, recordings, releases, labels, dates). No key needed.
 * Etiquette: ≤ 1 request/second and a descriptive User-Agent, so calls are serialized through a queue
 * and made through the Rust HTTP plugin (a browser fetch can't set User-Agent).
 */
const BASE = "https://musicbrainz.org/ws/2";
const UA = `BlackMusic/${APP_VERSION} ( https://github.com/BlackBlazent/BlackMusic )`;
const REQUEST_TIMEOUT_MS = 15_000;
const MAX_ATTEMPTS = 3;
let chain: Promise<unknown> = Promise.resolve();
let lastAt = 0;

/** FIX-01 (3.0.0): a typed error, so the UI can say what went wrong instead of "error sending request for url …". */
export class MusicBrainzError extends Error {
  constructor(
    message: string,
    readonly kind: "network" | "timeout" | "rate-limit" | "server" | "client",
  ) {
    super(message);
    this.name = "MusicBrainzError";
  }
}

function throttled<T>(fn: () => Promise<T>): Promise<T> {
  const run = chain.then(async () => {
    const wait = Math.max(0, 1100 - (Date.now() - lastAt));
    if (wait) await new Promise((r) => setTimeout(r, wait));
    lastAt = Date.now();
    return fn();
  });
  chain = run.catch(() => undefined); // one failed/timed-out request never blocks the queue
  return run;
}

async function fetchWithTimeout(url: string, init: RequestInit): Promise<Response> {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      controller.abort();
      reject(new MusicBrainzError("MusicBrainz didn't answer in time.", "timeout"));
    }, REQUEST_TIMEOUT_MS);
  });
  try {
    return await Promise.race([serviceFetch(url, { ...init, signal: controller.signal }), timeout]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function get<T>(path: string, params: Record<string, string>): Promise<T> {
  // URLSearchParams does all the encoding — never build this query string by concatenation.
  const q = new URLSearchParams({ ...params, fmt: "json" });
  const url = `${BASE}/${path}?${q.toString()}`;
  let last: MusicBrainzError | undefined;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const res = await throttled(() => fetchWithTimeout(url, { headers: { "User-Agent": UA, Accept: "application/json" } }));
      if (res.ok) return (await res.json()) as T;
      if (res.status === 429 || res.status === 503) last = new MusicBrainzError("MusicBrainz is rate-limiting requests. Try again in a moment.", "rate-limit");
      else if (res.status >= 500) last = new MusicBrainzError(`MusicBrainz is having problems (${res.status}).`, "server");
      else throw new MusicBrainzError(`MusicBrainz rejected the request (${res.status}).`, "client"); // 4xx: retrying can't help
    } catch (e) {
      if (e instanceof MusicBrainzError && e.kind === "client") throw e;
      last = e instanceof MusicBrainzError ? e : new MusicBrainzError("Couldn't reach MusicBrainz. Check your connection and try again.", "network");
    }
    if (attempt < MAX_ATTEMPTS) await sleep(1000 * attempt * attempt); // 1 s, 4 s back-off
  }
  throw last ?? new MusicBrainzError("Couldn't reach MusicBrainz.", "network");
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

/** True when the Cover Art Archive really has a front cover for this release (many releases have none -> 404). */
async function hasFrontCover(releaseId: string): Promise<boolean> {
  try {
    const res = await fetchWithTimeout(coverArtUrl(releaseId, 250), { method: "HEAD" });
    return res.ok;
  } catch {
    return false;
  }
}

export async function mbCoverCandidates(artist: string, album: string, limit = 6): Promise<string[]> {
  const clean = (v: string) => v.replace(/["\\]/g, " ").trim();
  const q = `release:"${clean(album)}"${artist ? ` AND artist:"${clean(artist)}"` : ""}`;
  // Ask for more than we need: a release without artwork is dropped below.
  const d = await get<{ releases?: { id: string }[] }>("release", { query: q, limit: String(Math.min(25, limit * 3)) });
  const ids = [...new Set((d.releases ?? []).map((r) => r.id))];
  const good: string[] = [];
  for (let i = 0; i < ids.length && good.length < limit; i += 4) {
    const batch = ids.slice(i, i + 4);
    const ok = await Promise.all(batch.map(hasFrontCover));
    batch.forEach((id, n) => ok[n] && good.length < limit && good.push(id));
  }
  return good.map((id) => coverArtUrl(id, 500));
}

/** FEAT-02: the artist's country of origin (ISO 3166-1 alpha-2) from MusicBrainz, or null when it has none / no match. */
export async function mbArtistCountry(artist: string): Promise<string | null> {
  const name = artist.replace(/["\\]/g, " ").trim();
  if (!name) return null;
  const d = await get<{ artists?: { name: string; country?: string; score?: number }[] }>("artist", { query: `artist:"${name}"`, limit: "3" });
  const best = (d.artists ?? []).find((a) => a.country && (a.score ?? 0) >= 90 && a.name.toLowerCase() === name.toLowerCase());
  return best?.country ?? null;
}
