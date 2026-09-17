import { useState } from "react";
import { usePlayback } from "@/app/context/PlaybackContext";
import { useFavorites } from "@/app/context/FavoritesContext";
import { useLibrary } from "@/app/context/LibraryContext";
import { Tooltip } from "@/app/components/Tooltip";
import {
  CaptionsIcon,
  DownloadIcon,
  Forward15Icon,
  FullscreenIcon,
  HeartIcon,
  LinkIcon,
  NextIcon,
  PauseIcon,
  PlayIcon,
  PlaygroundIcon,
  PreviousIcon,
  QueueListIcon,
  RepeatIcon,
  Rewind10Icon,
  ScissorsIcon,
  SearchIcon,
  ShuffleIcon,
  StopIcon,
  VolumeIcon,
} from "@/app/layout/icons";
import { SeekBar } from "./SeekBar";
import { LyricsOverlay } from "./LyricsOverlay";
import { QueueStrip } from "./QueueStrip";
import { LinkDropperModal } from "./LinkDropperModal";
import type { Track } from "@/lib/types";
import "./Playground.css";

const SPEED_OPTIONS = [0.5, 0.75, 1, 1.25, 1.5, 2];

export function Playground() {
  const playback = usePlayback();
  const { isFavorite, toggleFavorite } = useFavorites();
  const { tracks: libraryTracks } = useLibrary();

  const [stageMode, setStageMode] = useState<"audio" | "video">("audio");
  const [lyricsOpen, setLyricsOpen] = useState(false);
  const [openPanel, setOpenPanel] = useState<"loop" | "speed" | "link" | "download" | null>(null);
  const [strripFilter, setStripFilter] = useState("");
  const [filterOpen, setFilterOpen] = useState(false);
  const [linkInput, setLinkInput] = useState("");
  const [openLink, setOpenLink] = useState<string | null>(null);

  const {
    queue,
    currentTrack,
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
    setVolume,
    toggleShuffle,
    cycleRepeatMode,
    setPlaybackRate,
    setLoopSection,
  } = playback;

  const stop = () => {
    if (currentTrack) seek(0);
    if (isPlaying) togglePlay();
  };

  const togglePanel = (panel: typeof openPanel) => setOpenPanel((p) => (p === panel ? null : panel));

  const onDropLink = () => {
    const trimmed = linkInput.trim();
    if (!trimmed) return;
    try {
      const url = new URL(trimmed);
      setOpenLink(url.toString());
      setLinkInput("");
      setOpenPanel(null);
    } catch {
      // Not a valid URL — ignore rather than throw at the user for a typo.
    }
  };

  // The strip always reflects the live library (updates as folders scan in),
  // not a frozen snapshot of whatever queue was playing when you arrived.
  const stripTracks = strripFilter.trim()
    ? libraryTracks.filter((t) => `${t.title} ${t.artist}`.toLowerCase().includes(strripFilter.trim().toLowerCase()))
    : libraryTracks;

  const onSelectFromStrip = (track: Track) => playTrack(track, queue.length > 1 ? queue : libraryTracks);

  const requestFullscreen = () => {
    document.querySelector(".playground__stage")?.requestFullscreen?.();
  };

  return (
    <div className="playground">
      <section className="playground__stage">
        <div className="playground__stage-mode">
          <button type="button" data-active={stageMode === "audio"} onClick={() => setStageMode("audio")}>
            Audio
          </button>
          <Tooltip label="Needs a YouTube API key in .env" side="top">
            <button
              type="button"
              data-active={stageMode === "video"}
              disabled
              onClick={() => setStageMode("video")}
            >
              Video
            </button>
          </Tooltip>
        </div>

        <div className="playground__stage-art">
          {currentTrack?.artworkUrl ? (
            <img src={currentTrack.artworkUrl} alt="" />
          ) : (
            <PlaygroundIcon className="playground__stage-placeholder" />
          )}
          {/* Only shown in Audio/photo mode — Video Mode relies on YouTube's own captions instead. */}
          {lyricsOpen && stageMode === "audio" && <LyricsOverlay />}
        </div>

        {currentTrack ? (
          <div className="playground__now-playing">
            <h1>{currentTrack.title}</h1>
            <p>
              {currentTrack.artist} · {currentTrack.album}
            </p>
          </div>
        ) : (
          <div className="playground__now-playing playground__now-playing--empty">
            <h1>Nothing playing</h1>
            <p>Pick something from the strip below, or from Local/Library/Home.</p>
          </div>
        )}
      </section>

      <SeekBar position={position} duration={duration} disabled={!currentTrack} onSeek={seek} />

      <section className="playground__transport">
        <Tooltip label="Shuffle" side="top">
          <button type="button" data-active={shuffle} onClick={toggleShuffle}>
            <ShuffleIcon />
          </button>
        </Tooltip>
        <Tooltip label="Previous" side="top">
          <button type="button" onClick={previous} disabled={!currentTrack}>
            <PreviousIcon />
          </button>
        </Tooltip>
        <Tooltip label="Back 10s" side="top">
          <button type="button" onClick={() => seek(Math.max(0, position - 10))} disabled={!currentTrack}>
            <Rewind10Icon />
          </button>
        </Tooltip>
        <button
          type="button"
          className="playground__play-btn"
          onClick={togglePlay}
          disabled={!currentTrack}
          aria-label={isPlaying ? "Pause" : "Play"}
        >
          {isPlaying ? <PauseIcon /> : <PlayIcon />}
        </button>
        <Tooltip label="Stop" side="top">
          <button type="button" onClick={stop} disabled={!currentTrack}>
            <StopIcon />
          </button>
        </Tooltip>
        <Tooltip label="Forward 15s" side="top">
          <button type="button" onClick={() => seek(position + 15)} disabled={!currentTrack}>
            <Forward15Icon />
          </button>
        </Tooltip>
        <Tooltip label="Next" side="top">
          <button type="button" onClick={next} disabled={!currentTrack}>
            <NextIcon />
          </button>
        </Tooltip>
        <Tooltip label={`Repeat: ${repeatMode}`} side="top">
          <button type="button" data-active={repeatMode !== "off"} onClick={cycleRepeatMode}>
            <RepeatIcon />
          </button>
        </Tooltip>

        <Tooltip label="Loop Creator" side="top">
          <button type="button" data-active={openPanel === "loop"} onClick={() => togglePanel("loop")}>
            <ScissorsIcon />
          </button>
        </Tooltip>
        <Tooltip label={currentTrack && isFavorite(currentTrack.id) ? "Unfavorite" : "Favorite"} side="top">
          <button
            type="button"
            data-active={currentTrack ? isFavorite(currentTrack.id) : false}
            disabled={!currentTrack}
            onClick={() => currentTrack && toggleFavorite(currentTrack.id)}
          >
            <HeartIcon />
          </button>
        </Tooltip>

        <div className="playground__volume">
          <VolumeIcon />
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={volume}
            onChange={(event) => setVolume(Number(event.target.value))}
            aria-label="Volume"
          />
        </div>

        <Tooltip label="Fullscreen" side="top">
          <button type="button" onClick={requestFullscreen}>
            <FullscreenIcon />
          </button>
        </Tooltip>
      </section>

      <section className="playground__secondary-row">
        <Tooltip label="Queue (always the live library, for now)" side="top">
          <button type="button" disabled>
            <QueueListIcon />
          </button>
        </Tooltip>
        <Tooltip label="Lyrics overlay" side="top">
          <button type="button" data-active={lyricsOpen} onClick={() => setLyricsOpen((v) => !v)}>
            <CaptionsIcon />
          </button>
        </Tooltip>
        <Tooltip label="Search the strip" side="top">
          <button type="button" data-active={filterOpen} onClick={() => setFilterOpen((v) => !v)}>
            <SearchIcon />
          </button>
        </Tooltip>
        <Tooltip label="Playback speed" side="top">
          <button type="button" data-active={openPanel === "speed"} onClick={() => togglePanel("speed")}>
            {playbackRate}×
          </button>
        </Tooltip>
        <Tooltip label="Drop a link" side="top">
          <button type="button" data-active={openPanel === "link"} onClick={() => togglePanel("link")}>
            <LinkIcon />
          </button>
        </Tooltip>
        <Tooltip label="Download" side="top">
          <button type="button" data-active={openPanel === "download"} onClick={() => togglePanel("download")}>
            <DownloadIcon />
          </button>
        </Tooltip>
      </section>

      {openPanel && (
        <div className="playground__panel-body">
          {openPanel === "loop" && (
            <div className="playground__loop-creator">
              <label>
                <input
                  type="checkbox"
                  checked={loopSection.enabled}
                  onChange={(event) => setLoopSection({ ...loopSection, enabled: event.target.checked })}
                />
                Enabled
              </label>
              <div className="playground__loop-row">
                <span>Start: {position.toFixed(1)}s</span>
                <button type="button" onClick={() => setLoopSection({ ...loopSection, start: position })} disabled={!currentTrack}>
                  Set to current
                </button>
              </div>
              <div className="playground__loop-row">
                <span>End: {loopSection.end.toFixed(1)}s</span>
                <button type="button" onClick={() => setLoopSection({ ...loopSection, end: position })} disabled={!currentTrack}>
                  Set to current
                </button>
              </div>
            </div>
          )}

          {openPanel === "speed" && (
            <div className="playground__speed">
              {SPEED_OPTIONS.map((speed) => (
                <button key={speed} type="button" data-active={playbackRate === speed} onClick={() => setPlaybackRate(speed)}>
                  {speed}×
                </button>
              ))}
            </div>
          )}

          {openPanel === "link" && (
            <div className="playground__link-input">
              <input
                type="text"
                placeholder="Paste a URL to embed…"
                value={linkInput}
                onChange={(event) => setLinkInput(event.target.value)}
                onKeyDown={(event) => event.key === "Enter" && onDropLink()}
                autoFocus
              />
              <button type="button" onClick={onDropLink}>
                Open
              </button>
            </div>
          )}

          {openPanel === "download" && (
            <p className="playground__panel-note">
              Not implemented — see <code>downloadService.ts</code> for why (YouTube ToS) and what's
              needed to add it.
            </p>
          )}
        </div>
      )}

      {filterOpen && (
        <input
          type="text"
          className="playground__strip-filter"
          placeholder="Filter the strip below…"
          value={strripFilter}
          onChange={(event) => setStripFilter(event.target.value)}
          autoFocus
        />
      )}

      <QueueStrip tracks={stripTracks} currentTrackId={currentTrack?.id} onSelect={onSelectFromStrip} />

      {openLink && <LinkDropperModal url={openLink} onClose={() => setOpenLink(null)} />}
    </div>
  );
}
