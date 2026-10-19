export interface Track {
  id: string;
  path: string;
  title: string;
  artist: string;
  album: string;
  /** Seconds. 0 if unknown until metadata loads. */
  duration: number;
  /** asset:// URL (via Tauri's convertFileSrc) the <audio> element can play. */
  sourceUrl: string;
  /** Data URL from embedded tag art, if the file has any. */
  artworkUrl?: string;
  addedAt: number;
  /** File size + mtime (seconds) at last scan — lets rescans skip unchanged files. */
  size?: number;
  mtime?: number;
  /**
   * 2.2.0: tracks from services that list music but don't hand out a stream URL (YouTube, Last.fm,
   * MusicBrainz, Tidal, …) carry a recipe the stream resolver turns into something <audio> can play.
   */
  resolve?: StreamRecipe;
  /** Which service produced this track (shown in search results / used for resolver fallbacks). */
  provider?: string;
  /** 2.2.0 extended tags (all optional — filled by the scanner / tag editor when known). */
  albumArtist?: string;
  year?: number;
  genre?: string;
  composer?: string;
  comment?: string;
  bitrate?: number;
  format?: string;
}

export type StreamRecipe =
  | { kind: "youtube"; videoId: string }
  /** Resolve by searching "artist title" (YouTube via yt-dlp, then Deezer/Audius previews as fallback). */
  | { kind: "search"; query: string };

export type RepeatMode = "off" | "track" | "queue";

export interface LoopSection {
  enabled: boolean;
  /** Seconds */
  start: number;
  /** Seconds */
  end: number;
}

export interface PlayEvent {
  trackId: string;
  playedAt: number;
}
