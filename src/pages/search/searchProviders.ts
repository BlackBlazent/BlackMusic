import type { Track } from "@/lib/types";
import { searchServiceTracks } from "@/lib/services/serviceRegistry";
import { loadServiceKeys, SERVICE_CLIENTS } from "@/lib/services/serviceRegistry";
import { searchAudius, audiusStreamUrl } from "@/lib/services/audiusClient";
import { fetchSpotify } from "@/lib/services/spotifyClient";
import {
  lastfmArtistInfo,
  lastfmArtistTopTracks,
  lastfmChartTracks,
  lastfmSearchArtists,
  lastfmSearchTracks,
  lastfmTagTopTracks,
  lastfmTopArtists,
  type LastfmArtist,
} from "@/lib/services/lastfmClient";
import { mbSearchArtists, mbSearchRecordings } from "@/lib/services/musicbrainzClient";
import { geniusConfigured, geniusSearchArtists, geniusSearchSongs, type GeniusArtist, type GeniusSong } from "@/lib/services/geniusClient";
import type { ParsedSearchQuery } from "./parseSearchQuery";

/** What a search can return. The page renders each non-empty section. */
export interface SearchPayload {
  tracks: Track[];
  artists: { name: string; image?: string; subtitle?: string; bio?: string; tags?: string[]; similar?: string[]; url?: string }[];
  songs: GeniusSong[];
  notice?: string;
  /** Which kind of playback the tracks support — shown as a hint. */
  playbackHint?: string;
}

const empty = (): SearchPayload => ({ tracks: [], artists: [], songs: [] });

const lastfmKey = async () => {
  const keys = await loadServiceKeys();
  return keys.lastfm || (import.meta.env.VITE_LASTFM_API_KEY as string | undefined) || "";
};

const artistRow = (a: LastfmArtist) => ({
  name: a.name,
  image: a.image,
  subtitle: a.listeners ? `${Number(a.listeners).toLocaleString()} listeners` : undefined,
  bio: a.bio,
  tags: a.tags,
  similar: a.similar,
  url: a.url,
});

export async function runSearch(parsed: ParsedSearchQuery): Promise<SearchPayload> {
  const term = parsed.term.trim();
  const scope = parsed.scope;

  // ---- YouTube: videos, playable ------------------------------------------------------------
  if (scope === "youtube") {
    if (!term) return { ...empty(), notice: "Type something after @youtube: to search videos." };
    const { tracks } = await searchServiceTracks("youtube", term, 25);
    return { ...empty(), tracks, playbackHint: "Click a result to play its audio; use Playground → Video to watch it on the stage." };
  }

  // ---- Last.fm: catalog, charts, tags, similar artists ---------------------------------------
  if (scope === "lastfm") {
    const key = await lastfmKey();
    if (!key) return { ...empty(), notice: "Last.fm needs VITE_LASTFM_API_KEY (or paste a key in Settings → Service API keys)." };
    const out = empty();
    out.playbackHint = "Last.fm lists music — BlackMusic finds a playable stream for the track you click.";
    const t = term.toLowerCase();
    if (!term || t === "chart" || t === "charts") {
      const [tracks, artists] = await Promise.all([lastfmChartTracks(key, 30), lastfmTopArtists(key, 12)]);
      return { ...out, tracks, artists: artists.map(artistRow), notice: "Showing the current Last.fm charts." };
    }
    if (t.startsWith("tag:")) {
      out.tracks = await lastfmTagTopTracks(key, term.slice(4).trim());
      return out;
    }
    if (t.startsWith("similar:")) {
      const name = term.slice(8).trim();
      const info = await lastfmArtistInfo(key, name);
      out.artists = [artistRow(info), ...(info.similar ?? []).map((n) => ({ name: n, subtitle: `Similar to ${info.name}` }))];
      out.tracks = await lastfmArtistTopTracks(key, name, 10);
      return out;
    }
    const [tracks, artists] = await Promise.all([lastfmSearchTracks(key, term), lastfmSearchArtists(key, term, 6)]);
    out.tracks = tracks;
    out.artists = artists.map(artistRow);
    // Enrich the best artist match with bio/tags/similar artists.
    if (artists[0]) {
      try {
        const info = await lastfmArtistInfo(key, artists[0].name);
        out.artists[0] = artistRow({ ...artists[0], ...info });
      } catch {
        /* enrichment is optional */
      }
    }
    return out;
  }

  // ---- MusicBrainz: recordings + artists ------------------------------------------------------
  if (scope === "musicbrainz") {
    if (!term) return { ...empty(), notice: "Type something after @musicbrainz: to search recordings." };
    const [{ tracks }, artists] = await Promise.all([mbSearchRecordings(term, 25), mbSearchArtists(term, 6)]);
    return {
      ...empty(),
      tracks,
      artists: artists.map((a) => ({ name: a.name, subtitle: [a.type, a.country, a.disambiguation].filter(Boolean).join(" · ") })),
      playbackHint: "MusicBrainz is a metadata database — BlackMusic finds a playable stream for the track you click.",
    };
  }

  // ---- Genius: songs, artists, track info -----------------------------------------------------
  if (scope === "genius") {
    if (!geniusConfigured()) return { ...empty(), notice: "Genius needs VITE_GENIUS_ACCESS_TOKEN (a client access token)." };
    if (!term) return { ...empty(), notice: "Type a song or artist after @genius:." };
    const [songs, artists]: [GeniusSong[], GeniusArtist[]] = await Promise.all([geniusSearchSongs(term), geniusSearchArtists(term).catch(() => [])]);
    return {
      ...empty(),
      songs,
      artists: artists.map((a) => ({ name: a.name, image: a.image, subtitle: a.followers ? `${a.followers.toLocaleString()} followers` : undefined, bio: a.description, url: a.url })),
    };
  }

  // ---- @online-<service>: playable results ------------------------------------------------------
  if (scope.startsWith("online-")) {
    const id = scope.slice("online-".length);
    if (!term) return { ...empty(), notice: `Type something after @online-${id}: to search ${id}.` };

    if (id === "spotify") {
      type SpotifySearch = { tracks?: { items: { id: string; name: string; duration_ms: number; artists: { name: string }[]; album: { name: string; images?: { url: string }[] } }[] } };
      const data = await fetchSpotify<SpotifySearch>(`/search?type=track&limit=30&q=${encodeURIComponent(term)}`);
      if (!data) return { ...empty(), notice: "Spotify isn't connected (or the session expired). Reconnect from the logo menu." };
      return {
        ...empty(),
        playbackHint: "Plays through Spotify's Web Playback SDK (Premium).",
        tracks: (data.tracks?.items ?? []).map((t) => ({
          id: `spotify:track:${t.id}`,
          path: "",
          title: t.name,
          artist: t.artists.map((a) => a.name).join(", "),
          album: t.album.name,
          duration: t.duration_ms / 1000,
          sourceUrl: "",
          artworkUrl: t.album.images?.[0]?.url,
          addedAt: Date.now(),
          provider: "spotify",
        })),
      };
    }

    if (id === "audius") {
      const rows = await searchAudius(term, 30);
      return {
        ...empty(),
        tracks: rows.map((t) => ({
          id: `audius:${t.id}`, path: "", title: t.title, artist: t.user.name, album: t.genre ?? "", duration: t.duration,
          sourceUrl: audiusStreamUrl(t.id), artworkUrl: t.artwork?.["480x480"] ?? t.artwork?.["150x150"], addedAt: Date.now(), provider: "audius",
        })),
      };
    }

    if (!SERVICE_CLIENTS[id]) return { ...empty(), notice: `"${id}" isn't a known service. Try spotify, audius, tidal, deezer, apple, soundcloud, yandex, amazon, lastfm or youtube.` };
    const { tracks, needsKey } = await searchServiceTracks(id, term, 30);
    return { ...empty(), tracks, notice: needsKey ? `${id} is ready to go — it just needs its API key (Settings → Service API keys).` : undefined };
  }

  return empty();
}
