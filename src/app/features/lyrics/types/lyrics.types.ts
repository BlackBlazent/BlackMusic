export type ActiveTrack = {
  id: string;
  title: string;
  artist: string;
  album?: string;
  duration?: number;
  artwork?: string;
  /** Local audio path, when there is one (lets LocalLyricsProvider look for sibling .lrc/.txt files). */
  path?: string;
};

export type LyricLine = { id: string; text: string; startTime?: number; endTime?: number };

export type LyricsDocument = {
  trackId: string;
  title: string;
  artist: string;
  provider: "genius" | "lrclib" | "local" | "other";
  fetchedAt: number;
  synced: boolean;
  lines: LyricLine[];
  /** Canonical Genius page for the song, when Genius identified it. */
  sourceUrl?: string;
};

export type LyricsSearchResult = { id: string; title: string; artist: string; url?: string; thumbnail?: string };

export interface LyricsProvider {
  readonly name: string;
  searchTrack(track: ActiveTrack): Promise<LyricsSearchResult[]>;
  fetchLyrics(result: LyricsSearchResult, track: ActiveTrack): Promise<LyricsDocument | null>;
}

export type LyricsOverlaySettings = {
  enabled: boolean;
  alignment: "left" | "center" | "right";
  textColor: string;
  backgroundColor: string;
  fontSize: number;
  fontFamily: string;
  fontWeight: number;
  opacity: number;
  lineSpacing: number;
  padding: number;
  maxWidth: number;
  showCurrentLineOnly: boolean;
  autoScroll: boolean;
  animation: "none" | "fade" | "slide";
  shadow: boolean;
};

export const DEFAULT_LYRICS_SETTINGS: LyricsOverlaySettings = {
  enabled: true,
  alignment: "center",
  textColor: "#ffffff",
  backgroundColor: "#000000",
  fontSize: 22,
  fontFamily: "Poppins, sans-serif",
  fontWeight: 600,
  opacity: 1,
  lineSpacing: 1.5,
  padding: 14,
  maxWidth: 92,
  showCurrentLineOnly: false,
  autoScroll: true,
  animation: "fade",
  shadow: true,
};
