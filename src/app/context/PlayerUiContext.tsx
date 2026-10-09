import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { usePlayback } from "./PlaybackContext";
import { useNotifications } from "./NotificationsContext";
import { findOfficialVideo, type VideoMatch } from "@/lib/video/ytdlp";
import { usePersistentState } from "@/lib/usePersistentState";

type VideoStatus = "idle" | "searching" | "ready" | "none" | "error";

interface PlayerUiValue {
  videoMode: boolean;
  setVideoMode: (on: boolean) => void;
  video: VideoMatch | null;
  videoStatus: VideoStatus;
  videoError: string | null;
  linkVideoId: string | null;
  setLinkVideoId: (id: string | null) => void;
  activeVideoId: string | null;
  ambient: boolean;
  setAmbient: (on: boolean) => void;
  /** true while the native always-on-top mini-player window is open (PipHost opens/closes it). */
  pipOpen: boolean;
  setPipOpen: (on: boolean) => void;
  /** VideoFrame calls this on mount (true) and unmount (false) with its own iframe. */
  registerPlayer: (frame: HTMLIFrameElement, mounted: boolean) => void;
}

const PlayerUiContext = createContext<PlayerUiValue | null>(null);

const post = (frame: HTMLIFrameElement, func: string, args: unknown[] = []) =>
  frame.contentWindow?.postMessage(JSON.stringify({ event: "command", func, args }), "*");

export function PlayerUiProvider({ children }: { children: ReactNode }) {
  const { currentTrack, isPlaying, position, playbackRate, setAudioMuted } = usePlayback();
  const { push } = useNotifications();
  const [videoMode, setVideoMode] = usePersistentState<boolean>("player.videoMode", false);
  const [ambient, setAmbient] = usePersistentState<boolean>("player.ambient", false);
  // NOT persisted: the mini window doesn't survive a restart.
  const [pipOpen, setPipOpen] = useState(false);
  const [video, setVideo] = useState<VideoMatch | null>(null);
  const [videoStatus, setVideoStatus] = useState<VideoStatus>("idle");
  const [videoError, setVideoError] = useState<string | null>(null);
  const [linkVideoId, setLinkVideoId] = useState<string | null>(null);
  const frames = useRef(new Set<HTMLIFrameElement>());
  const [frameCount, setFrameCount] = useState(0);

  const latest = useRef({ position, isPlaying });
  latest.current = { position, isPlaying };

  useEffect(() => {
    setLinkVideoId(null);
    setVideo(null);
    if (!videoMode || !currentTrack) {
      setVideoStatus("idle");
      return;
    }
    let cancelled = false;
    setVideoStatus("searching");
    setVideoError(null);
    findOfficialVideo(currentTrack.id, currentTrack.title, currentTrack.artist)
      .then((match) => {
        if (cancelled) return;
        setVideo(match);
        setVideoStatus(match ? "ready" : "none");
      })
      .catch((e) => {
        if (cancelled) return;
        setVideoStatus("error");
        setVideoError(e instanceof Error ? e.message : String(e));
      });
    return () => {
      cancelled = true;
    };
  }, [videoMode, currentTrack?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const activeVideoId = linkVideoId ?? (videoMode ? video?.id ?? null : null);

  // FIX: local audio is only muted while an iframe that can actually supply the sound is mounted.
  useEffect(() => {
    setAudioMuted(Boolean(activeVideoId) && frameCount > 0);
    return () => setAudioMuted(false);
  }, [activeVideoId, frameCount, setAudioMuted]);

  const registerPlayer = useCallback((frame: HTMLIFrameElement, mounted: boolean) => {
    if (!mounted) {
      frames.current.delete(frame);
      setFrameCount(frames.current.size);
      return;
    }
    frames.current.add(frame);
    setFrameCount(frames.current.size);
    window.setTimeout(() => {
      if (!frames.current.has(frame)) return;
      post(frame, "seekTo", [latest.current.position, true]);
      post(frame, latest.current.isPlaying ? "playVideo" : "pauseVideo");
    }, 1500);
  }, []);

  const eachFrame = (fn: (frame: HTMLIFrameElement) => void) => frames.current.forEach(fn);

  useEffect(() => {
    if (!activeVideoId) return;
    eachFrame((f) => post(f, isPlaying ? "playVideo" : "pauseVideo"));
  }, [isPlaying, activeVideoId]);

  // Re-seek the video only when the audio clock JUMPS — not on a timer (that made the picture stutter).
  const lastClock = useRef({ position: 0, at: Date.now() });
  useEffect(() => {
    const last = lastClock.current;
    const expected = last.position + (isPlaying ? ((Date.now() - last.at) / 1000) * playbackRate : 0);
    lastClock.current = { position, at: Date.now() };
    if (activeVideoId && Math.abs(position - expected) > 1.5) eachFrame((f) => post(f, "seekTo", [position, true]));
  }, [position]); // eslint-disable-line react-hooks/exhaustive-deps

  const value = useMemo<PlayerUiValue>(
    () => ({
      videoMode,
      setVideoMode: (on) => {
        setVideoMode(on);
        if (on) push("Video Mode on", "Fetching the official video for the active track with yt-dlp.");
      },
      video,
      videoStatus,
      videoError,
      linkVideoId,
      setLinkVideoId,
      activeVideoId,
      ambient,
      setAmbient,
      pipOpen,
      setPipOpen,
      registerPlayer,
    }),
    [videoMode, video, videoStatus, videoError, linkVideoId, activeVideoId, ambient, pipOpen, setVideoMode, setAmbient, registerPlayer, push],
  );
  return <PlayerUiContext.Provider value={value}>{children}</PlayerUiContext.Provider>;
}

export function usePlayerUi(): PlayerUiValue {
  const ctx = useContext(PlayerUiContext);
  if (!ctx) throw new Error("usePlayerUi must be used within a PlayerUiProvider");
  return ctx;
}