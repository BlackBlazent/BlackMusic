import { useEffect, useMemo, useRef, useState } from "react";
import { useLibrary } from "@/app/context/LibraryContext";
import { useFavorites } from "@/app/context/FavoritesContext";
import { usePlaylists } from "@/app/context/PlaylistsContext";
import { usePlaybackHistory } from "@/app/context/PlaybackHistoryContext";
import { usePlayback } from "@/app/context/PlaybackContext";
import { usePersistentState } from "@/lib/usePersistentState";
import { useLifetimeStats } from "@/lib/library/stats";
import { useTracksWithExtras } from "@/lib/library/trackExtras";
import { cachedArtistCountry, codeFromName, flagEmoji, regionName, resolveArtistCountry } from "@/lib/library/artistCountry";
import { mostPlayed } from "./homeStats";
import { badgeStatsFrom, computeBadges } from "./badges";
import { formatDuration } from "@/lib/formatDuration";
import type { Track } from "@/lib/types";
import "./BadgesAndCountries.css";

/** IMP-03 — badges earned from the same stats the Folder page shows (size, tags edited, playlists, pins, favorites, plays). */
export function BadgesSection() {
  const { tracks } = useLibrary();
  const { favoriteIds } = useFavorites();
  const { playlists } = usePlaylists();
  const { events } = usePlaybackHistory();
  const { editedMetadata } = useLifetimeStats();
  const [pinned] = usePersistentState<string[]>("local.pinned", []);

  const { earned, next } = useMemo(
    () => computeBadges(badgeStatsFrom(tracks, { pinned: pinned.length, playlists: playlists.length, favorites: favoriteIds.size, plays: events.length, editedMetadata })),
    [tracks, pinned, playlists, favoriteIds, events, editedMetadata],
  );

  return (
    <section className="home-badges" aria-label="Badges">
      <h2>Badges</h2>
      <div className="home-badges__grid">
        {earned.map((b) => (
          <div key={b.id} className="home-badge" data-earned="true" title={b.how}>
            <span className="home-badge__emoji" aria-hidden>
              <img src={b.image || "/images/badges/placeholder.png"} alt=""/>
              {/*{b.emoji}*/}
            </span>
            <strong>{b.title}{b.emoji}</strong>
            <small>{b.how}</small>
          </div>
        ))}
        {next.map((b) => (
          <div key={b.id} className="home-badge" data-earned="false" title={`Next: ${b.how}`}>
            <span className="home-badge__emoji" aria-hidden>
              <img src={b.image || "/images/badges/placeholder.png"} alt=""/>
              {/*{b.emoji}*/}
            </span>
            <strong>{b.title}{b.emoji}</strong>
            <small>{b.how}</small>
            <span className="home-badge__bar"><i style={{ width: `${Math.min(100, (b.value / b.target) * 100)}%` }} /></span>
          </div>
        ))}
      </div>
      {earned.length === 0 && <p className="home-badges__hint">Keep listening, pinning and organizing — your first badge is close.</p>}
    </section>
  );
}

const MIN_SONGS = 5;
const MAX_COUNTRIES = 3;
const MAX_LOOKUPS = 40;

/**
 * FEAT-02 — Music by country. From the user's most played songs: find each artist's country of origin (a country typed
 * in Edit metadata wins; otherwise MusicBrainz, cached on-device), pick the top countries, then show at least five
 * library songs from each. Lookups run slowly in the background (MusicBrainz allows ~1 request/second).
 */
export function CountriesSection() {
  const { tracks: libraryTracks } = useLibrary();
  const tracks = useTracksWithExtras(libraryTracks);
  const { events } = usePlaybackHistory();
  const { playTrack } = usePlayback();
  const [codes, setCodes] = useState<Map<string, string | null>>(new Map()); // artist(lower) -> ISO code
  const [working, setWorking] = useState(false);
  const started = useRef(false);

  const top = useMemo(() => mostPlayed(events, tracks, 30).map((e) => e.track), [events, tracks]);

  const codeOf = (t: Track): string | null | undefined => {
    if (t.country) return codeFromName(t.country);
    return codes.get(t.artist.toLowerCase());
  };

  useEffect(() => {
    if (started.current || tracks.length === 0) return;
    started.current = true;
    let alive = true;
    (async () => {
      setWorking(true);
      const queue: string[] = [];
      const seen = new Set<string>();
      const add = (t: Track) => {
        const a = t.artist;
        if (!a || a === "Unknown artist" || t.country || seen.has(a.toLowerCase())) return;
        seen.add(a.toLowerCase());
        queue.push(a);
      };
      top.forEach(add); // most played first, then the rest of the library by artist frequency
      const freq = new Map<string, number>();
      tracks.forEach((t) => freq.set(t.artist, (freq.get(t.artist) ?? 0) + 1));
      [...freq.entries()].sort((a, b) => b[1] - a[1]).forEach(([a]) => add({ artist: a } as Track));

      let lookups = 0;
      for (const artist of queue) {
        if (!alive) return;
        const cached = await cachedArtistCountry(artist);
        let code: string | null | undefined = cached;
        if (cached === undefined) {
          if (lookups >= MAX_LOOKUPS) continue;
          lookups++;
          code = await resolveArtistCountry(artist);
        }
        if (!alive) return;
        setCodes((prev) => new Map(prev).set(artist.toLowerCase(), code ?? null));
      }
      if (alive) setWorking(false);
    })();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run once per mount, when the library is ready
  }, [tracks.length > 0]);

  const cards = useMemo(() => {
    // Rank countries by how much of the user's MOST PLAYED music comes from them.
    const weight = new Map<string, number>();
    top.forEach((t) => {
      const c = codeOf(t);
      if (c) weight.set(c, (weight.get(c) ?? 0) + 1);
    });
    const ranked = [...weight.entries()].sort((a, b) => b[1] - a[1]).slice(0, MAX_COUNTRIES).map(([c]) => c);
    return ranked.map((code) => {
      const fromTop = top.filter((t) => codeOf(t) === code);
      const rest = tracks.filter((t) => codeOf(t) === code && !fromTop.includes(t));
      return { code, songs: [...fromTop, ...rest].slice(0, Math.max(MIN_SONGS, 6)), total: fromTop.length + rest.length };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [top, tracks, codes]);

  if (cards.length === 0) {
    return working ? (
      <section className="home-countries"><h2>Music by country</h2><p className="home-badges__hint">Finding where your favorite artists come from…</p></section>
    ) : null; // nothing resolved (offline or no origin data): hide instead of showing an empty card
  }

  return (
    <section className="home-countries" aria-label="Music by country">
      <h2>Music by country</h2>
      <div className="home-countries__grid">
        {cards.map(({ code, songs, total }) => (
          <article key={code} className="home-country">
            <header>
              <span aria-hidden>{flagEmoji(code)}</span>
              <h3>{regionName(code)}</h3>
              <span aria-hidden>🎵</span>
            </header>
            <ol>
              {songs.map((t) => (
                <li key={t.id}>
                  <button type="button" onClick={() => playTrack(t, songs)} title={`Play ${t.title}`}>
                    <span className="home-country__title">{t.title}</span>
                    <span className="home-country__meta">{t.artist} · {formatDuration(t.duration)}</span>
                  </button>
                </li>
              ))}
            </ol>
            {total < MIN_SONGS && <small className="home-country__note">Only {total} from here so far — add a country in Edit metadata to place more songs.</small>}
          </article>
        ))}
      </div>
    </section>
  );
}
