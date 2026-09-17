import { Link } from "react-router-dom";
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
  } = usePlayback();
  const { isFavorite, toggleFavorite } = useFavorites();

  if (!currentTrack) return null;

  const remaining = Math.max(0, duration - position);

  return (
    <div className="global-bar">
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
  );
}
