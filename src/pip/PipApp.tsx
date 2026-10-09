import { useCallback, useEffect, useRef, useState, type PointerEvent } from "react";
import { emit, listen } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";
import type { RepeatMode } from "@/lib/types";
import {
  PIP_EVENTS,
  closePipWindow,
  nextRepeatMode,
  pipThemeFromUrl,
  type PipCommand,
  type PipPlacement,
  type PipState,
} from "@/lib/pip/pipBridge";
import { formatDuration } from "@/lib/formatDuration";
import { CloseIcon, ExpandIcon, NextIcon, PauseIcon, PlayIcon, PlaygroundIcon, PreviousIcon, StopIcon } from "@/app/layout/icons";
import { Back10Icon, Forward10Icon, RepeatModeIcon } from "./pipIcons";
import "./PipApp.css";

const SKIP_SECONDS = 10;
const OPTIMISTIC_TIMEOUT_MS = 1500;
const REPEAT_LABEL: Record<RepeatMode, string> = { off: "Repeat off", queue: "Repeat all", track: "Repeat one" };

const send = (command: PipCommand) => void emit(PIP_EVENTS.command, command);

/**
 * "Optimistic" UI: the moment you press a button the mini player shows the result (icon swap, new position,
 * repeat mode). The main window confirms with the next snapshot; if it never does, the optimistic value
 * expires after 1.5s and the real state wins. That's what makes the controls feel instant.
 */
interface Optimistic {
  isPlaying?: boolean;
  repeatMode?: RepeatMode;
  position?: number;
  positionAt?: number;
}

function prune(opt: Optimistic, snap: PipState): Optimistic | null {
  const out = { ...opt };
  if (out.isPlaying !== undefined && snap.isPlaying === out.isPlaying) delete out.isPlaying;
  if (out.repeatMode !== undefined && snap.repeatMode === out.repeatMode) delete out.repeatMode;
  if (out.position !== undefined && out.positionAt !== undefined) {
    const now = Date.now();
    const playing = opt.isPlaying ?? snap.isPlaying;
    const optNow = out.position + (playing ? ((now - out.positionAt) / 1000) * snap.rate : 0);
    const snapNow = snap.position + (snap.isPlaying ? ((now - snap.at) / 1000) * snap.rate : 0);
    if (Math.abs(optNow - snapNow) < 1.5) {
      delete out.position;
      delete out.positionAt;
    }
  }
  return Object.keys(out).length > 0 ? out : null;
}

export function PipApp() {
  const [state, setState] = useState<PipState | null>(null);
  const [opt, setOpt] = useState<Optimistic | null>(null);
  const [now, setNow] = useState(Date.now());
  const [flash, setFlash] = useState<{ id: number; text: string } | null>(null);
  const [scrub, setScrub] = useState<number | null>(null); // 0..1 while dragging the progress bar
  const [hover, setHover] = useState<{ x: number; ratio: number } | null>(null);
  const optTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const flashTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const stateRef = useRef<PipState | null>(null);
  const progressRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", pipThemeFromUrl());
  }, []);

  // Snapshots from the main window; then tell it we're ready for the first full one.
  useEffect(() => {
    const unlisten = listen<PipState>(PIP_EVENTS.state, ({ payload }) => {
      const next: PipState = { ...payload, artwork: payload.artwork === undefined ? stateRef.current?.artwork ?? null : payload.artwork };
      stateRef.current = next;
      setState(next);
      setOpt((o) => (o ? prune(o, next) : o)); // drop optimistic values the main window has now confirmed
    });
    void unlisten.then(() => emit(PIP_EVENTS.ready, null));
    return () => void unlisten.then((fn) => fn());
  }, []);

  // Remember where the user put/sized the window (logical px) so it reopens there.
  useEffect(() => {
    const win = getCurrentWindow();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const report = () => {
      clearTimeout(timer);
      timer = setTimeout(async () => {
        const [pos, size, scale] = await Promise.all([win.outerPosition(), win.innerSize(), win.scaleFactor()]);
        const placement: PipPlacement = {
          x: Math.round(pos.x / scale),
          y: Math.round(pos.y / scale),
          width: Math.round(size.width / scale),
          height: Math.round(size.height / scale),
        };
        void emit(PIP_EVENTS.moved, placement);
      }, 400);
    };
    const offMoved = win.onMoved(report);
    const offResized = win.onResized(report);
    return () => {
      clearTimeout(timer);
      void offMoved.then((fn) => fn());
      void offResized.then((fn) => fn());
    };
  }, []);

  // --- derived, optimistic-aware display values ---
  const hasTrack = Boolean(state?.hasTrack);
  const isPlaying = opt?.isPlaying ?? state?.isPlaying ?? false;
  const repeatMode = opt?.repeatMode ?? state?.repeatMode ?? "off";
  const duration = state?.duration ?? 0;
  const rate = state?.rate ?? 1;

  useEffect(() => {
    if (!isPlaying) return;
    const id = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(id);
  }, [isPlaying]);

  const base =
    opt?.position !== undefined && opt.positionAt !== undefined
      ? { position: opt.position, at: opt.positionAt }
      : { position: state?.position ?? 0, at: state?.at ?? now };
  const livePosition = Math.min(duration || Infinity, Math.max(0, base.position + (isPlaying ? ((now - base.at) / 1000) * rate : 0)));
  const position = scrub !== null ? scrub * duration : livePosition;
  const progress = duration > 0 ? Math.min(1, position / duration) : 0;

  // --- actions ---
  const showFlash = useCallback((text: string) => {
    clearTimeout(flashTimer.current);
    setFlash({ id: Date.now(), text });
    flashTimer.current = setTimeout(() => setFlash(null), 1000);
  }, []);

  const applyOptimistic = useCallback((patch: Optimistic) => {
    setOpt((o) => ({ ...o, ...patch }));
    clearTimeout(optTimer.current);
    optTimer.current = setTimeout(() => setOpt(null), OPTIMISTIC_TIMEOUT_MS);
  }, []);

  const actions = {
    toggle: () => {
      if (!hasTrack) return;
      const next = !isPlaying;
      send({ action: "toggle" });
      applyOptimistic({ isPlaying: next });
      showFlash(next ? "Playing" : "Paused");
    },
    previous: () => {
      if (!hasTrack) return;
      send({ action: "previous" });
      showFlash("Previous");
    },
    next: () => {
      if (!hasTrack) return;
      send({ action: "next" });
      showFlash("Next");
    },
    skip: (delta: number) => {
      if (!hasTrack) return;
      const target = Math.min(duration || Infinity, Math.max(0, livePosition + delta));
      send({ action: "skip", seconds: delta });
      applyOptimistic({ position: target, positionAt: Date.now() });
      showFlash(delta < 0 ? `− ${SKIP_SECONDS}s` : `+ ${SKIP_SECONDS}s`);
    },
    stop: () => {
      if (!hasTrack) return;
      send({ action: "stop" });
      applyOptimistic({ isPlaying: false, position: 0, positionAt: Date.now() });
      showFlash("Stopped");
    },
    repeat: () => {
      if (!hasTrack) return;
      const next = nextRepeatMode(repeatMode);
      send({ action: "repeat" });
      applyOptimistic({ repeatMode: next });
      showFlash(REPEAT_LABEL[next]);
    },
    seekTo: (ratio: number) => {
      if (!hasTrack || duration <= 0) return;
      const seconds = ratio * duration;
      send({ action: "seek", seconds });
      applyOptimistic({ position: seconds, positionAt: Date.now() });
      showFlash(formatDuration(seconds));
    },
  };
  const actionsRef = useRef(actions);
  actionsRef.current = actions;

  // Keyboard: Space play/pause · ←/→ ∓10s · P/N previous/next · R repeat · S stop
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      const a = actionsRef.current;
      switch (event.key) {
        case " ":
          event.preventDefault();
          a.toggle();
          break;
        case "ArrowLeft":
          event.preventDefault();
          a.skip(-SKIP_SECONDS);
          break;
        case "ArrowRight":
          event.preventDefault();
          a.skip(SKIP_SECONDS);
          break;
        case "p":
        case "P":
          a.previous();
          break;
        case "n":
        case "N":
          a.next();
          break;
        case "r":
        case "R":
          a.repeat();
          break;
        case "s":
        case "S":
          a.stop();
          break;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // --- progress bar: click, drag-to-scrub, hover preview ---
  const ratioAt = (event: PointerEvent<HTMLDivElement>) => {
    const rect = progressRef.current?.getBoundingClientRect();
    if (!rect || rect.width === 0) return 0;
    return Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width));
  };
  const onProgressDown = (event: PointerEvent<HTMLDivElement>) => {
    if (!hasTrack || duration <= 0) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    setScrub(ratioAt(event));
  };
  const onProgressMove = (event: PointerEvent<HTMLDivElement>) => {
    const ratio = ratioAt(event);
    setHover({ x: ratio * 100, ratio });
    if (scrub !== null) setScrub(ratio);
  };
  const onProgressUp = (event: PointerEvent<HTMLDivElement>) => {
    if (scrub === null) return;
    const ratio = ratioAt(event);
    setScrub(null);
    actions.seekTo(ratio);
  };

  const pending = opt?.isPlaying !== undefined;

  return (
    <div className="pip-app" data-playing={isPlaying} data-has-track={hasTrack}>
      {/* data-tauri-drag-region: drag the window by this strip */}
      <header className="pip-app__header" data-tauri-drag-region>
        <span className="pip-eq" aria-hidden="true" data-tauri-drag-region>
          <i />
          <i />
          <i />
        </span>
        <span className="pip-app__brand" data-tauri-drag-region>
          {hasTrack ? (isPlaying ? "Now playing" : "Paused") : "BlackMusic"}
        </span>
        <button type="button" onClick={() => send({ action: "showMain" })} aria-label="Open BlackMusic" title="Open BlackMusic">
          <ExpandIcon />
        </button>
        <button type="button" className="pip-app__close" onClick={() => void closePipWindow()} aria-label="Close mini player" title="Close mini player">
          <CloseIcon />
        </button>
      </header>

      <div className="pip-app__main">
        <div className="pip-app__stage" data-tauri-drag-region>
          {state?.videoId ? (
            <PipVideo videoId={state.videoId} isPlaying={isPlaying} position={livePosition} snapshotAt={state.at} />
          ) : state?.artwork ? (
            <img src={state.artwork} alt="" draggable={false} />
          ) : (
            <PlaygroundIcon className="pip-app__placeholder" />
          )}
          {flash && (
            <div className="pip-app__flash" key={flash.id} role="status" aria-live="polite">
              {flash.text}
            </div>
          )}
        </div>

        <div className="pip-app__body">
          <div className="pip-app__meta" data-tauri-drag-region>
            <strong data-tauri-drag-region title={state?.title}>
              {hasTrack ? state?.title : "Nothing playing"}
            </strong>
            <span data-tauri-drag-region>{hasTrack ? state?.artist : "Pick a song in BlackMusic"}</span>
          </div>

          <div className="pip-app__timeline">
            <div
              ref={progressRef}
              className="pip-app__progress"
              data-scrubbing={scrub !== null}
              data-disabled={!hasTrack || duration <= 0}
              onPointerDown={onProgressDown}
              onPointerMove={onProgressMove}
              onPointerUp={onProgressUp}
              onPointerLeave={() => setHover(null)}
              role="slider"
              aria-label="Seek"
              aria-valuemin={0}
              aria-valuemax={Math.round(duration)}
              aria-valuenow={Math.round(position)}
            >
              <div className="pip-app__progress-fill" style={{ width: `${progress * 100}%` }} />
              <div className="pip-app__progress-thumb" style={{ left: `${progress * 100}%` }} />
              {hover && duration > 0 && (
                <span className="pip-app__hover-time" style={{ left: `${hover.x}%` }}>
                  {formatDuration(hover.ratio * duration)}
                </span>
              )}
            </div>
            <div className="pip-app__times">
              <span>{formatDuration(position)}</span>
              <span>{formatDuration(duration)}</span>
            </div>
          </div>

          <div className="pip-app__controls" role="group" aria-label="Playback controls">
            <button type="button" className="pip-btn" onClick={() => actions.previous()} disabled={!hasTrack} aria-label="Previous" title="Previous (P)">
              <PreviousIcon />
            </button>
            <button type="button" className="pip-btn" onClick={() => actions.skip(-SKIP_SECONDS)} disabled={!hasTrack} aria-label="Back 10 seconds" title="Back 10s (←)">
              <Back10Icon />
            </button>
            <button
              type="button"
              className="pip-btn pip-btn--primary"
              data-pending={pending}
              onClick={() => actions.toggle()}
              disabled={!hasTrack}
              aria-label={isPlaying ? "Pause" : "Play"}
              title={isPlaying ? "Pause (Space)" : "Play (Space)"}
            >
              {/* Both icons stay mounted; CSS cross-fades them so the swap is instant AND smooth. */}
              <span className="pip-btn__swap" data-playing={isPlaying}>
                <PlayIcon className="pip-btn__play" />
                <PauseIcon className="pip-btn__pause" />
              </span>
            </button>
            <button type="button" className="pip-btn" onClick={() => actions.skip(SKIP_SECONDS)} disabled={!hasTrack} aria-label="Forward 10 seconds" title="Forward 10s (→)">
              <Forward10Icon />
            </button>
            <button type="button" className="pip-btn" onClick={() => actions.next()} disabled={!hasTrack} aria-label="Next" title="Next (N)">
              <NextIcon />
            </button>
            <button type="button" className="pip-btn" onClick={() => actions.stop()} disabled={!hasTrack} aria-label="Stop" title="Stop (S)">
              <StopIcon />
            </button>
            <button
              type="button"
              className="pip-btn"
              data-active={repeatMode !== "off"}
              onClick={() => actions.repeat()}
              disabled={!hasTrack}
              aria-label={REPEAT_LABEL[repeatMode]}
              title={`${REPEAT_LABEL[repeatMode]} (R)`}
            >
              <RepeatModeIcon mode={repeatMode} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * The video, muted and visual-only: sound always comes from the main window. Kept in step with the main
 * window's clock via the YouTube iframe API's postMessage channel (no script needed).
 */
function PipVideo({ videoId, isPlaying, position, snapshotAt }: { videoId: string; isPlaying: boolean; position: number; snapshotAt: number }) {
  const ref = useRef<HTMLIFrameElement>(null);
  const videoTime = useRef<number | null>(null);
  const loaded = useRef(false);
  const latest = useRef({ position, isPlaying });
  latest.current = { position, isPlaying };

  const post = (func: string, args: unknown[] = []) =>
    ref.current?.contentWindow?.postMessage(JSON.stringify({ event: "command", func, args }), "*");

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (event.source !== ref.current?.contentWindow || typeof event.data !== "string") return;
      try {
        const data = JSON.parse(event.data) as { event?: string; info?: { currentTime?: number } };
        if (data.event === "infoDelivery" && typeof data.info?.currentTime === "number") videoTime.current = data.info.currentTime;
      } catch {
        /* not a player message */
      }
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  const onLoad = () => {
    loaded.current = false;
    videoTime.current = null;
    ref.current?.contentWindow?.postMessage(JSON.stringify({ event: "listening", id: 1, channel: "widget" }), "*");
    window.setTimeout(() => {
      loaded.current = true;
      post("mute");
      post("seekTo", [latest.current.position, true]);
      post(latest.current.isPlaying ? "playVideo" : "pauseVideo");
    }, 1500);
  };

  useEffect(() => {
    if (loaded.current) post(isPlaying ? "playVideo" : "pauseVideo");
  }, [isPlaying]);

  // Every snapshot (change / seek / 2s heartbeat): correct drift bigger than 2s.
  useEffect(() => {
    if (!loaded.current || videoTime.current === null) return;
    if (Math.abs(videoTime.current - latest.current.position) > 2) post("seekTo", [latest.current.position, true]);
  }, [snapshotAt]); // eslint-disable-line react-hooks/exhaustive-deps

  const params = new URLSearchParams({ enablejsapi: "1", autoplay: "1", mute: "1", rel: "0", modestbranding: "1", playsinline: "1", controls: "0", origin: window.location.origin });
  return (
    <iframe
      ref={ref}
      key={videoId}
      className="pip-app__video"
      src={`https://www.youtube-nocookie.com/embed/${encodeURIComponent(videoId)}?${params}`}
      title="Video"
      allow="autoplay; encrypted-media"
      onLoad={onLoad}
    />
  );
}