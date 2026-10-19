import type { Track } from "@/lib/types";
import { getPreference } from "@/lib/preferencesStore";
import { serviceFetch, serviceJson } from "./serviceFetch";
import { fetchAudiusTrending, audiusStreamUrl, type AudiusTrack } from "./audiusClient";
import { loadCustomApis, CUSTOM_SERVICE_PREFIX, type CustomServiceApi } from "./customApis";
import { lastfmChartTracks, lastfmSearchTracks } from "./lastfmClient";

/**
 * One function per music service, so wiring a service up is only a matter of
 * dropping its key into `.env` (or typing it into Settings → Service API keys).
 * Every client implements `fetchTracks`, which the Online page calls for
 * whichever service is active. Keys live in env/Settings — never in code.
 *
 * Status of each adapter (be honest about what was verified):
 *   - lastfm, deezer, youtube, apple, soundcloud, yandex: endpoint + response
 *     mapping written from the provider's public docs.
 *   - tidal, amazon: request/response shapes follow the providers' newer
 *     developer APIs; both are invite/alpha programs, so the mapping is
 *     defensive and may need a tweak once you have real credentials.
 *   - pandora: Pandora has no public API — the adapter only works when you
 *     point it at your own endpoint via VITE_PANDORA_API_URL / Settings.
 */

export interface ServiceClient {
  id: string;
  /** Env var names this service reads — shown in Settings as hints. */
  envKeys: string[];
  /** True when a key (env or Settings) is available. */
  isConfigured: (keys: ServiceKeys) => boolean;
  fetchTracks: (keys: ServiceKeys, limit?: number) => Promise<Track[]>;
  /** 2.2.0: `@online-<service>:` search. Services without a search endpoint fall back to filtering fetchTracks. */
  search?: (keys: ServiceKeys, query: string, limit?: number) => Promise<Track[]>;
}

/** Per-service keys the user typed into Settings (override/augment env). */
export type ServiceKeys = Record<string, string | undefined>;

export const SERVICE_KEYS_STORAGE_KEY = "blackmusic:serviceKeys";

export const SERVICE_AUTH_SCOPES = {
  spotify:
    "user-read-private user-read-email user-library-read playlist-read-private playlist-read-collaborative user-top-read user-read-recently-played user-follow-read streaming user-modify-playback-state user-read-playback-state",
} as const;

const env = import.meta.env as unknown as Record<string, string | undefined>;
const pick = (keys: ServiceKeys, id: string, envName: string) => keys[id] || env[envName] || "";

function track(partial: Partial<Track> & Pick<Track, "id" | "title">): Track {
  return {
    path: "",
    artist: "Unknown artist",
    album: "",
    duration: 0,
    sourceUrl: "",
    addedAt: Date.now(),
    ...partial,
  };
}

/** ISO-8601 duration ("PT3M20S") → seconds. */
function isoDuration(iso: string | undefined): number {
  const m = iso?.match(/P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?(?:(\d+(?:\.\d+)?)S)?/);
  if (!m) return 0;
  return Number(m[1] ?? 0) * 86400 + Number(m[2] ?? 0) * 3600 + Number(m[3] ?? 0) * 60 + Number(m[4] ?? 0);
}

// --- Audius (keyless catalog) -------------------------------------------------
const audius: ServiceClient = {
  id: "audius",
  envKeys: ["VITE_AUDIUS_API_KEY"],
  isConfigured: () => true,
  fetchTracks: async () =>
    (await fetchAudiusTrending()).map((t: AudiusTrack) =>
      track({
        id: `audius:${t.id}`,
        title: t.title,
        artist: t.user.name,
        album: t.genre ?? "",
        duration: t.duration,
        sourceUrl: audiusStreamUrl(t.id),
        artworkUrl: t.artwork?.["480x480"] ?? t.artwork?.["150x150"],
      }),
    ),
};

// --- Last.fm (chart + search) — metadata service that can ALSO serve music -------------------
// Last.fm lists/scrobbles, it never streams. 2.2.0: every Last.fm track carries a resolve recipe, so the
// stream resolver (bundled yt-dlp → Deezer/Audius fallback) makes it playable — that was the "fetched but
// can't play" bug.
const lastfm: ServiceClient = {
  id: "lastfm",
  envKeys: ["VITE_LASTFM_API_KEY"],
  isConfigured: (k) => Boolean(pick(k, "lastfm", "VITE_LASTFM_API_KEY")),
  fetchTracks: (k, limit = 50) => lastfmChartTracks(pick(k, "lastfm", "VITE_LASTFM_API_KEY"), limit),
  search: (k, q, limit = 30) => lastfmSearchTracks(pick(k, "lastfm", "VITE_LASTFM_API_KEY"), q, limit),
};

// --- Deezer (public chart, 30s previews) ---------------------------------------
interface DeezerChart {
  data?: { id: number; title: string; duration: number; preview: string; artist: { name: string }; album: { title: string; cover_big?: string } }[];
}
const deezer: ServiceClient = {
  id: "deezer",
  envKeys: [],
  isConfigured: () => true,
  fetchTracks: async (_k, limit = 50) => {
    const data = await serviceJson<DeezerChart>(`https://api.deezer.com/chart/0/tracks?limit=${limit}`);
    return (data.data ?? []).map((t) =>
      track({
        id: `deezer:${t.id}`,
        title: t.title,
        artist: t.artist.name,
        album: t.album.title,
        duration: t.duration,
        sourceUrl: t.preview, // 30-second preview — full streams need Deezer's licensed SDK
        artworkUrl: t.album.cover_big,
        provider: "deezer",
        // Full-length playback: the resolver's yt-dlp path is tried when the preview is all Deezer gives.
      }),
    );
  },
  search: async (_k, q, limit = 30) => {
    const data = await serviceJson<DeezerChart>(`https://api.deezer.com/search?q=${encodeURIComponent(q)}&limit=${limit}`);
    return (data.data ?? []).map((t) =>
      track({ id: `deezer:${t.id}`, title: t.title, artist: t.artist.name, album: t.album.title, duration: t.duration, sourceUrl: t.preview, artworkUrl: t.album.cover_big, provider: "deezer" }),
    );
  },
};

// --- Apple Music (developer token, catalog chart) -------------------------------
interface AppleCharts {
  results?: { songs?: { data?: { id: string; attributes: { name: string; artistName: string; albumName: string; durationInMillis?: number; artwork?: { url: string }; previews?: { url: string }[] } }[] }[] };
}
const apple: ServiceClient = {
  id: "apple",
  envKeys: ["VITE_APPLE_MUSIC_DEVELOPER_TOKEN", "VITE_APPLE_MUSIC_STOREFRONT"],
  isConfigured: (k) => Boolean(pick(k, "apple", "VITE_APPLE_MUSIC_DEVELOPER_TOKEN")),
  fetchTracks: async (k, limit = 50) => {
    const storefront = env.VITE_APPLE_MUSIC_STOREFRONT || "us";
    const data = await serviceJson<AppleCharts>(
      `https://api.music.apple.com/v1/catalog/${storefront}/charts?types=songs&limit=${Math.min(limit, 50)}`,
      { headers: { Authorization: `Bearer ${pick(k, "apple", "VITE_APPLE_MUSIC_DEVELOPER_TOKEN")}` } },
    );
    return (data.results?.songs?.[0]?.data ?? []).map((s) =>
      track({
        id: `apple:${s.id}`,
        title: s.attributes.name,
        artist: s.attributes.artistName,
        album: s.attributes.albumName,
        duration: (s.attributes.durationInMillis ?? 0) / 1000,
        sourceUrl: s.attributes.previews?.[0]?.url ?? "",
        artworkUrl: s.attributes.artwork?.url.replace("{w}", "300").replace("{h}", "300"),
      }),
    );
  },
};

// --- SoundCloud (client_id, charts) ----------------------------------------------
interface SoundcloudCharts {
  collection?: { track: { id: number; title: string; duration: number; artwork_url?: string; permalink_url?: string; user: { username: string } } }[];
}
const soundcloud: ServiceClient = {
  id: "soundcloud",
  envKeys: ["VITE_SOUNDCLOUD_CLIENT_ID"],
  isConfigured: (k) => Boolean(pick(k, "soundcloud", "VITE_SOUNDCLOUD_CLIENT_ID")),
  fetchTracks: async (k, limit = 50) => {
    const clientId = pick(k, "soundcloud", "VITE_SOUNDCLOUD_CLIENT_ID");
    const data = await serviceJson<SoundcloudCharts>(
      `https://api-v2.soundcloud.com/charts?kind=top&genre=soundcloud%3Agenres%3Aall-music&limit=${limit}&client_id=${encodeURIComponent(clientId)}`,
    );
    return (data.collection ?? []).map(({ track: t }) =>
      track({
        id: `soundcloud:${t.id}`,
        title: t.title,
        artist: t.user.username,
        duration: t.duration / 1000,
        artworkUrl: t.artwork_url?.replace("-large", "-t300x300"),
      }),
    );
  },
};

// --- Yandex Music (OAuth token, chart) --------------------------------------------
interface YandexChart {
  result?: { chart?: { tracks?: { track: { id: number | string; title: string; durationMs?: number; coverUri?: string; artists?: { name: string }[]; albums?: { title: string }[] } }[] } };
}
const yandex: ServiceClient = {
  id: "yandex",
  envKeys: ["VITE_YANDEX_MUSIC_TOKEN"],
  isConfigured: (k) => Boolean(pick(k, "yandex", "VITE_YANDEX_MUSIC_TOKEN")),
  fetchTracks: async (k, limit = 50) => {
    const data = await serviceJson<YandexChart>("https://api.music.yandex.net/landing3/chart", {
      headers: { Authorization: `OAuth ${pick(k, "yandex", "VITE_YANDEX_MUSIC_TOKEN")}` },
    });
    return (data.result?.chart?.tracks ?? []).slice(0, limit).map(({ track: t }) =>
      track({
        id: `yandex:${t.id}`,
        title: t.title,
        artist: (t.artists ?? []).map((a) => a.name).join(", ") || "Unknown artist",
        album: t.albums?.[0]?.title ?? "",
        duration: (t.durationMs ?? 0) / 1000,
        artworkUrl: t.coverUri ? `https://${t.coverUri.replace("%%", "300x300")}` : undefined,
      }),
    );
  },
};

// --- YouTube (Data API, music category chart) --------------------------------------
interface YoutubeVideos {
  items?: { id: string; snippet: { title: string; channelTitle: string; thumbnails?: { high?: { url: string }; medium?: { url: string } } }; contentDetails?: { duration?: string } }[];
}
function youtubeTrack(v: { id: string; snippet: { title: string; channelTitle: string; thumbnails?: { high?: { url: string }; medium?: { url: string } } }; contentDetails?: { duration?: string } }): Track {
  return track({
    id: `youtube:${v.id}`,
    title: v.snippet.title,
    artist: v.snippet.channelTitle.replace(/ - Topic$/, ""),
    duration: isoDuration(v.contentDetails?.duration),
    artworkUrl: v.snippet.thumbnails?.high?.url ?? v.snippet.thumbnails?.medium?.url,
    provider: "youtube",
    // 2.2.0: playable — the resolver asks the bundled yt-dlp for this video's audio stream.
    resolve: { kind: "youtube", videoId: v.id },
  });
}

const youtube: ServiceClient = {
  id: "youtube",
  envKeys: ["VITE_YOUTUBE_API_KEY"],
  isConfigured: (k) => Boolean(pick(k, "youtube", "VITE_YOUTUBE_API_KEY")),
  fetchTracks: async (k, limit = 50) => {
    const params = new URLSearchParams({
      part: "snippet,contentDetails",
      chart: "mostPopular",
      videoCategoryId: "10",
      maxResults: String(Math.min(limit, 50)),
      key: pick(k, "youtube", "VITE_YOUTUBE_API_KEY"),
    });
    const data = await serviceJson<YoutubeVideos>(`https://www.googleapis.com/youtube/v3/videos?${params}`);
    return (data.items ?? []).map(youtubeTrack);
  },
  search: async (k, q, limit = 25) => {
    const key = pick(k, "youtube", "VITE_YOUTUBE_API_KEY");
    if (key) {
      const sp = new URLSearchParams({ part: "snippet", type: "video", videoCategoryId: "10", q, maxResults: String(Math.min(limit, 50)), key });
      const found = await serviceJson<{ items?: { id: { videoId: string } }[] }>(`https://www.googleapis.com/youtube/v3/search?${sp}`);
      const ids = (found.items ?? []).map((i) => i.id.videoId).join(",");
      if (!ids) return [];
      const vp = new URLSearchParams({ part: "snippet,contentDetails", id: ids, key });
      const vids = await serviceJson<YoutubeVideos>(`https://www.googleapis.com/youtube/v3/videos?${vp}`);
      return (vids.items ?? []).map(youtubeTrack);
    }
    // No API key: search through the bundled yt-dlp instead (no quota, no key).
    const { searchYouTubeWithYtDlp } = await import("@/lib/video/ytdlp");
    return searchYouTubeWithYtDlp(q, limit);
  },
};

// --- Tidal (OpenAPI v2 bearer token) ---------------------------------------------------
// 2.2.0 root cause of "Tidal rejected the credentials (401)": `.env` carried a pasted VITE_TIDAL_ACCESS_TOKEN, and a pasted
// token ALWAYS won over the client-credentials exchange — so once that (24 h) token expired every request was a 401 and the
// code that could mint a fresh one was never reached. Every 401/403 was then flattened into one generic message.
// Token order now: (1) the BlackMusic backend broker (secret never ships in the app), (2) a pasted token that hasn't expired,
// (3) development builds only: client id + secret from .env. A 401 on a pasted token falls through to the next source once.
interface TidalSearch {
  included?: {
    id: string;
    type: string;
    attributes?: { title?: string; duration?: string; name?: string };
    relationships?: { artists?: { data?: { id: string; type: string }[] } };
  }[];
}
const TIDAL_TOKEN_URL = "https://auth.tidal.com/v1/oauth2/token";
let tidalToken: { value: string; expiresAt: number } | null = null;

export type TidalErrorKind = "not-configured" | "unauthorized" | "expired" | "forbidden" | "rate-limited" | "network" | "unavailable" | "not-found";
export class TidalError extends Error {
  kind: TidalErrorKind;
  constructor(kind: TidalErrorKind, message: string) {
    super(message);
    this.name = "TidalError";
    this.kind = kind;
  }
}

/** Seconds-since-epoch `exp` of a JWT, or null when the token isn't a readable JWT. Never logs the token. */
function jwtExpiry(token: string): number | null {
  const part = token.split(".")[1];
  if (!part) return null;
  try {
    const json = JSON.parse(atob(part.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(part.length / 4) * 4, "="))) as { exp?: number };
    return typeof json.exp === "number" ? json.exp : null;
  } catch {
    return null;
  }
}

function tidalBrokerUrl(): string | null {
  const direct = env.VITE_TIDAL_TOKEN_URL;
  if (direct) return direct;
  const base = env.VITE_PROMOTIONS_API_URL;
  return base ? `${base.replace(/\/$/, "")}/api/tidal/token` : null;
}

async function tidalFromBroker(url: string): Promise<string | null> {
  let res: Response;
  try {
    res = await serviceFetch(url);
  } catch {
    return null; // broker unreachable → try the next source
  }
  if (!res.ok) {
    if (res.status === 503) return null; // the broker has no Tidal credentials configured
    if (res.status === 401 || res.status === 403) throw new TidalError("unauthorized", `Tidal refused the client credentials stored on the BlackMusic server (${res.status}). Check TIDAL_CLIENT_ID / TIDAL_CLIENT_SECRET there.`);
    if (res.status === 429) throw new TidalError("rate-limited", "Tidal is rate-limiting token requests. Try again in a minute.");
    return null;
  }
  const json = (await res.json()) as { access_token?: string; expires_in?: number };
  if (!json.access_token) return null;
  tidalToken = { value: json.access_token, expiresAt: Date.now() + Math.max(30, (json.expires_in ?? 3600) - 60) * 1000 };
  return tidalToken.value;
}

/** Client-credentials exchange straight from the app. Development builds only — the secret must not be in a shipped bundle. */
async function tidalFromClientCredentials(): Promise<string | null> {
  if (!import.meta.env.DEV) return null; // dead-code-eliminated in production, so the secret is never embedded
  const id = env.VITE_TIDAL_CLIENT_ID;
  const secret = env.VITE_TIDAL_CLIENT_SECRET;
  if (!id || !secret) return null;
  let response: Response;
  try {
    response = await serviceFetch(TIDAL_TOKEN_URL, {
      method: "POST",
      headers: { Authorization: `Basic ${btoa(`${id}:${secret}`)}`, "Content-Type": "application/x-www-form-urlencoded" },
      body: "grant_type=client_credentials",
    });
  } catch {
    throw new TidalError("network", "Couldn't reach Tidal to sign in. Check your connection.");
  }
  if (response.status === 401) throw new TidalError("unauthorized", "Tidal rejected the client id/secret (401). Check VITE_TIDAL_CLIENT_ID and VITE_TIDAL_CLIENT_SECRET.");
  if (response.status === 403) throw new TidalError("forbidden", "Tidal accepted the client but denied API access (403). Developer access may need Tidal's approval.");
  if (response.status === 429) throw new TidalError("rate-limited", "Tidal is rate-limiting token requests. Try again in a minute.");
  if (!response.ok) throw new TidalError("unavailable", `Tidal's sign-in service answered ${response.status}.`);
  const json = (await response.json()) as { access_token: string; expires_in?: number };
  tidalToken = { value: json.access_token, expiresAt: Date.now() + ((json.expires_in ?? 3600) - 60) * 1000 };
  return tidalToken.value;
}

/** `skipManual` is set after a 401 so a stale pasted token can't shadow a source that can mint a fresh one. */
async function tidalAccessToken(k: ServiceKeys, skipManual = false): Promise<string> {
  if (tidalToken && Date.now() < tidalToken.expiresAt) return tidalToken.value;
  const broker = tidalBrokerUrl();
  if (broker) {
    const fromBroker = await tidalFromBroker(broker);
    if (fromBroker) return fromBroker;
  }
  const manual = skipManual ? "" : pick(k, "tidal", "VITE_TIDAL_ACCESS_TOKEN");
  if (manual) {
    const exp = jwtExpiry(manual);
    if (exp === null || exp * 1000 > Date.now()) return manual;
    // Expired: say so, but still try to mint a fresh one below before giving up.
  }
  const minted = await tidalFromClientCredentials();
  if (minted) return minted;
  if (manual) throw new TidalError("expired", "Your Tidal access token has expired. Paste a new one in Settings → Service API keys, or set up the BlackMusic token server (TIDAL_CLIENT_ID / TIDAL_CLIENT_SECRET).");
  throw new TidalError(
    "not-configured",
    import.meta.env.DEV
      ? "Tidal needs an access token (Settings → Service API keys), or VITE_TIDAL_CLIENT_ID + VITE_TIDAL_CLIENT_SECRET in .env."
      : "Tidal needs an access token (Settings → Service API keys) or the BlackMusic token server (VITE_PROMOTIONS_API_URL with TIDAL_CLIENT_ID / TIDAL_CLIENT_SECRET set there).",
  );
}

function tidalTracks(data: TidalSearch): Track[] {
  const included = data.included ?? [];
  const artists = new Map(included.filter((i) => i.type === "artists").map((i) => [i.id, i.attributes?.name ?? ""]));
  return included
    .filter((i) => i.type === "tracks")
    .map((i) => {
      const title = i.attributes?.title ?? "Untitled";
      // Use THIS track's own artist (the old code gave every track the first artist in the response).
      const ids = (i.relationships?.artists?.data ?? []).map((a) => a.id);
      const names = ids.map((id) => artists.get(id)).filter((n): n is string => Boolean(n));
      const primary = names.join(", ") || [...artists.values()][0] || "";
      return track({
        id: `tidal:${i.id}`,
        title,
        artist: primary || "Unknown artist",
        duration: isoDuration(i.attributes?.duration),
        provider: "tidal",
        // Tidal's API lists tracks but doesn't hand out streams — play them through the resolver.
        resolve: { kind: "search", query: `${primary} ${title}`.trim() },
      });
    });
}

async function tidalRequest(query: string, token: string): Promise<Response> {
  const country = env.VITE_TIDAL_COUNTRY || "US";
  try {
    return await serviceFetch(
      `https://openapi.tidal.com/v2/searchResults/${encodeURIComponent(query)}?countryCode=${country}&include=tracks,tracks.artists`,
      { headers: { Authorization: `Bearer ${token}`, accept: "application/vnd.api+json" } },
    );
  } catch {
    throw new TidalError("network", "Couldn't reach Tidal. Check your connection and try again.");
  }
}

async function tidalSearch(k: ServiceKeys, query: string): Promise<Track[]> {
  let res = await tidalRequest(query, await tidalAccessToken(k));
  if (res.status === 401) {
    // The token we used is stale or was never valid for this API. Drop it, and retry ONCE with a freshly issued one if any source can.
    tidalToken = null;
    let fresh: string | null = null;
    try {
      fresh = await tidalAccessToken(k, true);
    } catch {
      /* no other source — report the original 401 below */
    }
    if (fresh) res = await tidalRequest(query, fresh);
  }
  if (res.status === 401) throw new TidalError("unauthorized", "Tidal rejected the access token (401). It may be expired or issued for a different API — create a new one, or use the BlackMusic token server.");
  if (res.status === 403) throw new TidalError("forbidden", "Tidal accepted the token but denied this request (403). Catalog access is invite-only — your developer app may need Tidal's approval.");
  if (res.status === 429) throw new TidalError("rate-limited", "Tidal is rate-limiting requests. Wait a minute and try again.");
  if (res.status === 404) throw new TidalError("not-found", "Tidal found nothing for that request (404) — the account/region may not have catalog API access.");
  if (res.status >= 500) throw new TidalError("unavailable", `Tidal is having problems (${res.status}). Try again later.`);
  if (!res.ok) throw new TidalError("unavailable", `Tidal responded ${res.status}.`);
  return tidalTracks((await res.json()) as TidalSearch);
}

const tidal: ServiceClient = {
  id: "tidal",
  envKeys: ["VITE_TIDAL_ACCESS_TOKEN", "VITE_TIDAL_TOKEN_URL", "VITE_TIDAL_COUNTRY"],
  // "Configured" only means a credential source exists; it does NOT mean Tidal has approved access. The first request tells.
  isConfigured: (k) =>
    Boolean(pick(k, "tidal", "VITE_TIDAL_ACCESS_TOKEN") || tidalBrokerUrl() || (import.meta.env.DEV && env.VITE_TIDAL_CLIENT_ID && env.VITE_TIDAL_CLIENT_SECRET)),
  fetchTracks: (k) => tidalSearch(k, env.VITE_TIDAL_BROWSE_QUERY || "top hits"),
  search: (k, q) => tidalSearch(k, q),
};

// --- Amazon Music (Web API alpha) --------------------------------------------------------
interface AmazonTracks {
  data?: { id: string; title?: string; name?: string; duration?: number; artists?: { name: string }[]; album?: { title?: string; images?: { url: string }[] } }[];
}
const amazon: ServiceClient = {
  id: "amazon",
  envKeys: ["VITE_AMAZON_MUSIC_ACCESS_TOKEN", "VITE_AMAZON_MUSIC_API_KEY"],
  isConfigured: (k) => Boolean(pick(k, "amazon", "VITE_AMAZON_MUSIC_ACCESS_TOKEN")),
  fetchTracks: async (k) => {
    const data = await serviceJson<AmazonTracks>("https://api.music.amazon.dev/v1/tracks/popular", {
      headers: {
        Authorization: `Bearer ${pick(k, "amazon", "VITE_AMAZON_MUSIC_ACCESS_TOKEN")}`,
        "x-api-key": env.VITE_AMAZON_MUSIC_API_KEY ?? "",
      },
    });
    return (data.data ?? []).map((t) =>
      track({
        id: `amazon:${t.id}`,
        title: t.title ?? t.name ?? "Untitled",
        artist: (t.artists ?? []).map((a) => a.name).join(", ") || "Unknown artist",
        album: t.album?.title ?? "",
        duration: t.duration ?? 0,
        artworkUrl: t.album?.images?.[0]?.url,
      }),
    );
  },
};

// --- Pandora (no public API — bring your own endpoint) ---------------------------------------
const pandora: ServiceClient = {
  id: "pandora",
  envKeys: ["VITE_PANDORA_API_URL", "VITE_PANDORA_API_KEY"],
  isConfigured: (k) => Boolean(pick(k, "pandora", "VITE_PANDORA_API_URL")),
  fetchTracks: async (k) =>
    fetchCustomEndpoint({
      id: "pandora",
      name: "Pandora",
      baseUrl: pick(k, "pandora", "VITE_PANDORA_API_URL"),
      apiKey: env.VITE_PANDORA_API_KEY ?? "",
      authHeader: "Authorization",
      enabled: true,
    }),
};

export const SERVICE_CLIENTS: Record<string, ServiceClient> = {
  audius,
  lastfm,
  deezer,
  apple,
  soundcloud,
  yandex,
  youtube,
  tidal,
  amazon,
  pandora,
};

// --- User-defined APIs -------------------------------------------------------------------------

/** Accepts `[...]`, `{tracks: [...]}`, `{data: [...]}` or `{items: [...]}` with flexible field names. */
export function mapCustomTracks(serviceId: string, json: unknown): Track[] {
  const rows: unknown[] = Array.isArray(json)
    ? json
    : ((json as Record<string, unknown>)?.tracks as unknown[]) ??
      ((json as Record<string, unknown>)?.data as unknown[]) ??
      ((json as Record<string, unknown>)?.items as unknown[]) ??
      [];
  const str = (v: unknown) => (typeof v === "string" ? v : typeof v === "number" ? String(v) : "");
  return rows.map((row, i) => {
    const r = row as Record<string, unknown>;
    const artistField = r.artist ?? r.artistName ?? r.author;
    const artist = typeof artistField === "object" && artistField ? str((artistField as Record<string, unknown>).name) : str(artistField);
    const seconds = Number(r.duration ?? r.length ?? 0);
    return track({
      id: `${serviceId}:${str(r.id) || i}`,
      title: str(r.title ?? r.name) || "Untitled",
      artist: artist || "Unknown artist",
      album: str(r.album ?? r.albumName),
      duration: seconds > 36000 ? seconds / 1000 : seconds, // tolerate millisecond durations
      sourceUrl: str(r.stream_url ?? r.streamUrl ?? r.preview ?? r.previewUrl ?? r.url ?? r.audio),
      artworkUrl: str(r.artwork ?? r.artworkUrl ?? r.cover ?? r.image ?? r.thumbnail) || undefined,
    });
  });
}

export async function fetchCustomEndpoint(api: CustomServiceApi): Promise<Track[]> {
  const headers: Record<string, string> = {};
  if (api.apiKey) {
    const header = api.authHeader || "Authorization";
    headers[header] = header.toLowerCase() === "authorization" ? `Bearer ${api.apiKey}` : api.apiKey;
  }
  const json = await serviceJson<unknown>(api.baseUrl, { headers });
  return mapCustomTracks(api.id.startsWith(CUSTOM_SERVICE_PREFIX) ? api.id : `${CUSTOM_SERVICE_PREFIX}${api.id}`, json);
}

export async function loadServiceKeys(): Promise<ServiceKeys> {
  return getPreference<ServiceKeys>(SERVICE_KEYS_STORAGE_KEY, {});
}

/** Single entry point used by the Online page. */
export async function fetchServiceTracks(serviceId: string, limit = 50): Promise<{ tracks: Track[]; needsKey: boolean }> {
  if (serviceId.startsWith(CUSTOM_SERVICE_PREFIX)) {
    const api = (await loadCustomApis()).find((a) => a.id === serviceId.slice(CUSTOM_SERVICE_PREFIX.length) || a.id === serviceId);
    if (!api) return { tracks: [], needsKey: false };
    return { tracks: await fetchCustomEndpoint(api), needsKey: false };
  }
  const client = SERVICE_CLIENTS[serviceId];
  if (!client) return { tracks: [], needsKey: false };
  const keys = await loadServiceKeys();
  if (!client.isConfigured(keys)) return { tracks: [], needsKey: true };
  return { tracks: await client.fetchTracks(keys, limit), needsKey: false };
}

/** `@online-<service>:` search entry point. Falls back to filtering the service's chart when it has no search endpoint. */
export async function searchServiceTracks(serviceId: string, query: string, limit = 30): Promise<{ tracks: Track[]; needsKey: boolean }> {
  const client = SERVICE_CLIENTS[serviceId];
  if (!client) return { tracks: [], needsKey: false };
  const keys = await loadServiceKeys();
  if (!client.isConfigured(keys)) return { tracks: [], needsKey: true };
  if (client.search) return { tracks: await client.search(keys, query, limit), needsKey: false };
  const all = await client.fetchTracks(keys, 50);
  const needle = query.toLowerCase();
  return { tracks: all.filter((t) => `${t.title} ${t.artist} ${t.album}`.toLowerCase().includes(needle)).slice(0, limit), needsKey: false };
}

export async function isServiceReady(serviceId: string): Promise<boolean> {
  const client = SERVICE_CLIENTS[serviceId];
  if (!client) return true;
  return client.isConfigured(await loadServiceKeys());
}
