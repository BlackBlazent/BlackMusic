import { serviceJson } from "./serviceFetch";

/** Genius: search songs, look up artists, and retrieve track information. (Lyric TEXT comes via LRCLIB / whisper.cpp — Genius has no lyrics endpoint.) */
const token = () => import.meta.env.VITE_GENIUS_ACCESS_TOKEN as string | undefined;
const auth = () => ({ headers: { Authorization: `Bearer ${token()}` } });

export const geniusConfigured = () => Boolean(token());

export interface GeniusSong {
  id: number;
  title: string;
  artist: string;
  artistId?: number;
  url: string;
  thumbnail?: string;
  releaseDate?: string;
  album?: string;
  pageviews?: number;
}

interface RawSong { id: number; title: string; url: string; song_art_image_thumbnail_url?: string; release_date_for_display?: string; stats?: { pageviews?: number }; primary_artist: { id: number; name: string }; album?: { name: string } }

const mapSong = (s: RawSong): GeniusSong => ({
  id: s.id,
  title: s.title,
  artist: s.primary_artist.name,
  artistId: s.primary_artist.id,
  url: s.url,
  thumbnail: s.song_art_image_thumbnail_url,
  releaseDate: s.release_date_for_display,
  album: s.album?.name,
  pageviews: s.stats?.pageviews,
});

export async function geniusSearchSongs(query: string): Promise<GeniusSong[]> {
  if (!token()) throw new Error("Genius needs VITE_GENIUS_ACCESS_TOKEN.");
  const d = await serviceJson<{ response?: { hits?: { type: string; result: RawSong }[] } }>(`https://api.genius.com/search?q=${encodeURIComponent(query)}`, auth());
  return (d.response?.hits ?? []).filter((h) => h.type === "song").map((h) => mapSong(h.result));
}

export interface GeniusArtist { id: number; name: string; image?: string; url: string; description?: string; followers?: number }

export async function geniusArtist(id: number): Promise<GeniusArtist> {
  const d = await serviceJson<{ response: { artist: { id: number; name: string; image_url?: string; url: string; followers_count?: number; description_preview?: string } } }>(`https://api.genius.com/artists/${id}?text_format=plain`, auth());
  const a = d.response.artist;
  return { id: a.id, name: a.name, image: a.image_url, url: a.url, followers: a.followers_count, description: a.description_preview };
}

/** Distinct primary artists in the search hits — "lookup specific artists". */
export async function geniusSearchArtists(query: string): Promise<GeniusArtist[]> {
  const songs = await geniusSearchSongs(query);
  const ids = [...new Set(songs.map((s) => s.artistId).filter((x): x is number => typeof x === "number"))].slice(0, 4);
  return Promise.all(ids.map((id) => geniusArtist(id)));
}

export async function geniusSongInfo(id: number): Promise<GeniusSong & { description?: string; producers?: string[]; writers?: string[] }> {
  const d = await serviceJson<{ response: { song: RawSong & { description?: { plain?: string }; producer_artists?: { name: string }[]; writer_artists?: { name: string }[] } } }>(`https://api.genius.com/songs/${id}?text_format=plain`, auth());
  const s = d.response.song;
  return { ...mapSong(s), description: s.description?.plain, producers: s.producer_artists?.map((p) => p.name), writers: s.writer_artists?.map((w) => w.name) };
}
