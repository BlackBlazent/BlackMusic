import { useRef, useState, type PointerEvent } from "react";
import { Link } from "react-router-dom";
import { usePersistentState } from "@/lib/usePersistentState";
import { usePlayback } from "@/app/context/PlaybackContext";
import { useFavorites } from "@/app/context/FavoritesContext";
import { formatDuration } from "@/lib/formatDuration";
import { Tooltip } from "@/app/components/Tooltip";
import {
  HeartIcon,
  NextIcon,
  PauseIcon,
  PlayIcon,
  PlaygroundIcon,
  PreviousIcon,
  RepeatIcon,
  ShuffleIcon,
  VolumeIcon,
} from "./icons";
import "./GlobalPlaybackBar.css";

export function GlobalPlaybackBar() {
  const {
    currentTrack,
    isPlaying,
    position,
    duration,
    volume,
    shuffle,
    repeatMode,
    togglePlay,
    next,
    previous,
    seek,
    setVolume,
    toggleShuffle,
    cycleRepeatMode,
    queue,
    currentIndex,
    playTrack,
  } = usePlayback();
  const { isFavorite, toggleFavorite } = useFavorites();

  // 2.1.0: hover the top edge to grab a resize handle; stretch the bar up to reveal "Up next".
  const MIN = 88;
  const MAX = 420;
  const [height, setHeight] = usePersistentState<number>("globalBar.height", MIN);
  const [resizing, setResizing] = useState(false);
  const drag = useRef<{ startY: number; startH: number } | null>(null);

  if (!currentTrack) return null;

  const onResizeDown = (e: PointerEvent) => {
    drag.current = { startY: e.clientY, startH: height };
    setResizing(true);
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };
  const onResizeMove = (e: PointerEvent) => {
    if (!drag.current) return;
    setHeight(Math.round(Math.min(MAX, Math.max(MIN, drag.current.startH + (drag.current.startY - e.clientY)))));
  };
  const onResizeUp = () => {
    drag.current = null;
    setResizing(false);
  };

  const upNext = queue.slice(currentIndex + 1, currentIndex + 40);
  const expanded = height > MIN + 24;

  const remaining = Math.max(0, duration - position);

  return (
    <div className="global-bar" data-expanded={expanded} data-resizing={resizing} style={{ height }}>
      <div
        className="global-bar__resize"
        onPointerDown={onResizeDown}
        onPointerMove={onResizeMove}
        onPointerUp={onResizeUp}
        onDoubleClick={() => setHeight(MIN)}
        title="Drag to resize — double-click to reset"
        role="separator"
        aria-orientation="horizontal"
        aria-label="Resize playback bar"
      />
      <div className="global-bar__main">
      <Link to="/playground" className="global-bar__track" title="Open Playground">
        <span className="global-bar__art">
          {currentTrack.artworkUrl ? <img src={currentTrack.artworkUrl} alt="" /> : <PlaygroundIcon />}
        </span>
        <span className="global-bar__meta">
          <span className="global-bar__title">{currentTrack.title}</span>
          <span className="global-bar__artist">{currentTrack.artist}</span>
        </span>
      </Link>

      <div className="global-bar__center">
        <div className="global-bar__transport">
          <Tooltip label="Shuffle" side="top">
            <button type="button" data-active={shuffle} onClick={toggleShuffle}>
              <ShuffleIcon />
            </button>
          </Tooltip>
          <Tooltip label="Previous" side="top">
            <button type="button" onClick={previous}>
              <PreviousIcon />
            </button>
          </Tooltip>
          <button type="button" className="global-bar__play" onClick={togglePlay}>
            {isPlaying ? <PauseIcon /> : <PlayIcon />}
          </button>
          <Tooltip label="Next" side="top">
            <button type="button" onClick={next}>
              <NextIcon />
            </button>
          </Tooltip>
          <Tooltip label={`Repeat: ${repeatMode}`} side="top">
            <button type="button" data-active={repeatMode !== "off"} onClick={cycleRepeatMode}>
              <RepeatIcon />
            </button>
          </Tooltip>
        </div>
        <div className="global-bar__seek">
          <span>{formatDuration(position)}</span>
          <input
            type="range"
            min={0}
            max={duration || 0}
            step={0.1}
            value={Math.min(position, duration || 0)}
            onChange={(e) => seek(Number(e.target.value))}
            aria-label="Seek"
          />
          <span>-{formatDuration(remaining)}</span>
        </div>
      </div>

      <div className="global-bar__right">
        <Tooltip label={isFavorite(currentTrack.id) ? "Unfavorite" : "Favorite"} side="top">
          <button type="button" data-active={isFavorite(currentTrack.id)} onClick={() => toggleFavorite(currentTrack.id)}>
            <HeartIcon />
          </button>
        </Tooltip>
        <VolumeIcon className="global-bar__volume-icon" />
        <input
          type="range"
          className="global-bar__volume"
          min={0}
          max={1}
          step={0.01}
          value={volume}
          onChange={(e) => setVolume(Number(e.target.value))}
          aria-label="Volume"
        />
      </div>
      </div>

      {expanded && (
        <div className="global-bar__queue" aria-label="Up next">
          <h3>Up next</h3>
          {upNext.length === 0 ? (
            <p>Nothing queued after this track.</p>
          ) : (
            upNext.map((track, i) => (
              <button key={`${track.id}-${i}`} type="button" className="global-bar__queue-item" onClick={() => playTrack(track, queue)}>
                <span className="global-bar__queue-art">{track.artworkUrl ? <img src={track.artworkUrl} alt="" loading="lazy" /> : <PlaygroundIcon />}</span>
                <span className="global-bar__queue-title">{track.title}</span>
                <span className="global-bar__queue-artist">{track.artist}</span>
                <span className="global-bar__queue-time">{formatDuration(track.duration)}</span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
