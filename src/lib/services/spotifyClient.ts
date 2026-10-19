import { generateCodeChallenge, generateCodeVerifier } from "./pkce";
import { getPreference, setPreference } from "@/lib/preferencesStore";

export const SPOTIFY_REDIRECT_URI = "blackmusic://spotify/callback";
const VERIFIER_KEY = "blackmusic:spotifyPkceVerifier";
const TOKENS_KEY = "blackmusic:spotifyTokens";

interface SpotifyTokens {
  accessToken: string;
  /** Empty when the token came from Supabase and can't be refreshed client-side. */
  refreshToken: string;
  expiresAt: number;
}

/**
 * 2.1.0: Spotify now signs in through the Supabase integration (Supabase's
 * Spotify provider, redirect `blackmusic://auth/callback`) instead of the
 * env-driven PKCE client. Supabase hands back the Spotify access token as the
 * session's `provider_token`; this stores it where every Spotify call already
 * looks. Refreshing needs the Spotify client *secret*, which only Supabase
 * holds — so when this token expires (~1h) the user simply reconnects.
 */
export async function storeSpotifyProviderTokens(accessToken: string, refreshToken: string | null): Promise<void> {
  await setPreference<SpotifyTokens>(TOKENS_KEY, {
    accessToken,
    refreshToken: refreshToken ?? "",
    expiresAt: Date.now() + 55 * 60 * 1000,
  });
}

/** Builds the authorize URL and stashes the PKCE verifier for the callback to pick up. */
export async function buildSpotifyAuthUrl(): Promise<string | null> {
  const clientId = import.meta.env.VITE_SPOTIFY_CLIENT_ID;
  if (!clientId) return null;

  const verifier = generateCodeVerifier();
  const challenge = await generateCodeChallenge(verifier);
  await setPreference(VERIFIER_KEY, verifier);

  const params = new URLSearchParams({
    client_id: clientId,
    response_type: "code",
    redirect_uri: SPOTIFY_REDIRECT_URI,
    code_challenge_method: "S256",
    code_challenge: challenge,
    scope: "user-read-private user-read-email user-library-read playlist-read-private streaming",
  });
  return `https://accounts.spotify.com/authorize?${params.toString()}`;
}

/** Call with the full `blackmusic://spotify/callback?code=...` URL caught by the deep-link plugin. */
export async function handleSpotifyCallback(url: string): Promise<boolean> {
  const parsed = new URL(url);
  const code = parsed.searchParams.get("code");
  if (!code) return false;

  const clientId = import.meta.env.VITE_SPOTIFY_CLIENT_ID;
  const verifier = await getPreference<string | null>(VERIFIER_KEY, null);
  if (!clientId || !verifier) return false;

  const response = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: SPOTIFY_REDIRECT_URI,
      client_id: clientId,
      code_verifier: verifier,
    }),
  });
  if (!response.ok) return false;

  const data = await response.json();
  await setPreference<SpotifyTokens>(TOKENS_KEY, {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresAt: Date.now() + data.expires_in * 1000,
  });
  return true;
}

async function refreshSpotifyTokens(refreshToken: string): Promise<SpotifyTokens | null> {
  const clientId = import.meta.env.VITE_SPOTIFY_CLIENT_ID;
  // No client id (Supabase-managed Spotify) or no refresh token -> can't refresh here.
  if (!clientId || !refreshToken) return null;

  const response = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
      client_id: clientId,
    }),
  });
  if (!response.ok) return null;

  const data = await response.json();
  const tokens: SpotifyTokens = {
    accessToken: data.access_token,
    // Spotify doesn't always return a new refresh token — keep the old one if so.
    refreshToken: data.refresh_token ?? refreshToken,
    expiresAt: Date.now() + data.expires_in * 1000,
  };
  await setPreference(TOKENS_KEY, tokens);
  return tokens;
}

export async function isSpotifyConnected(): Promise<boolean> {
  const tokens = await getPreference<SpotifyTokens | null>(TOKENS_KEY, null);
  if (!tokens) return false;
  return Boolean(tokens.refreshToken) || Date.now() < tokens.expiresAt;
}

export async function disconnectSpotify(): Promise<void> {
  await setPreference(TOKENS_KEY, null);
}

export async function getValidAccessToken(): Promise<string | null> {
  const tokens = await getPreference<SpotifyTokens | null>(TOKENS_KEY, null);
  if (!tokens) return null;
  if (Date.now() < tokens.expiresAt - 30_000) return tokens.accessToken;
  const refreshed = await refreshSpotifyTokens(tokens.refreshToken);
  return refreshed?.accessToken ?? null;
}

/** Thrown by fetchSpotifyOrThrow so the UI can say WHY (expired session vs. missing scope vs. not allowlisted). */
export class SpotifyApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly kind: "not-connected" | "expired" | "forbidden" | "rate-limited" | "other",
  ) {
    super(message);
    this.name = "SpotifyApiError";
  }
}

export async function fetchSpotifyOrThrow<T>(path: string): Promise<T> {
  let token = await getValidAccessToken();
  if (!token) throw new SpotifyApiError(401, "Spotify isn't connected, or the session expired.", "not-connected");

  const attempt = (t: string) => fetch(`https://api.spotify.com/v1${path}`, { headers: { Authorization: `Bearer ${t}` } });
  let response = await attempt(token);

  // 401 = token expired/revoked. Try a refresh once (only possible with the env PKCE client), then retry.
  if (response.status === 401) {
    const stored = await getPreference<SpotifyTokens | null>(TOKENS_KEY, null);
    const refreshed = stored ? await refreshSpotifyTokens(stored.refreshToken) : null;
    if (refreshed) {
      token = refreshed.accessToken;
      response = await attempt(token);
    }
  }
  if (response.ok) return (await response.json()) as T;

  let detail = "";
  try {
    const body = (await response.json()) as { error?: { message?: string } | string; error_description?: string };
    detail = typeof body.error === "string" ? body.error_description ?? body.error : body.error?.message ?? "";
  } catch {
    /* no JSON body */
  }
  console.error("[spotify]", response.status, path, detail);

  if (response.status === 401) {
    await setPreference(TOKENS_KEY, null); // stale token — stop reporting "connected"
    throw new SpotifyApiError(401, "Your Spotify session expired — reconnect to continue.", "expired");
  }
  if (response.status === 403) {
    throw new SpotifyApiError(
      403,
      detail ||
        "Spotify refused this request. Please check your account access or try reconnecting.", // The token is missing a permission (e.g. user-library-read) or this Spotify account isn't on the app's allow-list in the Spotify Developer Dashboard (apps in development mode only serve allow-listed users).
      "forbidden",
    );
  }
  if (response.status === 429) throw new SpotifyApiError(429, "Spotify is rate-limiting requests — try again in a moment.", "rate-limited");
  throw new SpotifyApiError(response.status, detail || `Spotify responded ${response.status}.`, "other");
}

export async function fetchSpotify<T>(path: string): Promise<T | null> {
  const token = await getValidAccessToken();
  if (!token) return null;
  const response = await fetch(`https://api.spotify.com/v1${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok) return null;
  return response.json() as Promise<T>;
}

/** For the player-control endpoints (play/pause/seek/volume/...), which return no body on success. */
export async function spotifyApiRequest(
  path: string,
  method: "PUT" | "POST",
  body?: Record<string, unknown>,
): Promise<boolean> {
  const token = await getValidAccessToken();
  if (!token) return false;
  const response = await fetch(`https://api.spotify.com/v1${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  return response.ok;
}
