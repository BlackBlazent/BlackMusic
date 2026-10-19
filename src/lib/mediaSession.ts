import { useEffect, useRef } from "react";
import { usePlayback } from "@/app/context/PlaybackContext";

/**
 * Media Controls / Media Notification (2.2.0 immediate fix, mobile).
 *
 * The card in the notification shade, on the lock screen and in the control centre — artwork, title, artist and
 * play / pause / previous / next / seek — comes from the OS media session. Two layers feed it:
 *
 *  1. The standard Web Media Session API (`navigator.mediaSession`): iOS lock screen / control centre, headset + keyboard media
 *     keys, Windows system media overlay, Chromium-based shells.
 *  2. On Android the system WebView does NOT turn that into a notification, so a small native bridge
 *     (`window.BlackMusicMedia`, installed by scripts/android-post-init.mjs: MediaSession + MediaStyle notification + foreground
 *     service) receives the same state and sends button presses back through `window.__bmMedia(action)`.
 *
 * Both are optional and feature-detected: where neither exists this hook does nothing.
 */
interface NativeMediaBridge {
  update(title: string, artist: string, album: string, artwork: string, playing: boolean, positionMs: number, durationMs: number): void;
  clear(): void;
}
declare global {
  interface Window {
    BlackMusicMedia?: NativeMediaBridge;
    __bmMedia?: (action: string, value?: number) => void;
  }
}

export function useMediaSession(): void {
  const { currentTrack, isPlaying, position, duration, togglePlay, next, previous, seek, playbackRate } = usePlayback();

  // Latest controls, read by handlers registered once (so they never act on a stale track/queue).
  const live = useRef({ isPlaying, position, duration, togglePlay, next, previous, seek });
  live.current = { isPlaying, position, duration, togglePlay, next, previous, seek };

  // ---- action handlers (registered once) ----
  useEffect(() => {
    const run = (action: string, value?: number) => {
      const c = live.current;
      switch (action) {
        case "play": if (!c.isPlaying) c.togglePlay(); break;
        case "pause": if (c.isPlaying) c.togglePlay(); break;
        case "stop": if (c.isPlaying) c.togglePlay(); c.seek(0); break;
        case "next": c.next(); break;
        case "previous": c.previous(); break;
        case "seekto": if (typeof value === "number" && Number.isFinite(value)) c.seek(Math.max(0, Math.min(c.duration || value, value))); break;
        case "seekforward": c.seek(Math.min(c.duration || Infinity, c.position + (value ?? 10))); break;
        case "seekbackward": c.seek(Math.max(0, c.position - (value ?? 10))); break;
        default: break;
      }
    };
    window.__bmMedia = run; // Android bridge → app

    const ms = "mediaSession" in navigator ? navigator.mediaSession : null;
    const set = (name: MediaSessionAction, handler: MediaSessionActionHandler | null) => {
      try { ms?.setActionHandler(name, handler); } catch { /* action not supported on this platform */ }
    };
    set("play", () => run("play"));
    set("pause", () => run("pause"));
    set("stop", () => run("stop"));
    set("previoustrack", () => run("previous"));
    set("nexttrack", () => run("next"));
    set("seekto", (d) => run("seekto", d.seekTime));
    set("seekforward", (d) => run("seekforward", d.seekOffset));
    set("seekbackward", (d) => run("seekbackward", d.seekOffset));
    return () => {
      delete window.__bmMedia;
      for (const a of ["play", "pause", "stop", "previoustrack", "nexttrack", "seekto", "seekforward", "seekbackward"] as MediaSessionAction[]) set(a, null);
    };
  }, []);

  // ---- what's playing: metadata + artwork ----
  const trackKey = currentTrack ? `${currentTrack.id}|${currentTrack.title}|${currentTrack.artist}|${currentTrack.album}|${currentTrack.artworkUrl ?? ""}` : "";
  useEffect(() => {
    const ms = "mediaSession" in navigator ? navigator.mediaSession : null;
    if (!currentTrack) {
      if (ms) ms.metadata = null;
      window.BlackMusicMedia?.clear();
      return;
    }
    if (ms && typeof MediaMetadata !== "undefined") {
      try {
        ms.metadata = new MediaMetadata({
          title: currentTrack.title,
          artist: currentTrack.artist,
          album: currentTrack.album,
          artwork: currentTrack.artworkUrl ? [{ src: currentTrack.artworkUrl, sizes: "512x512" }] : [],
        });
      } catch { /* artwork the platform rejects: keep the text-only card */ }
    }
  }, [trackKey]); // eslint-disable-line react-hooks/exhaustive-deps -- trackKey already covers every field read

  // ---- play state + position (throttled to ~1 Hz; a per-frame update would spam the OS) ----
  const lastPush = useRef(0);
  const lastState = useRef("");
  useEffect(() => {
    const ms = "mediaSession" in navigator ? navigator.mediaSession : null;
    if (ms) ms.playbackState = !currentTrack ? "none" : isPlaying ? "playing" : "paused";
  }, [isPlaying, currentTrack?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!currentTrack) return;
    const now = Date.now();
    // Play/pause and track changes reach the native card immediately; plain position ticks are limited to ~1 Hz.
    const stateKey = `${isPlaying}|${trackKey}`;
    const urgent = lastState.current !== stateKey;
    lastState.current = stateKey;
    if (!urgent && now - lastPush.current < 1000) return;
    lastPush.current = now;
    const ms = "mediaSession" in navigator ? navigator.mediaSession : null;
    if (ms && duration > 0 && Number.isFinite(duration)) {
      try { ms.setPositionState({ duration, position: Math.min(position, duration), playbackRate: playbackRate || 1 }); } catch { /* invalid state while loading */ }
    }
    window.BlackMusicMedia?.update(currentTrack.title, currentTrack.artist, currentTrack.album, currentTrack.artworkUrl ?? "", isPlaying, Math.round(position * 1000), Math.round((duration || 0) * 1000));
  }, [position, duration, isPlaying, trackKey, playbackRate]); // eslint-disable-line react-hooks/exhaustive-deps
}
