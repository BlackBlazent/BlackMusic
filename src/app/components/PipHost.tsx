import { useEffect, useRef } from "react";
import { emit, listen } from "@tauri-apps/api/event";
import { usePlayback } from "@/app/context/PlaybackContext";
import { usePlayerUi } from "@/app/context/PlayerUiContext";
import { useNotifications } from "@/app/context/NotificationsContext";
import { useTheme } from "@/app/providers/ThemeProvider";
import { getPreference, setPreference } from "@/lib/preferencesStore";
import { isTauri } from "@/lib/platform";
import {
  PIP_EVENTS,
  closePipWindow,
  focusMainWindow,
  openPipWindow,
  type PipCommand,
  type PipPlacement,
  type PipState,
} from "@/lib/pip/pipBridge";

const PLACEMENT_KEY = "blackmusic:pipPlacement";
const HEARTBEAT_MS = 2000;

/**
 * Lives in the MAIN window (render once, inside AppShell); renders nothing. It
 *  1. opens/closes the native always-on-top mini-player window when `pipOpen` flips,
 *  2. mirrors a small playback snapshot to it, and
 *  3. runs the commands the mini window sends back (play/pause, previous/next, ±skip, stop, repeat, seek).
 * Audio never leaves the main window, so playback keeps working while the main window is minimized.
 */
export function PipHost() {
  const playback = usePlayback();
  const ui = usePlayerUi();
  const { push } = useNotifications();
  const { theme } = useTheme();

  const { currentTrack, isPlaying, position, duration, playbackRate, repeatMode } = playback;
  const videoId = ui.activeVideoId;

  // Always-current values for the long-lived event listeners below.
  const latest = useRef({ playback, ui, currentTrack, isPlaying, position, duration, playbackRate, repeatMode, videoId });
  latest.current = { playback, ui, currentTrack, isPlaying, position, duration, playbackRate, repeatMode, videoId };

  const lastSent = useRef({ position: 0, at: 0 });
  const lastArtKey = useRef<string | null>(null);
  const opening = useRef<Promise<void> | null>(null);

  const publish = (forceArtwork = false) => {
    if (!isTauri() || !latest.current.ui.pipOpen) return;
    const v = latest.current;
    const t = v.currentTrack;
    const artKey = `${t?.id ?? ""}|${t?.artworkUrl?.length ?? 0}`;
    const includeArtwork = forceArtwork || artKey !== lastArtKey.current;
    lastArtKey.current = artKey;
    const state: PipState = {
      hasTrack: Boolean(t),
      trackId: t?.id ?? null,
      title: t?.title ?? "",
      artist: t?.artist ?? "",
      artwork: includeArtwork ? t?.artworkUrl ?? null : undefined,
      isPlaying: v.isPlaying,
      position: v.position,
      duration: v.duration,
      rate: v.playbackRate,
      repeatMode: v.repeatMode,
      videoId: v.videoId,
      at: Date.now(),
    };
    lastSent.current = { position: state.position, at: state.at };
    void emit(PIP_EVENTS.state, state);
  };
  const publishRef = useRef(publish);
  publishRef.current = publish;

  // --- window lifecycle ---
  useEffect(() => {
    if (!isTauri()) return;
    if (!ui.pipOpen) {
      void closePipWindow();
      return;
    }
    // Guard against double-invocation (React StrictMode in dev) creating the same window label twice.
    opening.current ??= getPreference<PipPlacement | null>(PLACEMENT_KEY, null)
      .then((saved) => openPipWindow(theme, saved))
      .catch((error) => {
        ui.setPipOpen(false);
        push("Couldn't open the mini player", error instanceof Error ? error.message : String(error));
      })
      .finally(() => {
        opening.current = null;
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only react to open/close
  }, [ui.pipOpen]);

  // --- events from the mini window ---
  useEffect(() => {
    if (!isTauri()) return;
    const unlisteners: Promise<() => void>[] = [
      listen<PipCommand>(PIP_EVENTS.command, ({ payload }) => {
        const { playback: pb, ui: u } = latest.current;
        switch (payload.action) {
          case "toggle":
            pb.togglePlay();
            break;
          case "next":
            pb.next();
            break;
          case "previous":
            pb.previous();
            break;
          case "repeat":
            pb.cycleRepeatMode();
            break;
          case "seek":
            pb.seek(payload.seconds);
            break;
          case "skip": {
            const max = latest.current.duration > 0 ? latest.current.duration : Infinity;
            pb.seek(Math.max(0, Math.min(max, latest.current.position + payload.seconds)));
            break;
          }
          case "stop":
            pb.seek(0);
            if (latest.current.isPlaying) pb.togglePlay();
            break;
          case "showMain":
            void focusMainWindow();
            break;
          case "close":
            u.setPipOpen(false);
            break;
        }
        // Confirm the result to the mini window right after React has applied the change.
        window.setTimeout(() => publishRef.current(), 160);
      }),
      listen(PIP_EVENTS.ready, () => publishRef.current(true)),
      listen<PipPlacement>(PIP_EVENTS.moved, ({ payload }) => void setPreference(PLACEMENT_KEY, payload)),
      listen(PIP_EVENTS.closed, () => latest.current.ui.setPipOpen(false)),
    ];
    return () => {
      unlisteners.forEach((u) => void u.then((fn) => fn()));
    };
  }, []);

  // --- mirror state: discrete changes ---
  useEffect(() => {
    publishRef.current();
  }, [ui.pipOpen, currentTrack?.id, currentTrack?.artworkUrl, isPlaying, repeatMode, duration, playbackRate, videoId, theme]);

  // --- mirror state: position only on seeks/jumps (the mini window interpolates in between) ---
  useEffect(() => {
    if (!ui.pipOpen) return;
    const last = lastSent.current;
    const expected = last.position + (isPlaying ? ((Date.now() - last.at) / 1000) * playbackRate : 0);
    if (Math.abs(position - expected) > 1.2) publishRef.current();
  }, [position, ui.pipOpen, isPlaying, playbackRate]);

  // --- heartbeat: a tiny snapshot every 2s so the mini window can never drift from the truth ---
  useEffect(() => {
    if (!ui.pipOpen) return;
    const id = window.setInterval(() => publishRef.current(), HEARTBEAT_MS);
    return () => window.clearInterval(id);
  }, [ui.pipOpen]);

  return null;
}