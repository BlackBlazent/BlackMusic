export type SearchScope =
  | "all"
  | "music"
  | "page"
  | "youtube"
  | "imdb"
  | "genius"
  | "lastfm"
  | "musicbrainz"
  | `online-${string}`;

export interface ParsedSearchQuery {
  scope: SearchScope;
  term: string;
}

/** Service ids that can be addressed as `@online-<id>:`, `@online<id>:` or just `@<id>:`. */
export const ONLINE_SERVICE_IDS = [
  "spotify", "audius", "tidal", "amazon", "apple", "deezer", "soundcloud", "pandora", "yandex", "lastfm", "youtube", "bmusic",
];

const BARE_SCOPES = ["music", "page", "youtube", "imdb", "genius", "lastfm", "musicbrainz"];

/**
 * Search syntax (2.2.0):
 *   @music: name            local library
 *   @page: name             jump to a page
 *   @youtube: query         YouTube videos — results are playable (audio via yt-dlp, or on the Playground stage)
 *   @online-<service>: q    playable results from that service (also `@online<service>:` / `@online_<service>:`)
 *   @lastfm: q              Last.fm catalog: tracks, artists, tags, similar artists  (also serves playable music)
 *   @musicbrainz: q         MusicBrainz recordings/artists (also serves playable music)
 *   @genius: q              songs, artists and track info (lyrics metadata)
 *   @imdb: q                reserved
 * No prefix → everything local.
 */
export function parseSearchQuery(raw: string): ParsedSearchQuery {
  const match = raw.trim().match(/^@([a-z0-9_-]+):?\s*(.*)$/i);
  if (!match) return { scope: "all", term: raw.trim() };

  const [, scopeRaw, rest] = match;
  const scope = scopeRaw.toLowerCase();
  const term = rest.trim();

  // @online-spotify / @onlinespotify / @online_spotify
  const online = scope.match(/^online[-_]?([a-z0-9]+)$/);
  if (online) {
    const id = online[1];
    if (id === "lastfm") return { scope: "lastfm", term };
    if (id === "musicbrainz") return { scope: "musicbrainz", term };
    if (id === "youtube") return { scope: "youtube", term };
    return { scope: `online-${id}`, term };
  }
  if (BARE_SCOPES.includes(scope)) return { scope: scope as SearchScope, term };
  if (ONLINE_SERVICE_IDS.includes(scope)) return { scope: `online-${scope}`, term };
  if (scope.startsWith("online-")) return { scope: scope as SearchScope, term };

  return { scope: "all", term: raw.trim() };
}
