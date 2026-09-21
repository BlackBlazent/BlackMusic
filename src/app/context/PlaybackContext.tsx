import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { LoopSection, RepeatMode, Track } from "@/lib/types";
import { usePlaybackHistory } from "./PlaybackHistoryContext";
import { useActionHistory } from "./ActionHistoryContext";
import { useNotifications } from "./NotificationsContext";
import { createLocalBlobUrl } from "@/lib/library/localAudioSource";
import {
  ensureSpotifyPlayer,
  isSpotifyTrackId,
  spotifyPause,
  spotifyPlayUri,
  spotifyResume,
  spotifySeek,
  spotifySetVolume,
  type SpotifyPlaybackState,
} from "@/lib/services/spotifyPlayerBridge";

interface PlaybackContextValue {
  queue: Track[];
  currentTrack: Track | null;
  currentIndex: number;
  isPlaying: boolean;
  position: number;
  duration: number;
  volume: number;
  shuffle: boolean;
  repeatMode: RepeatMode;
  playbackRate: number;
  loopSection: LoopSection;
  /** Plays `track` immediately. If `queue` is given, replaces the play queue with it. */
  playTrack: (track: Track, queue?: Track[]) => void;
  togglePlay: () => void;
  next: () => void;
  previous: () => void;
  seek: (seconds: number) => void;
  setVolume: (volume: number) => void;
  toggleShuffle: () => void;
  cycleRepeatMode: () => void;
  setPlaybackRate: (rate: number) => void;
  setLoopSection: (section: LoopSection) => void;
}

const PlaybackContext = createContext<PlaybackContextValue | null>(null);

const DEFAULT_LOOP_SECTION: LoopSection = { enabled: false, start: 0, end: 0 };

export function PlaybackProvider({ children }: { children: ReactNode }) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  if (!audioRef.current && typeof window !== "undefined") {
    audioRef.current = new Audio();
  }

  const { recordPlay } = usePlaybackHistory();
  const { pushAction } = useActionHistory();
  const { push: pushNotification } = useNotifications();

  const [queue, setQueue] = useState<Track[]>([]);
  const [currentIndex, setCurrentIndex] = useState(-1);
  const [isPlaying, setIsPlaying] = useState(false);
  const [position, setPosition] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolumeState] = useState(0.8);
  const [shuffle, setShuffle] = useState(false);
  const [repeatMode, setRepeatMode] = useState<RepeatMode>("off");
  const [playbackRate, setPlaybackRateState] = useState(1);
  const [loopSection, setLoopSectionState] = useState<LoopSection>(DEFAULT_LOOP_SECTION);

  // Kept alongside their state counterparts so callbacks that are only ever
  // (re)created once — the <audio> listeners, the Spotify state-change handler —
  // can still read the current value instead of a stale closed-over one.
  const loopSectionRef = useRef(loopSection);
  loopSectionRef.current = loopSection;
  const volumeRef = useRef(volume);
  volumeRef.current = volume;

  const currentTrack = currentIndex >= 0 ? queue[currentIndex] ?? null : null;
  const currentTrackRef = useRef<Track | null>(currentTrack);
  currentTrackRef.current = currentTrack;

  // Tracks the blob: URL currently assigned to the <audio> element (local
  // files only — see loadTrackAt) so it can be revoked on the next track
  // change or unmount instead of leaking memory.
  const currentBlobUrlRef = useRef<string | null>(null);
  // Guards against a slow blob read finishing after the user has already
  // moved on to a different track (e.g. rapid skips) and clobbering it.
  const loadRequestIdRef = useRef(0);

  // --- Spotify bridge ----------------------------------------------------------
  //
  // Spotify's streams are DRM-protected and can only play through their own Web
  // Playback SDK, not a plain <audio src>. Rather than pop open some separate
  // "Spotify window", the SDK player is just a second engine feeding the exact
  // same position/duration/isPlaying state as the <audio> element — every page
  // that reads usePlayback() (the global bar, Playground) works the same either
  // way, without knowing which engine is actually behind it.

  const handleSpotifyState = useCallback((state: SpotifyPlaybackState | null) => {
    const track = currentTrackRef.current;
    if (!track || !isSpotifyTrackId(track.id) || !state) return;
    setPosition(state.positionMs / 1000);
    setDuration(state.durationMs / 1000);
    setIsPlaying(!state.paused);
  }, []);

  // --- transport ---------------------------------------------------------------
  //
  // Every one of these takes the queue it should act on as an explicit argument
  // rather than reading `queue` off React state. That matters specifically in
  // `playTrack`: it calls `setQueue(effectiveQueue)` and then needs to load a
  // track from *that* queue in the same call — but `setQueue` doesn't take
  // effect until the next render, so anything reading the `queue` *state*
  // synchronously afterwards (in the same tick) would still see the previous
  // queue. That was a real bug here before: switching from one queue (e.g. an
  // Audius track played from Online) to a track in a different queue (e.g.
  // Local) loaded the wrong `<audio>` source — metadata displayed correctly
  // because it just reflects `queue[currentIndex]` from state, but the actual
  // audio element kept playing/showing the previous queue's track, which is
  // exactly the "duration and seek stuck on the previous track" symptom.

  const loadTrackAt = useCallback(
    (targetQueue: Track[], index: number, autoplay: boolean) => {
      const track = targetQueue[index];
      const audio = audioRef.current;
      if (!track) return;

      const requestId = ++loadRequestIdRef.current;
      setCurrentIndex(index);
      // Reset immediately so the UI doesn't show the previous track's
      // duration/position for the moment before the new source loads.
      setDuration(0);
      setPosition(0);

      if (isSpotifyTrackId(track.id)) {
        audio?.pause(); // make sure the local element isn't also making sound
        if (audio?.src) {
          audio.removeAttribute("src");
          audio.load();
        }
        if (autoplay) {
          recordPlay(track.id);
          void ensureSpotifyPlayer(handleSpotifyState).then(async () => {
            await spotifySetVolume(volumeRef.current);
            await spotifyPlayUri(track.id);
          });
        }
        return;
      }

      void spotifyPause(); // make sure a previous Spotify track isn't still playing underneath
      if (!audio) return;

      const assignAndMaybePlay = (src: string) => {
        if (loadRequestIdRef.current !== requestId) return; // superseded by a newer load
        audio.src = src;
        if (autoplay) {
          void audio.play().catch((err) => {
            pushNotification("Couldn't play track", `${track.title}: ${err instanceof Error ? err.message : String(err)}`);
          });
          recordPlay(track.id);
        }
      };

      // Local files: read through the same fs call scanning already proves
      // works, and hand the <audio> element a plain blob: URL — see
      // localAudioSource.ts for why this is preferred over the asset:// URL.
      // Anything else (Audius, or any future remote source) already has a
      // normal http(s) stream URL that <audio> can use directly.
      if (track.path) {
        if (currentBlobUrlRef.current) {
          URL.revokeObjectURL(currentBlobUrlRef.current);
          currentBlobUrlRef.current = null;
        }
        createLocalBlobUrl(track.path)
          .then((blobUrl) => {
            if (loadRequestIdRef.current !== requestId) {
              URL.revokeObjectURL(blobUrl); // superseded before it even loaded
              return;
            }
            currentBlobUrlRef.current = blobUrl;
            assignAndMaybePlay(blobUrl);
          })
          .catch((err) => {
            if (loadRequestIdRef.current !== requestId) return;
            pushNotification(
              "Couldn't read file",
              `${track.title}: ${err instanceof Error ? err.message : String(err)}`,
            );
          });
        return;
      }

      assignAndMaybePlay(track.sourceUrl);
    },
    [recordPlay, handleSpotifyState, pushNotification],
  );

  const resolveNextIndex = useCallback(
    (targetQueue: Track[], direction: 1 | -1): number => {
      if (targetQueue.length === 0) return -1;
      if (shuffle) {
        if (targetQueue.length === 1) return 0;
        let candidate = currentIndex;
        while (candidate === currentIndex) candidate = Math.floor(Math.random() * targetQueue.length);
        return candidate;
      }
      const next = currentIndex + direction;
      if (next < 0) return repeatMode === "queue" ? targetQueue.length - 1 : 0;
      if (next >= targetQueue.length) return repeatMode === "queue" ? 0 : targetQueue.length - 1;
      return next;
    },
    [currentIndex, shuffle, repeatMode],
  );

  const advanceRef = useRef<(cause: "auto" | "manual") => void>(() => {});
  advanceRef.current = (cause: "auto" | "manual") => {
    const audio = audioRef.current;
    if (!audio) return;
    if (cause === "auto" && repeatMode === "track") {
      audio.currentTime = 0;
      void audio.play();
      return;
    }
    const nextIndex = resolveNextIndex(queue, 1);
    if (nextIndex === -1) return;
    if (cause === "auto" && repeatMode === "off" && nextIndex <= currentIndex) {
      setIsPlaying(false);
      return; // reached the end of the queue with nothing to repeat into
    }
    loadTrackAt(queue, nextIndex, true);
  };

  // --- <audio> element wiring ---------------------------------------------------
  // Only ever fires for local/Audius tracks — Spotify tracks never touch this
  // element, so its "ended" event can't auto-advance a Spotify track (Spotify
  // just stops after the one URI it was given finishes; see PlaybackContext's
  // notes in DEVELOPMENT.md for what a full Spotify queue integration needs).

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const onTimeUpdate = () => {
      setPosition(audio.currentTime);
      const loop = loopSectionRef.current;
      if (loop.enabled && audio.currentTime >= loop.end) {
        audio.currentTime = loop.start;
      }
    };
    // Some files (particularly certain MP3 encodes without an accurate VBR
    // header) report `duration` as NaN/Infinity right when `loadedmetadata`
    // fires, with the real value only arriving later via `durationchange` —
    // without this listener those tracks would show a stuck 0:00 forever.
    const onDurationChange = () => {
      setDuration(Number.isFinite(audio.duration) ? audio.duration : 0);
    };
    const onEnded = () => advanceRef.current("auto");
    const onPlay = () => setIsPlaying(true);
    const onPause = () => setIsPlaying(false);
    const onError = () => {
      const track = currentTrackRef.current;
      setIsPlaying(false);
      // A failed load previously left the UI silently stuck showing "playing"
      // with no sound and no duration — surfacing it, even generically, beats
      // pretending nothing happened.
      pushNotification(
        "Playback error",
        track ? `Couldn't play "${track.title}" (code ${audio.error?.code ?? "unknown"}).` : "Couldn't play the current track.",
      );
    };

    audio.addEventListener("timeupdate", onTimeUpdate);
    audio.addEventListener("loadedmetadata", onDurationChange);
    audio.addEventListener("durationchange", onDurationChange);
    audio.addEventListener("ended", onEnded);
    audio.addEventListener("play", onPlay);
    audio.addEventListener("pause", onPause);
    audio.addEventListener("error", onError);

    return () => {
      audio.removeEventListener("timeupdate", onTimeUpdate);
      audio.removeEventListener("loadedmetadata", onDurationChange);
      audio.removeEventListener("durationchange", onDurationChange);
      audio.removeEventListener("ended", onEnded);
      audio.removeEventListener("play", onPlay);
      audio.removeEventListener("pause", onPause);
      audio.removeEventListener("error", onError);
      if (currentBlobUrlRef.current) URL.revokeObjectURL(currentBlobUrlRef.current);
    };
    // Bound once — loop section and advance logic are read from refs above,
    // so this never needs to tear down and re-bind the <audio> listeners.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = volume;
    if (currentTrackRef.current && isSpotifyTrackId(currentTrackRef.current.id)) {
      void spotifySetVolume(volume);
    }
  }, [volume]);

  useEffect(() => {
    if (audioRef.current) audioRef.current.playbackRate = playbackRate;
    // Spotify's SDK doesn't expose a playback-rate control at all — speed
    // changes only apply to local/Audius tracks playing through <audio>.
  }, [playbackRate]);

  const playTrack = useCallback(
    (track: Track, newQueue?: Track[]) => {
      const effectiveQueue = newQueue ?? [track];
      const index = effectiveQueue.findIndex((t) => t.id === track.id);
      const resolvedIndex = index === -1 ? 0 : index;
      const previousIndex = currentIndex;
      const previousQueue = queue;

      setQueue(effectiveQueue);
      loadTrackAt(effectiveQueue, resolvedIndex, true);

      pushAction({
        label: `Play "${track.title}"`,
        do: () => {
          setQueue(effectiveQueue);
          loadTrackAt(effectiveQueue, resolvedIndex, true);
        },
        undo: () => {
          setQueue(previousQueue);
          if (previousIndex >= 0) loadTrackAt(previousQueue, previousIndex, true);
          else setIsPlaying(false);
        },
      });
    },
    [currentIndex, queue, loadTrackAt, pushAction],
  );

  const togglePlay = useCallback(() => {
    const track = currentTrackRef.current;
    if (!track) return;
    if (isSpotifyTrackId(track.id)) {
      if (isPlaying) void spotifyPause();
      else void spotifyResume();
      return;
    }
    const audio = audioRef.current;
    if (!audio) return;
    if (audio.paused) void audio.play();
    else audio.pause();
  }, [isPlaying]);

  const next = useCallback(() => {
    const previousIndex = currentIndex;
    const nextIndex = resolveNextIndex(queue, 1);
    if (nextIndex === -1) return;
    loadTrackAt(queue, nextIndex, true);
    pushAction({
      label: "Skip next",
      do: () => loadTrackAt(queue, nextIndex, true),
      undo: () => loadTrackAt(queue, previousIndex, true),
    });
  }, [currentIndex, queue, resolveNextIndex, loadTrackAt, pushAction]);

  const previous = useCallback(() => {
    const track = currentTrackRef.current;
    const audio = audioRef.current;
    // Standard player behavior: restart the current track if we're more than
    // 3s in, otherwise actually go to the previous track. Spotify tracks use
    // the position state we're already syncing from the SDK for this check.
    const currentSeconds = track && isSpotifyTrackId(track.id) ? position : audio?.currentTime ?? 0;
    if (currentSeconds > 3) {
      seek(0);
      return;
    }
    const previousIndex = currentIndex;
    const targetIndex = resolveNextIndex(queue, -1);
    if (targetIndex === -1) return;
    loadTrackAt(queue, targetIndex, true);
    pushAction({
      label: "Skip previous",
      do: () => loadTrackAt(queue, targetIndex, true),
      undo: () => loadTrackAt(queue, previousIndex, true),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `seek` is stable (defined below with []); avoiding a hoist reorder
  }, [currentIndex, queue, position, resolveNextIndex, loadTrackAt, pushAction]);

  const seek = useCallback((seconds: number) => {
    const track = currentTrackRef.current;
    if (track && isSpotifyTrackId(track.id)) {
      void spotifySeek(seconds * 1000);
      setPosition(seconds);
      return;
    }
    const audio = audioRef.current;
    if (!audio) return;
    audio.currentTime = seconds;
    setPosition(seconds);
  }, []);

  const value = useMemo<PlaybackContextValue>(
    () => ({
      queue,
      currentTrack,
      currentIndex,
      isPlaying,
      position,
      duration,
      volume,
      shuffle,
      repeatMode,
      playbackRate,
      loopSection,
      playTrack,
      togglePlay,
      next,
      previous,
      seek,
      setVolume: setVolumeState,
      toggleShuffle: () => setShuffle((s) => !s),
      cycleRepeatMode: () =>
        setRepeatMode((mode) => (mode === "off" ? "queue" : mode === "queue" ? "track" : "off")),
      setPlaybackRate: setPlaybackRateState,
      setLoopSection: setLoopSectionState,
    }),
    [
      queue,
      currentTrack,
      currentIndex,
      isPlaying,
      position,
      duration,
      volume,
      shuffle,
      repeatMode,
      playbackRate,
      loopSection,
      playTrack,
      togglePlay,
      next,
      previous,
      seek,
    ],
  );

  return <PlaybackContext.Provider value={value}>{children}</PlaybackContext.Provider>;
}

export function usePlayback(): PlaybackContextValue {
  const ctx = useContext(PlaybackContext);
  if (!ctx) throw new Error("usePlayback must be used within a PlaybackProvider");
  return ctx;
}
