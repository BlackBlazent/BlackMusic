import { useEffect, useMemo, useRef, useState } from "react";
import { usePlayback } from "@/app/context/PlaybackContext";
import { useFavorites } from "@/app/context/FavoritesContext";
import { useLibrary } from "@/app/context/LibraryContext";
import { usePlaylists } from "@/app/context/PlaylistsContext";
import { usePlayerUi } from "@/app/context/PlayerUiContext";
import { useNotifications } from "@/app/context/NotificationsContext";
import { usePersistentState } from "@/lib/usePersistentState";
import { downloadVideo, parseYouTubeId } from "@/lib/video/ytdlp";
import { Tooltip } from "@/app/components/Tooltip";
import { VideoFrame } from "@/app/components/VideoFrame";
import { EditMetadataModal } from "@/app/components/EditMetadataModal";
import { useStripLayout } from "@/app/components/useStripLayout";
import {
  AmbientIcon,
  CaptionsIcon,
  DownloadIcon,
  ExitFullscreenIcon,
  Forward15Icon,
  FullscreenIcon,
  HeartIcon,
  LinkIcon,
  NextIcon,
  PauseIcon,
  PipIcon,
  PlayIcon,
  PlaygroundIcon,
  PreviousIcon,
  QueueListIcon,
  RepeatIcon,
  Rewind10Icon,
  ScissorsIcon,
  SearchIcon,
  ShuffleIcon,
  SleepIcon,
  StopIcon,
  VolumeIcon,
} from "@/app/layout/icons";
import { SeekBar } from "./SeekBar";
import { LyricsOverlay } from "@/app/features/lyrics/components/LyricsOverlay";
import { LyricsSettings } from "@/app/features/lyrics/components/LyricsSettings";
import { QueueStrip, type PlaylistFolder } from "./QueueStrip";
import { LinkDropperModal } from "./LinkDropperModal";
import type { Track } from "@/lib/types";
import "./Playground.css";

const SPEED_OPTIONS = [0.5, 0.75, 1, 1.25, 1.5, 2];
const SLEEP_OPTIONS = [10, 15, 20, 30, 45, 60];
const CROPS = [
  { id: "fit", label: "Fit to screen" },
  { id: "1x1", label: "1×1" },
  { id: "4x3", label: "4×3" },
  { id: "16x9", label: "16×9" },
] as const;
type CropId = (typeof CROPS)[number]["id"];
type Panel = "loop" | "speed" | "link" | "download" | "sleep" | "lyrics-style" | null;

const STRIP_RENDER_LIMIT = 500;

export function Playground() {
  const playback = usePlayback();
  const { isFavorite, toggleFavorite } = useFavorites();
  const { tracks: libraryTracks } = useLibrary();
  const { playlists, removeTrack } = usePlaylists();
  const ui = usePlayerUi();
  const { push } = useNotifications();

  const [lyricsOpen, setLyricsOpen] = usePersistentState<boolean>("playground.lyricsOpen", false);
  const [openPanel, setOpenPanel] = useState<Panel>(null);
  const [stripFilter, setStripFilter] = useState("");
  const [filterOpen, setFilterOpen] = useState(false);
  const [linkInput, setLinkInput] = usePersistentState<string>("playground.linkInput", "");
  const [openLink, setOpenLink] = usePersistentState<string | null>("playground.openLink", null);
  const [openPlaylistId, setOpenPlaylistId] = usePersistentState<string | null>("playground.openPlaylist", null);
  const [editing, setEditing] = useState<Track | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [crop, setCrop] = usePersistentState<CropId>("playground.crop", "fit");
  const stageRef = useRef<HTMLElement>(null);

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
    sleepTimer,
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
    startSleepTimer,
    cancelSleepTimer,
  } = playback;

  // --- playlist folders in the queue strip ------------------------------------------
  const trackById = useMemo(() => new Map(libraryTracks.map((t) => [t.id, t])), [libraryTracks]);
  const folders = useMemo<PlaylistFolder[]>(
    () =>
      playlists
        .filter((p) => p.trackIds.length > 0)
        .map((playlist) => ({
          playlist,
          count: playlist.trackIds.length,
          // Folder icon shows the album art of the first track in the list (custom cover wins).
          art: playlist.coverUrl ?? trackById.get(playlist.trackIds[0])?.artworkUrl,
        })),
    [playlists, trackById],
  );
  const openFolder = folders.find((f) => f.playlist.id === openPlaylistId) ?? null;
  useEffect(() => {
    // Stale (deleted/emptied playlist) -> bring back the general strip.
    if (openPlaylistId && !openFolder && playlists.length >= 0 && libraryTracks.length > 0) setOpenPlaylistId(null);
  }, [openPlaylistId, openFolder, libraryTracks.length]); // eslint-disable-line react-hooks/exhaustive-deps

  const sourceTracks = useMemo(
    () => (openFolder ? openFolder.playlist.trackIds.map((id) => trackById.get(id)).filter((t): t is Track => Boolean(t)) : libraryTracks),
    [openFolder, trackById, libraryTracks],
  );
  const layout = useStripLayout(openFolder ? `playlist:${openFolder.playlist.id}` : "library", sourceTracks);

  const filtered = useMemo(() => {
    const q = stripFilter.trim().toLowerCase();
    return q ? layout.ordered.filter((t) => `${t.title} ${t.artist}`.toLowerCase().includes(q)) : layout.ordered;
  }, [layout.ordered, stripFilter]);
  const stripTracks = stripFilter.trim() ? filtered : filtered.slice(0, STRIP_RENDER_LIMIT);

  const onSelectFromStrip = (track: Track) => playTrack(track, openFolder ? filtered : layout.ordered);

  const onTogglePin = (track: Track) => {
    const result = layout.togglePin(track.id);
    if (result === "limit") push("Pin limit reached", "You can pin up to 10 tracks in the queue strip.");
  };
  const onRemoveFromStrip = (track: Track) => {
    if (openFolder) removeTrack(openFolder.playlist.id, track.id);
    else layout.remove(track.id);
  };

  // --- fullscreen ----------------------------------------------------------------------
  useEffect(() => {
    const onChange = () => setFullscreen(document.fullscreenElement === stageRef.current);
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);
  const toggleFullscreen = () => {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void stageRef.current?.requestFullscreen?.();
  };

  const stop = () => {
    if (currentTrack) seek(0);
    if (isPlaying) togglePlay();
  };
  const togglePanel = (panel: Panel) => setOpenPanel((p) => (p === panel ? null : panel));

  const onDropLink = () => {
    const trimmed = linkInput.trim();
    if (!trimmed) return;
    try {
      const url = new URL(trimmed).toString();
      setOpenLink(url);
      setLinkInput("");
      setOpenPanel(null);
    } catch {
      push("That doesn't look like a link", "Paste a full URL, e.g. https://www.youtube.com/watch?v=…");
    }
  };

  const playLinkInStage = () => {
    const id = parseYouTubeId(linkInput.trim());
    if (!id) {
      push("Not a YouTube link", "Use Open for other sites — only YouTube links can play in the stage.");
      return;
    }
    ui.setLinkVideoId(id);
    ui.setVideoMode(true);
    setLinkInput("");
    setOpenPanel(null);
  };

  const canDownload = ui.activeVideoId !== null;
  const onDownload = async () => {
    if (!ui.activeVideoId) return;
    setDownloading(true);
    try {
      const dir = await downloadVideo(`https://www.youtube.com/watch?v=${ui.activeVideoId}`);
      push("Video downloaded", `Saved to your Downloads folder (${dir}).`);
    } catch (e) {
      push("Download failed", e instanceof Error ? e.message : String(e));
    } finally {
      setDownloading(false);
    }
  };

  const videoOnStage = ui.activeVideoId !== null;
  const ambientSrc = videoOnStage ? `https://i.ytimg.com/vi/${ui.activeVideoId}/hqdefault.jpg` : currentTrack?.artworkUrl;

  return (
    <div className="playground" data-ambient={ui.ambient}>
      {/* Ambient mode: a blurred, slowly drifting glow of the art/video behind the whole theater page. */}
      {ui.ambient && ambientSrc && <div className="playground__ambient" style={{ backgroundImage: `url("${ambientSrc}")` }} aria-hidden="true" />}

      <section className="playground__stage" ref={stageRef} data-fullscreen={fullscreen} data-crop={crop}>
        <div className="playground__stage-mode">
          <button type="button" data-active={!ui.videoMode} onClick={() => ui.setVideoMode(false)}>
            Audio
          </button>
          <Tooltip label="Finds the official video with yt-dlp (needs yt-dlp installed)" side="top">
            <button type="button" data-active={ui.videoMode} onClick={() => ui.setVideoMode(true)}>
              Video
            </button>
          </Tooltip>
        </div>

        <div className="playground__stage-art">
          {videoOnStage ? (
            <VideoFrame videoId={ui.activeVideoId!} className="playground__stage-video" />
          ) : currentTrack?.artworkUrl ? (
            <img src={currentTrack.artworkUrl} alt="" />
          ) : (
            <PlaygroundIcon className="playground__stage-placeholder" />
          )}
          {ui.videoMode && !videoOnStage && (
            <div className="playground__stage-status">
              {ui.videoStatus === "searching" && "Finding the official video…"}
              {ui.videoStatus === "none" && "No official video found for this track."}
              {ui.videoStatus === "error" && (ui.videoError ?? "Couldn't fetch a video.")}
              {ui.videoStatus === "idle" && "Play a track to fetch its video."}
            </div>
          )}
          {/* Lyrics overlay sits on the stage like subtitles — in Audio mode only (Video Mode relies on YouTube's own captions). */}
          {lyricsOpen && !ui.videoMode && <LyricsOverlay />}
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

        {/* Fullscreen: on-stage controls so you never have to hunt for Esc. */}
        {fullscreen && (
          <div className="playground__fs-controls">
            <button type="button" onClick={toggleFullscreen} className="playground__fs-back">
              <ExitFullscreenIcon /> Back
            </button>
            <div className="playground__fs-transport">
              <button type="button" onClick={previous} aria-label="Previous"><PreviousIcon /></button>
              <button type="button" className="playground__fs-play" onClick={togglePlay} aria-label={isPlaying ? "Pause" : "Play"}>
                {isPlaying ? <PauseIcon /> : <PlayIcon />}
              </button>
              <button type="button" onClick={next} aria-label="Next"><NextIcon /></button>
            </div>
            <div className="playground__fs-crop" role="radiogroup" aria-label="Crop">
              {CROPS.map((c) => (
                <button key={c.id} type="button" role="radio" aria-checked={crop === c.id} data-active={crop === c.id} onClick={() => setCrop(c.id)}>
                  {c.label}
                </button>
              ))}
            </div>
          </div>
        )}
      </section>

      <SeekBar position={position} duration={duration} disabled={!currentTrack} onSeek={seek} />

      <section className="playground__transport">
        <Tooltip label="Shuffle" side="top">
          <button type="button" data-active={shuffle} onClick={toggleShuffle}><ShuffleIcon /></button>
        </Tooltip>
        <Tooltip label="Previous" side="top">
          <button type="button" onClick={previous} disabled={!currentTrack}><PreviousIcon /></button>
        </Tooltip>
        <Tooltip label="Back 10s" side="top">
          <button type="button" onClick={() => seek(Math.max(0, position - 10))} disabled={!currentTrack}><Rewind10Icon /></button>
        </Tooltip>
        <button type="button" className="playground__play-btn" onClick={togglePlay} disabled={!currentTrack} aria-label={isPlaying ? "Pause" : "Play"}>
          {isPlaying ? <PauseIcon /> : <PlayIcon />}
        </button>
        <Tooltip label="Stop" side="top">
          <button type="button" onClick={stop} disabled={!currentTrack}><StopIcon /></button>
        </Tooltip>
        <Tooltip label="Forward 15s" side="top">
          <button type="button" onClick={() => seek(position + 15)} disabled={!currentTrack}><Forward15Icon /></button>
        </Tooltip>
        <Tooltip label="Next" side="top">
          <button type="button" onClick={next} disabled={!currentTrack}><NextIcon /></button>
        </Tooltip>
        <Tooltip label={`Repeat: ${repeatMode}`} side="top">
          <button type="button" data-active={repeatMode !== "off"} onClick={cycleRepeatMode}><RepeatIcon /></button>
        </Tooltip>
        <Tooltip label="Loop Creator" side="top">
          <button type="button" data-active={openPanel === "loop" || loopSection.enabled} onClick={() => togglePanel("loop")}><ScissorsIcon /></button>
        </Tooltip>
        <Tooltip label={currentTrack && isFavorite(currentTrack.id) ? "Unfavorite" : "Favorite"} side="top">
          <button type="button" data-active={currentTrack ? isFavorite(currentTrack.id) : false} disabled={!currentTrack} onClick={() => currentTrack && toggleFavorite(currentTrack.id)}>
            <HeartIcon />
          </button>
        </Tooltip>

        {/* Order per spec: Speaker, PIP, Fullscreen */}
        <div className="playground__volume">
          <VolumeIcon />
          <input type="range" min={0} max={1} step={0.01} value={volume} onChange={(e) => setVolume(Number(e.target.value))} aria-label="Volume" />
        </div>
        <Tooltip label="Mini player (floats over other apps)" side="top"> {/*<Tooltip label="Picture-in-picture" side="top">*/}
          <button type="button" data-active={ui.pipOpen} onClick={() => ui.setPipOpen(!ui.pipOpen)} disabled={!currentTrack}><PipIcon /></button>
        </Tooltip>
        <Tooltip label="Fullscreen" side="top">
          <button type="button" data-active={fullscreen} onClick={toggleFullscreen}><FullscreenIcon /></button>
        </Tooltip>
      </section>

      <section className="playground__secondary-row">
        <Tooltip label={openFolder ? `Playlist: ${openFolder.playlist.name}` : "Queue strip — pick a playlist folder to browse it"} side="top">
          <button type="button" data-active={Boolean(openFolder)} onClick={() => openFolder && setOpenPlaylistId(null)}><QueueListIcon /></button>
        </Tooltip>
        <Tooltip label="Lyrics overlay" side="top">
          <button type="button" data-active={lyricsOpen} onClick={() => setLyricsOpen((v) => !v)}><CaptionsIcon /></button>
        </Tooltip>
        <Tooltip label="Lyrics style" side="top">
          <button type="button" data-active={openPanel === "lyrics-style"} onClick={() => togglePanel("lyrics-style")}>Aa</button>
        </Tooltip>
        <Tooltip label="Search the strip" side="top">
          <button type="button" data-active={filterOpen} onClick={() => setFilterOpen((v) => !v)}><SearchIcon /></button>
        </Tooltip>
        <Tooltip label="Playback speed" side="top">
          <button type="button" data-active={openPanel === "speed"} onClick={() => togglePanel("speed")}>{playbackRate}×</button>
        </Tooltip>
        <Tooltip label="Drop a link" side="top">
          <button type="button" data-active={openPanel === "link" || Boolean(openLink)} onClick={() => togglePanel("link")}><LinkIcon /></button>
        </Tooltip>
        <Tooltip label="Ambient mode" side="top">
          <button type="button" data-active={ui.ambient} onClick={() => ui.setAmbient(!ui.ambient)}><AmbientIcon /></button>
        </Tooltip>
        <Tooltip label={sleepTimer ? `Sleep timer: ${sleepTimer.minutes} min` : "Sleep timer"} side="top">
          <button type="button" data-active={openPanel === "sleep" || Boolean(sleepTimer)} onClick={() => togglePanel("sleep")}><SleepIcon /></button>
        </Tooltip>
        <Tooltip label={canDownload ? "Download this video (yt-dlp)" : "Turn on Video Mode and let a video load to download it"} side="top">
          <button type="button" data-active={openPanel === "download"} disabled={!canDownload} onClick={() => togglePanel("download")}><DownloadIcon /></button>
        </Tooltip>
      </section>

      {openPanel && (
        <div className="playground__panel-body">
          {openPanel === "loop" && (
            <div className="playground__loop-creator">
              <label>
                <input type="checkbox" checked={loopSection.enabled} onChange={(e) => setLoopSection({ ...loopSection, enabled: e.target.checked })} />
                Enabled
              </label>
              <div className="playground__loop-row">
                <span>Start: {position.toFixed(1)}s</span>
                <button type="button" onClick={() => setLoopSection({ ...loopSection, start: position })} disabled={!currentTrack}>Set to current</button>
              </div>
              <div className="playground__loop-row">
                <span>End: {loopSection.end.toFixed(1)}s</span>
                <button type="button" onClick={() => setLoopSection({ ...loopSection, end: position })} disabled={!currentTrack}>Set to current</button>
              </div>
            </div>
          )}

          {openPanel === "speed" && (
            <div className="playground__speed">
              {SPEED_OPTIONS.map((speed) => (
                <button key={speed} type="button" data-active={playbackRate === speed} onClick={() => setPlaybackRate(speed)}>{speed}×</button>
              ))}
            </div>
          )}

          {openPanel === "link" && (
            <div className="playground__link-input">
              <input
                type="text"
                placeholder="Paste a YouTube (or any) link…"
                value={linkInput}
                onChange={(e) => setLinkInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && onDropLink()}
                autoFocus
              />
              <button type="button" onClick={onDropLink}>Float it</button>
              <button type="button" onClick={playLinkInStage} title="Play a YouTube link in the stage, in sync with the transport">On stage</button>
            </div>
          )}

          {openPanel === "sleep" && (
            <div className="playground__sleep">
              <p className="playground__panel-note">Stops after whole songs add up to the time you pick — a 15 minute timer plays about 4 average songs.</p>
              <div className="playground__speed">
                {SLEEP_OPTIONS.map((m) => (
                  <button key={m} type="button" data-active={sleepTimer?.minutes === m} onClick={() => startSleepTimer(m)}>
                    {m >= 60 ? `${m / 60}h` : `${m}m`}
                  </button>
                ))}
                {sleepTimer && (
                  <button type="button" onClick={cancelSleepTimer}>Cancel</button>
                )}
              </div>
              {sleepTimer && (
                <p className="playground__panel-note">
                  {sleepTimer.remainingSeconds > 0 ? `About ${Math.ceil(sleepTimer.remainingSeconds / 60)} min of songs left after this track.` : "Stopping when this track ends."}
                </p>
              )}
            </div>
          )}

          {openPanel === "download" && (
            <div className="playground__download">
              <p className="playground__panel-note">Downloads the matched YouTube video with yt-dlp into your Downloads folder.</p>
              <button type="button" className="playground__download-btn" onClick={onDownload} disabled={!canDownload || downloading}>
                {downloading ? "Downloading…" : "Download video"}
              </button>
            </div>
          )}

          {openPanel === "lyrics-style" && <LyricsSettings />}
        </div>
      )}

      {filterOpen && (
        <input
          type="text"
          className="playground__strip-filter"
          placeholder="Filter the strip below…"
          value={stripFilter}
          onChange={(e) => setStripFilter(e.target.value)}
          autoFocus
        />
      )}

      <QueueStrip
        tracks={stripTracks}
        currentTrackId={currentTrack?.id}
        pins={layout.pins}
        folders={folders}
        openFolder={openFolder}
        onSelect={onSelectFromStrip}
        onOpenFolder={setOpenPlaylistId}
        onCloseFolder={() => setOpenPlaylistId(null)}
        onTogglePin={onTogglePin}
        onEdit={setEditing}
        onRemove={onRemoveFromStrip}
        onMove={layout.move}
      />

      {editing && <EditMetadataModal track={editing} onClose={() => setEditing(null)} />}
      {openLink && <LinkDropperModal url={openLink} onClose={() => setOpenLink(null)} />}
      {/* queue is read so the strip's "Play" keeps the current queue shape stable across renders */}
      <span hidden>{queue.length}</span>
    </div>
  );
}
