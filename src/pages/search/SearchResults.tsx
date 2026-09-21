import { useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useLibrary } from "@/app/context/LibraryContext";
import { usePlayback } from "@/app/context/PlaybackContext";
import { useFavorites } from "@/app/context/FavoritesContext";
import { formatDuration } from "@/lib/formatDuration";
import { HeartIcon, PlaygroundIcon } from "@/app/layout/icons";
import { parseSearchQuery } from "./parseSearchQuery";
import "./SearchResults.css";

export function SearchResults() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { tracks } = useLibrary();
  const { playTrack } = usePlayback();
  const { isFavorite, toggleFavorite } = useFavorites();

  const query = params.get("q") ?? "";
  const parsed = parseSearchQuery(query);

  // Everything except an explicit @music:/@all search still returns local
  // results — narrowing to just YouTube or just a specific online service is
  // next-update work, noted below, not implemented yet.
  const isLocalSearch = parsed.scope === "all" || parsed.scope === "music";

  const results = useMemo(() => {
    if (!isLocalSearch || !parsed.term.trim()) return [];
    const needle = parsed.term.trim().toLowerCase();
    return tracks.filter((t) => `${t.title} ${t.artist} ${t.album}`.toLowerCase().includes(needle));
  }, [tracks, parsed, isLocalSearch]);

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

      {!isLocalSearch ? (
        <p className="search-results__empty">
          {parsed.scope} search isn't implemented yet — this update only covers your local
          library. Try a plain search, or @music: your-search, for now.
        </p>
      ) : results.length === 0 ? (
        <p className="search-results__empty">
          {parsed.term.trim() ? `No local tracks match "${parsed.term}".` : "Type something to search your library."}
        </p>
      ) : (
        <div className="search-results__list">
          {results.map((track) => (
            <div key={track.id} className="search-results__track" onDoubleClick={() => playTrack(track, results)}>
              <button type="button" onClick={() => playTrack(track, results)}>
                <PlaygroundIcon />
              </button>
              <span className="search-results__track-title">{track.title}</span>
              <span>{track.artist}</span>
              <span>{track.album}</span>
              <span>{formatDuration(track.duration)}</span>
              <button
                type="button"
                data-active={isFavorite(track.id)}
                onClick={() => toggleFavorite(track.id)}
                aria-label="Toggle favorite"
              >
                <HeartIcon />
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="search-results__upnext">
        <h2>Coming in a future update</h2>
        <ul>
          <li>@youtube: search + video-to-audio conversion</li>
          <li>@online-&lt;service&gt;: routed queries per connected service</li>
          <li>@imdb: and @genius: metadata/lyrics lookups</li>
        </ul>
      </div>
    </div>
  );
}
