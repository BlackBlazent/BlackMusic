import type { Track } from "@/lib/types";
import { getPreference } from "@/lib/preferencesStore";
import { serviceFetch, serviceJson } from "./serviceFetch";
import { fetchAudiusTrending, audiusStreamUrl, type AudiusTrack } from "./audiusClient";
import { loadCustomApis, CUSTOM_SERVICE_PREFIX, type CustomServiceApi } from "./customApis";

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
}

/** Per-service keys the user typed into Settings (override/augment env). */
export type ServiceKeys = Record<string, string | undefined>;

export const SERVICE_KEYS_STORAGE_KEY = "blackmusic:serviceKeys";

export const SERVICE_AUTH_SCOPES = {
  spotify:
    "user-read-private user-read-email user-library-read playlist-read-private streaming user-modify-playback-state user-read-playback-state",
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

// --- Last.fm (chart) ----------------------------------------------------------
interface LastfmChart {
  tracks?: { track?: { name: string; duration?: string; url: string; artist: { name: string }; image?: { "#text": string }[] }[] };
}
const lastfm: ServiceClient = {
  id: "lastfm",
  envKeys: ["VITE_LASTFM_API_KEY"],
  isConfigured: (k) => Boolean(pick(k, "lastfm", "VITE_LASTFM_API_KEY")),
  fetchTracks: async (k, limit = 50) => {
    const params = new URLSearchParams({
      method: "chart.gettoptracks",
      api_key: pick(k, "lastfm", "VITE_LASTFM_API_KEY"),
      format: "json",
      limit: String(limit),
    });
    const data = await serviceJson<LastfmChart>(`https://ws.audioscrobbler.com/2.0/?${params}`);
    return (data.tracks?.track ?? []).map((t) =>
      track({
        id: `lastfm:${t.artist.name}:${t.name}`,
        title: t.name,
        artist: t.artist.name,
        duration: Number(t.duration ?? 0),
        // Last.fm lists/scrobbles — it doesn't stream. Artwork is often a blank placeholder.
        artworkUrl: [...(t.image ?? [])].reverse().find((i) => i["#text"] && !i["#text"].includes("2a96cbd8b46e442fc41c2b86b821562f"))?.["#text"],
      }),
    );
  },
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
      }),
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
    return (data.items ?? []).map((v) =>
      track({
        id: `youtube:${v.id}`,
        title: v.snippet.title,
        artist: v.snippet.channelTitle,
        duration: isoDuration(v.contentDetails?.duration),
        artworkUrl: v.snippet.thumbnails?.high?.url ?? v.snippet.thumbnails?.medium?.url,
      }),
    );
  },
};

// --- Tidal (OpenAPI v2 bearer token) ---------------------------------------------------
interface TidalSearch {
  included?: { id: string; type: string; attributes?: { title?: string; duration?: string; name?: string } }[];
}
const TIDAL_TOKEN_URL = "https://auth.tidal.com/v1/oauth2/token";
let tidalToken: { value: string; expiresAt: number } | null = null;

/** A pasted token wins; otherwise exchange client id + secret (client-credentials flow) and cache it until it expires. */
async function tidalAccessToken(k: ServiceKeys): Promise<string> {
  const manual = pick(k, "tidal", "VITE_TIDAL_ACCESS_TOKEN");
  if (manual) return manual;
  if (tidalToken && Date.now() < tidalToken.expiresAt) return tidalToken.value;
  const id = env.VITE_TIDAL_CLIENT_ID;
  const secret = env.VITE_TIDAL_CLIENT_SECRET;
  if (!id || !secret) throw new Error("Tidal needs VITE_TIDAL_ACCESS_TOKEN, or VITE_TIDAL_CLIENT_ID + VITE_TIDAL_CLIENT_SECRET.");
  const response = await serviceFetch(TIDAL_TOKEN_URL, {
    method: "POST",
    headers: { Authorization: `Basic ${btoa(`${id}:${secret}`)}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: "grant_type=client_credentials",
  });
  if (!response.ok) throw new Error(`Tidal token request failed (${response.status}).`);
  const json = (await response.json()) as { access_token: string; expires_in?: number };
  tidalToken = { value: json.access_token, expiresAt: Date.now() + ((json.expires_in ?? 3600) - 60) * 1000 };
  return tidalToken.value;
}

const tidal: ServiceClient = {
  id: "tidal",
  envKeys: ["VITE_TIDAL_CLIENT_ID", "VITE_TIDAL_CLIENT_SECRET", "VITE_TIDAL_COUNTRY"],
  isConfigured: (k) =>
    Boolean(pick(k, "tidal", "VITE_TIDAL_ACCESS_TOKEN") || (env.VITE_TIDAL_CLIENT_ID && env.VITE_TIDAL_CLIENT_SECRET)),
  fetchTracks: async (k) => {
    const country = env.VITE_TIDAL_COUNTRY || "US";
    const token = await tidalAccessToken(k);
    const data = await serviceJson<TidalSearch>(
      `https://openapi.tidal.com/v2/searchResults/top?countryCode=${country}&include=tracks`,
      { headers: { Authorization: `Bearer ${token}`, accept: "application/vnd.api+json" } },
    );
    return (data.included ?? [])
      .filter((i) => i.type === "tracks")
      .map((i) => track({ id: `tidal:${i.id}`, title: i.attributes?.title ?? "Untitled", duration: isoDuration(i.attributes?.duration) }));
  },
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

export async function isServiceReady(serviceId: string): Promise<boolean> {
  const client = SERVICE_CLIENTS[serviceId];
  if (!client) return true;
  return client.isConfigured(await loadServiceKeys());
}
