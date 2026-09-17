import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useLibrary } from "@/app/context/LibraryContext";
import { usePlayback } from "@/app/context/PlaybackContext";
import { useFavorites } from "@/app/context/FavoritesContext";
import { usePlaylists } from "@/app/context/PlaylistsContext";
import { formatDuration } from "@/lib/formatDuration";
import { Tooltip } from "@/app/components/Tooltip";
import { SkeletonRows } from "@/app/components/Skeleton";
import {
  CheckSquareIcon,
  FilterIcon,
  HeartIcon,
  PinIcon,
  PlaygroundIcon,
  RefreshIcon,
  SortAscIcon,
  SortDescIcon,
} from "@/app/layout/icons";
import type { Track } from "@/lib/types";
import "./Local.css";

type SortKey = "title" | "artist" | "album" | "duration";
type SortDir = "asc" | "desc";

export function Local() {
  const { tracks, scanning, ready, rescan } = useLibrary();
  const { playTrack, currentTrack, isPlaying } = usePlayback();
  const { isFavorite, toggleFavorite } = useFavorites();
  const { playlists, addTrack } = usePlaylists();

  const [sortKey, setSortKey] = useState<SortKey>("title");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [pinnedSort, setPinnedSort] = useState(false);
  const [query, setQuery] = useState("");
  const [filterOpen, setFilterOpen] = useState(false);
  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [addToPlaylistOpen, setAddToPlaylistOpen] = useState(false);

  const visibleTracks = useMemo(() => {
    const filtered = query.trim()
      ? tracks.filter((t) => `${t.title} ${t.artist} ${t.album}`.toLowerCase().includes(query.trim().toLowerCase()))
      : tracks;
    const sorted = [...filtered].sort((a, b) => {
      if (sortKey === "duration") return a.duration - b.duration;
      return a[sortKey].localeCompare(b[sortKey]);
    });
    return sortDir === "asc" ? sorted : sorted.reverse();
  }, [tracks, sortKey, sortDir, query]);

  const onPlay = (track: Track) => playTrack(track, visibleTracks);

  const toggleSelected = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const selectAll = () => setSelected(new Set(visibleTracks.map((t) => t.id)));
  const clearSelection = () => setSelected(new Set());

  if (!ready || (tracks.length === 0 && scanning)) {
    return (
      <div className="local-page">
        <div className="local-page__header">
          <h1>Local</h1>
        </div>
        <SkeletonRows count={8} />
      </div>
    );
  }

  if (tracks.length === 0) {
    return (
      <div className="local-page__empty">
        <h1>Local</h1>
        <p>
          No local music found yet. Add a watched folder from <Link to="/folder">Folders</Link> to get
          started.
        </p>
      </div>
    );
  }

  return (
    <div className="local-page">
      <div className="local-page__header">
        <h1>Local Songs</h1>
        <div className="local-page__toolbar">
          {filterOpen && (
            <input
              type="text"
              className="local-page__filter"
              placeholder="Filter this list…"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              autoFocus
            />
          )}
          <Tooltip label="Filter" side="bottom">
            <button type="button" data-active={filterOpen} onClick={() => setFilterOpen((v) => !v)}>
              <FilterIcon />
            </button>
          </Tooltip>
          <Tooltip label={sortDir === "asc" ? "Sort ascending" : "Sort descending"} side="bottom">
            <button type="button" onClick={() => setSortDir((d) => (d === "asc" ? "desc" : "asc"))}>
              {sortDir === "asc" ? <SortAscIcon /> : <SortDescIcon />}
            </button>
          </Tooltip>
          <Tooltip label="Pin this sort" side="bottom">
            <button type="button" data-active={pinnedSort} onClick={() => setPinnedSort((v) => !v)}>
              <PinIcon />
            </button>
          </Tooltip>
          <Tooltip label="Select" side="bottom">
            <button
              type="button"
              data-active={selectMode}
              onClick={() => {
                setSelectMode((v) => !v);
                clearSelection();
              }}
            >
              <CheckSquareIcon />
            </button>
          </Tooltip>
          <Tooltip label="Rescan" side="bottom">
            <button type="button" data-spinning={scanning} onClick={() => void rescan()}>
              <RefreshIcon />
            </button>
          </Tooltip>
        </div>
      </div>

      {selectMode && (
        <div className="local-page__selection-bar">
          <span>{selected.size} selected</span>
          <button type="button" onClick={selectAll}>
            Select all
          </button>
          <button type="button" onClick={clearSelection}>
            Clear
          </button>
          <div className="local-page__add-to-playlist">
            <button type="button" disabled={selected.size === 0} onClick={() => setAddToPlaylistOpen((v) => !v)}>
              Add to playlist
            </button>
            {addToPlaylistOpen && (
              <div className="local-page__playlist-dropdown">
                {playlists.length === 0 ? (
                  <span className="local-page__playlist-empty">No playlists yet — create one in Library.</span>
                ) : (
                  playlists.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => {
                        selected.forEach((id) => addTrack(p.id, id));
                        setAddToPlaylistOpen(false);
                      }}
                    >
                      {p.name}
                    </button>
                  ))
                )}
              </div>
            )}
          </div>
        </div>
      )}

      <div className="local-page__table" role="table">
        <div className="local-page__row local-page__row--head" role="row" data-select-mode={selectMode}>
          {selectMode && <span />}
          <span />
          <button type="button" onClick={() => setSortKey("title")} data-active={sortKey === "title"}>
            Song
          </button>
          <button type="button" onClick={() => setSortKey("artist")} data-active={sortKey === "artist"}>
            Artist
          </button>
          <button type="button" onClick={() => setSortKey("album")} data-active={sortKey === "album"}>
            Album
          </button>
          <button type="button" onClick={() => setSortKey("duration")} data-active={sortKey === "duration"}>
            Duration
          </button>
          <span />
        </div>

        {visibleTracks.map((track) => {
          const active = currentTrack?.id === track.id;
          return (
            <div
              key={track.id}
              className="local-page__row"
              role="row"
              data-active={active}
              data-select-mode={selectMode}
              onDoubleClick={() => onPlay(track)}
            >
              {selectMode && (
                <input
                  type="checkbox"
                  checked={selected.has(track.id)}
                  onChange={() => toggleSelected(track.id)}
                  aria-label={`Select ${track.title}`}
                />
              )}
              <button type="button" className="local-page__play" onClick={() => onPlay(track)}>
                <PlaygroundIcon />
              </button>
              <span className="local-page__title">
                {track.title}
                {active && isPlaying && <span className="local-page__now-playing">Playing</span>}
              </span>
              <span>{track.artist}</span>
              <span>{track.album}</span>
              <span>{formatDuration(track.duration)}</span>
              <button
                type="button"
                className="local-page__favorite"
                data-active={isFavorite(track.id)}
                onClick={() => toggleFavorite(track.id)}
                aria-label="Toggle favorite"
              >
                <HeartIcon />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
