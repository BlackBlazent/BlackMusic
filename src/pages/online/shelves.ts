import type { Track } from "@/lib/types";
import { fetchSpotifyOrThrow, SpotifyApiError } from "@/lib/services/spotifyClient";
import { lastfmRecentTracks, lastfmTopArtists } from "@/lib/services/lastfmClient";
import { readSharedSetting } from "@/lib/sharedSetting";

/**
 * Shelf model for the Online page (Spotify-style home: horizontal rows of cards).
 * 2.2.0: the same pattern is used for EVERY service, including BlackMusic's own library.
 */
export interface ShelfItem {
  id: string;
  title: string;
  subtitle?: string;
  image?: string;
  /** Circular artwork (artists). */
  round?: boolean;
  /** Plays directly. */
  track?: Track;
  /** Loads a list of tracks (album / playlist / artist / station) and plays it. */
  load?: () => Promise<Track[]>;
  /** Opens externally when it can't be played in-app (podcast shows). */
  href?: string;
  /** "RADIO" ribbon, "THIS IS" etc. */
  badge?: string;
}

export interface Shelf {
  id: string;
  title: string;
  caption?: string;
  /** Small round avatar + "More like" style heading. */
  eyebrow?: string;
  avatar?: string;
  items: ShelfItem[];
}

const pic = (images?: { url: string }[]) => images?.[0]?.url;
const uniqueBy = <T,>(rows: T[], key: (r: T) => string) => [...new Map(rows.map((r) => [key(r), r])).values()];

// ----------------------------------------------------------------------------- Spotify ------
interface SpArtist { id: string; name: string; images?: { url: string }[]; followers?: { total: number } }
interface SpAlbum { id: string; name: string; images?: { url: string }[]; artists: { name: string }[] }
interface SpTrack { id: string; name: string; duration_ms: number; artists: { id?: string; name: string }[]; album: { name: string; images?: { url: string }[] } }
interface SpPlaylist { id: string; name: string; description?: string; images?: { url: string }[]; owner?: { display_name?: string } }
interface SpShow { id: string; name: string; publisher?: string; images?: { url: string }[]; external_urls?: { spotify?: string } }

const toTrack = (t: SpTrack): Track => ({
  id: `spotify:track:${t.id}`,
  path: "",
  title: t.name,
  artist: t.artists.map((a) => a.name).join(", "),
  album: t.album.name,
  duration: t.duration_ms / 1000,
  sourceUrl: "",
  artworkUrl: pic(t.album.images),
  addedAt: Date.now(),
  provider: "spotify",
});
const trackItem = (t: SpTrack): ShelfItem => ({ id: `spotify:track:${t.id}`, title: t.name, subtitle: t.artists.map((a) => a.name).join(", "), image: pic(t.album.images), track: toTrack(t) });

const artistTopTracks = (id: string, market: string) => async () =>
  (await fetchSpotifyOrThrow<{ tracks: SpTrack[] }>(`/artists/${id}/top-tracks?market=${market}`)).tracks.map(toTrack);
const albumTracks = (album: SpAlbum) => async () => {
  const d = await fetchSpotifyOrThrow<{ items: { id: string; name: string; duration_ms: number; artists: { name: string }[] }[] }>(`/albums/${album.id}/tracks?limit=50`);
  return d.items.map((t): Track => ({ id: `spotify:track:${t.id}`, path: "", title: t.name, artist: t.artists.map((a) => a.name).join(", "), album: album.name, duration: t.duration_ms / 1000, sourceUrl: "", artworkUrl: pic(album.images), addedAt: Date.now(), provider: "spotify" }));
};
const playlistTracks = (id: string) => async () => {
  const d = await fetchSpotifyOrThrow<{ items: { track: SpTrack | null }[] }>(`/playlists/${id}/tracks?limit=50`);
  return d.items.map((i) => i.track).filter((t): t is SpTrack => Boolean(t && t.id)).map(toTrack);
};

/**
 * Every shelf is fetched independently: Spotify has been retiring endpoints for newer apps (recommendations, related
 * artists, featured playlists), so a failing shelf is simply left out. If EVERY request fails, the first error is
 * rethrown so the page can explain it (expired session / missing scope / not allow-listed).
 */
export async function buildSpotifyShelves(): Promise<Shelf[]> {
  const me = await fetchSpotifyOrThrow<{ country?: string; display_name?: string }>("/me"); // throws the real 401/403 reason
  const market = me.country || "US";

  const jobs = await Promise.allSettled([
    fetchSpotifyOrThrow<{ items: { track: SpTrack }[] }>("/me/player/recently-played?limit=20"), // 0
    fetchSpotifyOrThrow<{ items: SpArtist[] }>("/me/top/artists?limit=20&time_range=medium_term"), // 1
    fetchSpotifyOrThrow<{ items: SpTrack[] }>("/me/top/tracks?limit=20&time_range=short_term"), // 2
    fetchSpotifyOrThrow<{ items: { track: SpTrack }[] }>("/me/tracks?limit=30"), // 3
    fetchSpotifyOrThrow<{ albums: { items: SpAlbum[] } }>(`/browse/new-releases?limit=20&country=${market}`), // 4
    fetchSpotifyOrThrow<{ items: SpPlaylist[] }>("/me/playlists?limit=20"), // 5
    fetchSpotifyOrThrow<{ items: { show: SpShow }[] }>("/me/shows?limit=20"), // 6
    fetchSpotifyOrThrow<{ items: { album: SpAlbum }[] }>("/me/albums?limit=20"), // 7
  ]);
  const ok = <T,>(i: number) => (jobs[i].status === "fulfilled" ? (jobs[i] as PromiseFulfilledResult<T>).value : null);

  const recents = ok<{ items: { track: SpTrack }[] }>(0);
  const topArtists = ok<{ items: SpArtist[] }>(1);
  const topTracks = ok<{ items: SpTrack[] }>(2);
  const saved = ok<{ items: { track: SpTrack }[] }>(3);
  const releases = ok<{ albums: { items: SpAlbum[] } }>(4);
  const playlists = ok<{ items: SpPlaylist[] }>(5);
  const shows = ok<{ items: { show: SpShow }[] }>(6);
  const albums = ok<{ items: { album: SpAlbum }[] }>(7);

  if (jobs.every((j) => j.status === "rejected")) throw (jobs[0] as PromiseRejectedResult).reason;
  jobs.forEach((j, i) => j.status === "rejected" && console.warn("[spotify shelf]", i, (j as PromiseRejectedResult).reason));

  const shelves: Shelf[] = [];
  const artists = topArtists?.items ?? [];

  if (artists.length) {
    shelves.push({
      id: "stations", title: "Recommended Stations", caption: "Non-stop music based on your favorite songs and artists.",
      items: artists.slice(0, 10).map((a) => ({ id: `radio:${a.id}`, title: a.name, subtitle: "Radio", image: a.images?.[0]?.url, badge: "RADIO", load: artistTopTracks(a.id, market) })),
    });
  }
  const today = uniqueBy([...(releases?.albums.items ?? []).map((a): ShelfItem => ({ id: `album:${a.id}`, title: a.name, subtitle: a.artists.map((x) => x.name).join(", "), image: pic(a.images), load: albumTracks(a) })), ...(topTracks?.items ?? []).map(trackItem)], (i) => i.id);
  if (today.length) shelves.push({ id: "today", title: "Recommended for today", caption: "Inspired by your recent activity", items: today.slice(0, 16) });

  const recentTracks = uniqueBy((recents?.items ?? []).map((i) => i.track), (t) => t.id);
  if (recentTracks.length) shelves.push({ id: "recents", title: "Recents", items: recentTracks.map(trackItem) });

  if (artists[0]) {
    const a = artists[0];
    const more = await fetchSpotifyOrThrow<{ items: SpAlbum[] }>(`/artists/${a.id}/albums?include_groups=album,single&limit=12&market=${market}`).catch(() => null);
    if (more?.items.length) shelves.push({ id: "more-like", eyebrow: "More like", title: a.name, avatar: pic(a.images), items: more.items.map((al) => ({ id: `album:${al.id}`, title: al.name, subtitle: al.artists.map((x) => x.name).join(", "), image: pic(al.images), load: albumTracks(al) })) });
  }
  if (artists[1]) {
    const a = artists[1];
    shelves.push({ id: "fans-of", eyebrow: "For fans of", title: a.name, avatar: pic(a.images), items: [{ id: `thisis:${a.id}`, title: `This Is ${a.name}`, subtitle: "The essential tracks", image: pic(a.images), badge: "THIS IS", load: artistTopTracks(a.id, market) }, ...(playlists?.items ?? []).slice(0, 5).map((p): ShelfItem => ({ id: `pl:${p.id}`, title: p.name, subtitle: p.owner?.display_name, image: pic(p.images), load: playlistTracks(p.id) }))] });
  }
  if (artists.length > 2) shelves.push({ id: "popular-radio", title: "Popular radio", items: artists.slice(2, 12).map((a) => ({ id: `popradio:${a.id}`, title: a.name, subtitle: "Radio", image: pic(a.images), badge: "RADIO", load: artistTopTracks(a.id, market) })) });
  if (artists.length) shelves.push({ id: "best-of", title: "Best of artists", caption: "Bringing together the top songs from an artist.", items: artists.slice(0, 12).map((a) => ({ id: `best:${a.id}`, title: `This is ${a.name}`, subtitle: `The essential tracks from ${a.name}.`, image: pic(a.images), badge: "THIS IS", load: artistTopTracks(a.id, market) })) });

  const like = [...(playlists?.items ?? []).map((p): ShelfItem => ({ id: `pl:${p.id}`, title: p.name, subtitle: p.description?.replace(/<[^>]+>/g, "") || p.owner?.display_name, image: pic(p.images), load: playlistTracks(p.id) })), ...(albums?.items ?? []).map(({ album }): ShelfItem => ({ id: `album:${album.id}`, title: album.name, subtitle: album.artists.map((x) => x.name).join(", "), image: pic(album.images), load: albumTracks(album) }))];
  if (like.length) shelves.push({ id: "more-of", title: "More of what you like", caption: "Hear a little bit of everything you love.", items: like.slice(0, 16) });

  // Podcasts — only when the API returned the user's subscriptions (spec: implement only if the data is available).
  const showRows = shows?.items ?? [];
  if (showRows.length) shelves.push({ id: "episodes", title: "Your podcasts", caption: "Shows you follow on Spotify — opens in Spotify.", items: showRows.map(({ show }) => ({ id: `show:${show.id}`, title: show.name, subtitle: show.publisher, image: pic(show.images), href: show.external_urls?.spotify })) });

  if (saved?.items.length) shelves.push({ id: "saved", title: "Liked songs", items: saved.items.map((i) => trackItem(i.track)) });
  if (artists.length) shelves.push({ id: "fav-artists", title: "Your favorite artists", items: artists.map((a) => ({ id: `artist:${a.id}`, title: a.name, subtitle: "Artist", image: pic(a.images), round: true, load: artistTopTracks(a.id, market) })) });
  return shelves;
}

export function isSpotifyAuthIssue(e: unknown): e is SpotifyApiError {
  return e instanceof SpotifyApiError && (e.kind === "expired" || e.kind === "forbidden" || e.kind === "not-connected");
}

// -------------------------------------------------------------------------- Generic services --
/** Same shelf pattern for any service that just hands back a track list (Audius, Deezer, Last.fm, YouTube, local…). */
export async function buildTrackShelves(tracks: Track[], opts: { serviceId: string; lastfmKey?: string; recents?: Track[] }): Promise<Shelf[]> {
  const shelves: Shelf[] = [];
  const asItem = (t: Track): ShelfItem => ({ id: t.id, title: t.title, subtitle: t.artist, image: t.artworkUrl, track: t });
  if (opts.recents?.length) shelves.push({ id: "recents", title: "Recents", items: opts.recents.slice(0, 16).map(asItem) });
  if (tracks.length) {
    shelves.push({ id: "trending", title: opts.serviceId === "bmusic" ? "Recently added" : "Trending now", items: tracks.slice(0, 16).map(asItem) });
    if (tracks.length > 16) shelves.push({ id: "today", title: "Recommended for today", caption: "Inspired by what's popular right now", items: tracks.slice(16, 32).map(asItem) });
  }

  const byArtist = new Map<string, Track[]>();
  for (const t of tracks) {
    const key = t.artist.split(",")[0].trim();
    if (!key || key === "Unknown artist") continue;
    byArtist.set(key, [...(byArtist.get(key) ?? []), t]);
  }
  const ranked = [...byArtist.entries()].sort((a, b) => b[1].length - a[1].length);
  if (ranked.length) {
    shelves.push({ id: "best-of", title: "Best of artists", caption: "Bringing together the top songs from an artist.", items: ranked.slice(0, 12).map(([name, list]) => ({ id: `best:${name}`, title: `This is ${name}`, subtitle: `${list.length} track${list.length === 1 ? "" : "s"}`, image: list.find((t) => t.artworkUrl)?.artworkUrl, badge: "THIS IS", load: async () => list })) });
    shelves.push({ id: "fav-artists", title: opts.serviceId === "bmusic" ? "Your favorite artists" : "Popular artists", items: ranked.slice(0, 14).map(([name, list]) => ({ id: `artist:${name}`, title: name, subtitle: "Artist", image: list.find((t) => t.artworkUrl)?.artworkUrl, round: true, load: async () => list })) });
  }
  const byAlbum = new Map<string, Track[]>();
  for (const t of tracks) if (t.album) byAlbum.set(t.album, [...(byAlbum.get(t.album) ?? []), t]);
  if (byAlbum.size > 1) shelves.push({ id: "albums", title: "Albums", items: [...byAlbum.entries()].slice(0, 16).map(([name, list]) => ({ id: `album:${name}`, title: name, subtitle: list[0].artist, image: list.find((t) => t.artworkUrl)?.artworkUrl, load: async () => list })) });

  if (opts.serviceId === "lastfm" && opts.lastfmKey) {
    const user = readSharedSetting<string>("lastfmUser", "").trim();
    if (user) {
      try {
        const recent = await lastfmRecentTracks(opts.lastfmKey, user, 30);
        if (recent.length) shelves.unshift({ id: "scrobbles", title: `Recently scrobbled by ${user}`, caption: "Your Last.fm listening history", items: recent.map(asItem) });
      } catch {
        /* wrong username or private profile — the other shelves still work */
      }
    }
    try {
      const top = await lastfmTopArtists(opts.lastfmKey, 14);
      shelves.push({ id: "lastfm-artists", title: "Top artists on Last.fm", items: top.map((a) => ({ id: `lfm:${a.name}`, title: a.name, subtitle: a.listeners ? `${Number(a.listeners).toLocaleString()} listeners` : "Artist", image: a.image, round: true, href: a.url })) });
    } catch {
      /* optional shelf */
    }
  }
  return shelves;
}
