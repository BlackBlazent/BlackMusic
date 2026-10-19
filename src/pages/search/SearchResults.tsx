import { useEffect, useMemo, useState } from "react";
import { openUrl } from "@tauri-apps/plugin-opener";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useLibrary } from "@/app/context/LibraryContext";
import { usePlayback } from "@/app/context/PlaybackContext";
import { useFavorites } from "@/app/context/FavoritesContext";
import { formatDuration } from "@/lib/formatDuration";
import { HeartIcon, PlaygroundIcon } from "@/app/layout/icons";
import type { Track } from "@/lib/types";
import { isSpotifyTrackId } from "@/lib/services/spotifyPlayerBridge";
import { parseSearchQuery } from "./parseSearchQuery";
import { runSearch, type SearchPayload } from "./searchProviders";
import "./SearchResults.css";

const PAGE_TARGETS: Record<string, string> = {
  home: "/", playground: "/playground", local: "/local", online: "/online", library: "/library", folder: "/folder", folders: "/folder", settings: "/settings",
};

function SponsoredRows() {
  return (
    <>
          <div
          className="search-results__track"
          role="link"
          tabIndex={0}
          onClick={() => {
            console.log("PROMOTION CLICKED");
            openUrl("https://invl.us/clo2glg");
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              openUrl("https://invl.us/clo2glg");
            }
          }}
        >
          <img
            src="https://img.involve.asia/ia_logo/5003_VnJg2MpW.jpg"
            alt="promotion"
          />
        
          <span className="search-results__track-title">
            LightPDF - AI-Powered PDF
          </span>
        
          <span>Simplify Every Step of Your Document Workflow</span>
        
          <span>Sponsored</span>
          <span></span>
        
          <button
            type="button"
            aria-label="Toggle favorite"
            onClick={(e) => {
              e.stopPropagation();
              // favorite logic
            }}
          >
            <HeartIcon />
          </button>
        </div>

        <div
          className="search-results__track"
          role="link"
          tabIndex={0}
          onClick={() => {
            console.log("PROMOTION CLICKED");
            openUrl("https://invl.me/clo2q6n");
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              openUrl("https://invl.me/clo2q6n");
            }
          }}
        >
          <img
            src="https://img.involve.asia/ia_logo/4440_NYReR4XZ.png"
            alt="promotion"
          />
        
          <span className="search-results__track-title">
            Proton VPN - Take control of your data with end-to-end encryption.
          </span>
        
          <span>A better internet starts with privacy and freedom</span>
        
          <span>Sponsored</span>
          <span></span>
        
          <button
            type="button"
            aria-label="Toggle favorite"
            onClick={(e) => {
              e.stopPropagation();
              // favorite logic
            }}
          >
            <HeartIcon />
          </button>
        </div>
            
    </>
  );
}

function TrackRows({ tracks, onPlay, playable }: { tracks: Track[]; onPlay: (t: Track) => void; playable: (t: Track) => boolean }) {
  const { isFavorite, toggleFavorite } = useFavorites();
  return (
    <div className="search-results__list">
      {tracks.map((track) => {
        const ok = playable(track);
        return (
          <div key={track.id} className="search-results__track" data-unplayable={!ok} onDoubleClick={() => ok && onPlay(track)}>
            <button type="button" disabled={!ok} onClick={() => ok && onPlay(track)} aria-label={`Play ${track.title}`}>
              {track.artworkUrl ? <img src={track.artworkUrl} alt="" loading="lazy" /> : <PlaygroundIcon />}
            </button>
            <span className="search-results__track-title">{track.title}</span>
            <span>{track.artist}</span>
            <span>{track.album || track.provider || ""}</span>
            <span>{formatDuration(track.duration)}</span>
            <button type="button" data-active={isFavorite(track.id)} onClick={() => toggleFavorite(track.id)} aria-label="Toggle favorite">
              <HeartIcon />
            </button>
          </div>
        );
      })}
    </div>
  );
}

export function SearchResults() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { tracks } = useLibrary();
  const { playTrack } = usePlayback();

  const query = params.get("q") ?? "";
  const parsed = useMemo(() => parseSearchQuery(query), [query]);
  const isLocalSearch = parsed.scope === "all" || parsed.scope === "music";

  const localResults = useMemo(() => {
    if (!isLocalSearch || !parsed.term.trim()) return [];
    const needle = parsed.term.trim().toLowerCase();
    return tracks.filter((t) => `${t.title} ${t.artist} ${t.album}`.toLowerCase().includes(needle));
  }, [tracks, parsed, isLocalSearch]);

  // @page: jumps straight to the named page.
  useEffect(() => {
    if (parsed.scope !== "page") return;
    const target = PAGE_TARGETS[parsed.term.trim().toLowerCase()];
    if (target) navigate(target, { replace: true });
  }, [parsed, navigate]);

  // Remote scopes (@youtube, @online-*, @lastfm, @musicbrainz, @genius)
  const [remote, setRemote] = useState<SearchPayload | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    setRemote(null);
    setError(null);
    if (isLocalSearch || parsed.scope === "page" || parsed.scope === "imdb") return;
    let cancelled = false;
    setLoading(true);
    runSearch(parsed)
      .then((payload) => !cancelled && setRemote(payload))
      .catch((e) => {
        console.error("[search]", parsed.scope, e);
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      })
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [parsed, isLocalSearch]);

  const playable = (t: Track) => Boolean(t.sourceUrl || t.path || t.resolve) || isSpotifyTrackId(t.id);
  const play = (list: Track[]) => (t: Track) => playTrack(t, list.filter(playable));

  return (
    <div className="search-results">
      <button type="button" className="search-results__back" onClick={() => navigate(-1)}>
        ← Back
      </button>

      <h1>Search results</h1>
      <p className="search-results__subtitle">Results for &quot;{query}&quot;.</p>

      <div className="search-results__parsed">
        <span className="search-results__parsed-label">Parsed as</span>
        <code>
          {parsed.scope}: {parsed.term || "—"}
        </code>
      </div>

      {loading && <p className="search-results__empty">Searching…</p>}
      {error && <p className="search-results__empty search-results__error">{error}</p>}

      {parsed.scope === "imdb" && <p className="search-results__empty">@imdb: lookups are reserved for a later release.</p>}
      {parsed.scope === "page" && !PAGE_TARGETS[parsed.term.trim().toLowerCase()] && (
        <p className="search-results__empty">Pages: {Object.keys(PAGE_TARGETS).join(", ")}.</p>
      )}

      {isLocalSearch &&
        (localResults.length === 0 ? (
          <p className="search-results__empty">
            {parsed.term.trim() ? `No local tracks match "${parsed.term}".` : "Type something to search your library."}
          </p>
        ) : (
          <>
            <TrackRows tracks={localResults} onPlay={play(localResults)} playable={playable} />
            <div className="search-results__list">
              <SponsoredRows />
            </div>
          </>
        ))}

      {remote && (
        <>
          {remote.notice && <p className="search-results__notice">{remote.notice}</p>}
          {remote.playbackHint && remote.tracks.length > 0 && <p className="search-results__hint">{remote.playbackHint}</p>}

          {remote.artists.length > 0 && (
            <section className="search-results__section">
              <h2>Artists</h2>
              <div className="search-results__artists">
                {remote.artists.map((a) => (
                  <article key={a.name} className="search-results__artist">
                    {a.image ? <img src={a.image} alt="" loading="lazy" /> : <span className="search-results__artist-ph">{a.name[0]}</span>}
                    <div>
                      <strong>{a.name}</strong>
                      {a.subtitle && <small>{a.subtitle}</small>}
                      {a.tags && a.tags.length > 0 && <small>Tags: {a.tags.slice(0, 5).join(", ")}</small>}
                      {a.similar && a.similar.length > 0 && <small>Similar: {a.similar.slice(0, 5).join(", ")}</small>}
                      {a.bio && <p>{a.bio.slice(0, 220)}{a.bio.length > 220 ? "…" : ""}</p>}
                      {a.url && <button type="button" onClick={() => void openUrl(a.url!)}>Open page</button>}
                    </div>
                  </article>
                ))}
              </div>
            </section>
          )}

          {remote.songs.length > 0 && (
            <section className="search-results__section">
              <h2>Songs on Genius</h2>
              <div className="search-results__list">
                {remote.songs.map((s) => (
                  <div key={s.id} className="search-results__track" role="link" tabIndex={0} onClick={() => void openUrl(s.url)}>
                    {s.thumbnail ? <img src={s.thumbnail} alt="" /> : <PlaygroundIcon />}
                    <span className="search-results__track-title">{s.title}</span>
                    <span>{s.artist}</span>
                    <span>{s.album ?? ""}</span>
                    <span>{s.releaseDate ?? ""}</span>
                    <span />
                  </div>
                ))}
              </div>
            </section>
          )}

          {remote.tracks.length > 0 && (
            <section className="search-results__section">
              <h2>Tracks</h2>
              <TrackRows tracks={remote.tracks} onPlay={play(remote.tracks)} playable={playable} />
            </section>
          )}

          {!loading && remote.tracks.length === 0 && remote.artists.length === 0 && remote.songs.length === 0 && !remote.notice && (
            <p className="search-results__empty">Nothing found for &quot;{parsed.term}&quot;.</p>
          )}
        </>
      )}

      <div className="search-results__upnext">
        <h2>Search syntax</h2>
        <ul>
          <li>@youtube: query — playable videos (audio here, picture on the Playground stage)</li>
          <li>@online-&lt;service&gt;: query — playable results from Spotify, Audius, Tidal, Deezer, Apple, SoundCloud…</li>
          <li>@lastfm: query | tag:rock | similar:Artist — catalog, charts, tags, similar artists</li>
          <li>@musicbrainz: query — recordings and artists · @genius: query — songs, artists, track info</li>
          <li>@music: query (local) · @page: settings (jump to a page)</li>
        </ul>
      </div>
    </div>
  );
}
