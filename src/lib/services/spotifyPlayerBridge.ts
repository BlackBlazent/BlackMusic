import { getValidAccessToken, spotifyApiRequest } from "./spotifyClient";

// Minimal shape of what we use from the SDK's global — the full type surface
// lives in Spotify's own (non-npm) type declarations, not worth vendoring here.
interface SpotifyPlayerInstance {
  connect(): Promise<boolean>;
  disconnect(): void;
  addListener(event: string, cb: (data: unknown) => void): void;
  pause(): Promise<void>;
  resume(): Promise<void>;
  seek(ms: number): Promise<void>;
  nextTrack(): Promise<void>;
  previousTrack(): Promise<void>;
  setVolume(volume: number): Promise<void>;
}

declare global {
  interface Window {
    onSpotifyWebPlaybackSDKReady?: () => void;
    Spotify?: {
      Player: new (options: {
        name: string;
        getOAuthToken: (cb: (token: string) => void) => void;
        volume?: number;
      }) => SpotifyPlayerInstance;
    };
  }
}

let sdkLoadPromise: Promise<void> | null = null;

function loadSdkScript(): Promise<void> {
  if (window.Spotify) return Promise.resolve();
  if (sdkLoadPromise) return sdkLoadPromise;

  sdkLoadPromise = new Promise((resolve) => {
    window.onSpotifyWebPlaybackSDKReady = () => resolve();
    const script = document.createElement("script");
    script.src = "https://sdk.scdn.co/spotify-player.js";
    script.async = true;
    document.head.appendChild(script);
  });
  return sdkLoadPromise;
}

export interface SpotifyPlaybackState {
  paused: boolean;
  positionMs: number;
  durationMs: number;
  trackUri: string | null;
}

let playerInstance: SpotifyPlayerInstance | null = null;
let deviceIdPromiseResolve: ((id: string) => void) | null = null;
let deviceIdPromise: Promise<string> | null = null;

/** Connects once, reusing the same player instance across calls. */
export async function ensureSpotifyPlayer(onStateChange: (state: SpotifyPlaybackState | null) => void): Promise<string> {
  if (playerInstance && deviceIdPromise) return deviceIdPromise;

  await loadSdkScript();
  if (!window.Spotify) throw new Error("Spotify SDK failed to load.");

  deviceIdPromise = new Promise((resolve) => {
    deviceIdPromiseResolve = resolve;
  });

  playerInstance = new window.Spotify.Player({
    name: "BlackMusic",
    getOAuthToken: (cb) => {
      void getValidAccessToken().then((token) => cb(token ?? ""));
    },
    volume: 0.8,
  });

  playerInstance.addListener("ready", (data) => {
    const { device_id } = data as { device_id: string };
    deviceIdPromiseResolve?.(device_id);
  });

  playerInstance.addListener("player_state_changed", (data) => {
    if (!data) {
      onStateChange(null);
      return;
    }
    const state = data as {
      paused: boolean;
      position: number;
      duration: number;
      track_window: { current_track: { uri: string } | null };
    };
    onStateChange({
      paused: state.paused,
      positionMs: state.position,
      durationMs: state.duration,
      trackUri: state.track_window.current_track?.uri ?? null,
    });
  });

  for (const errorEvent of ["initialization_error", "authentication_error", "account_error", "playback_error"]) {
    playerInstance.addListener(errorEvent, (data) => {
      // eslint-disable-next-line no-console -- surfaced here rather than silently failing playback
      console.error(`Spotify player ${errorEvent}:`, data);
    });
  }

  await playerInstance.connect();
  return deviceIdPromise;
}

/** Starts playback of a single track URI on our SDK device — the one Web API call that has no SDK-only equivalent. */
export async function spotifyPlayUri(trackUri: string): Promise<void> {
  const deviceId = await ensureSpotifyPlayer(() => {});
  await spotifyApiRequest(`/me/player/play?device_id=${deviceId}`, "PUT", { uris: [trackUri] });
}

export function spotifyPause(): Promise<void> {
  return playerInstance?.pause() ?? Promise.resolve();
}
export function spotifyResume(): Promise<void> {
  return playerInstance?.resume() ?? Promise.resolve();
}
export function spotifySeek(ms: number): Promise<void> {
  return playerInstance?.seek(ms) ?? Promise.resolve();
}
export function spotifyNext(): Promise<void> {
  return playerInstance?.nextTrack() ?? Promise.resolve();
}
export function spotifyPrevious(): Promise<void> {
  return playerInstance?.previousTrack() ?? Promise.resolve();
}
export function spotifySetVolume(volume: number): Promise<void> {
  return playerInstance?.setVolume(volume) ?? Promise.resolve();
}

export function isSpotifyTrackId(trackId: string): boolean {
  return trackId.startsWith("spotify:");
}
