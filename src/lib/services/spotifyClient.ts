import { generateCodeChallenge, generateCodeVerifier } from "./pkce";
import { getPreference, setPreference } from "@/lib/preferencesStore";

export const SPOTIFY_REDIRECT_URI = "blackmusic://spotify/callback";
const VERIFIER_KEY = "blackmusic:spotifyPkceVerifier";
const TOKENS_KEY = "blackmusic:spotifyTokens";

interface SpotifyTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
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
  if (!clientId) return null;

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
  return Boolean(tokens?.refreshToken);
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
