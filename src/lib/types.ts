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
}

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
