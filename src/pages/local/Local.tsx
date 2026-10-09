import { Fragment, useMemo, useState, type DragEvent } from "react";
import { Link } from "react-router-dom";
import { useLibrary } from "@/app/context/LibraryContext";
import { usePlayback } from "@/app/context/PlaybackContext";
import { useFavorites } from "@/app/context/FavoritesContext";
import { usePlaylists } from "@/app/context/PlaylistsContext";
import { useNotifications } from "@/app/context/NotificationsContext";
import { useApiPromotions, promotionSlots } from "@/app/context/PromotionsContext";
import { PromotionRow } from "@/app/components/Promotion";
import { usePersistentState } from "@/lib/usePersistentState";
import { formatDuration } from "@/lib/formatDuration";
import { Tooltip } from "@/app/components/Tooltip";
import { SkeletonRows } from "@/app/components/Skeleton";
import {
  CheckSquareIcon,
  FilterIcon,
  GridIcon,
  HeartIcon,
  ListIcon,
  PinIcon,
  PlayIcon,
  PlaygroundIcon,
  RefreshIcon,
  SortAscIcon,
  SortDescIcon,
} from "@/app/layout/icons";
import type { Track } from "@/lib/types";
import "./Local.css";

type SortKey = "title" | "artist" | "album" | "duration" | "custom";
type SortDir = "asc" | "desc";
type ViewStyle = "list" | "art" | "grid";

const MAX_PINS = 10;

/**
 * What a music-player filter is for: narrowing a big library to the slice you
 * want right now, without changing the library itself. Text search (scoped to a
 * field), artist, album, track length, file format, "has cover art" and
 * "favorites only" — all combinable, all reset in one click.
 */
interface Filters {
  query: string;
  scope: "all" | "title" | "artist" | "album";
  artist: string;
  album: string;
  length: "any" | "short" | "medium" | "long";
  format: string;
  artworkOnly: boolean;
  favoritesOnly: boolean;
}

const NO_FILTERS: Filters = {
  query: "",
  scope: "all",
  artist: "",
  album: "",
  length: "any",
  format: "any",
  artworkOnly: false,
  favoritesOnly: false,
};

function extOf(path: string) {
  const dot = path.lastIndexOf(".");
  return dot === -1 ? "" : path.slice(dot + 1).toLowerCase();
}

function activeFilterCount(f: Filters) {
  return [f.query.trim(), f.artist, f.album, f.length !== "any", f.format !== "any", f.artworkOnly, f.favoritesOnly].filter(Boolean).length;
}

export function Local() {
  const { tracks, scanning, ready, rescan } = useLibrary();
  const { playTrack, currentTrack, isPlaying } = usePlayback();
  const { isFavorite, toggleFavorite, favoriteIds } = useFavorites();
  const { playlists, addTracks, createPlaylist } = usePlaylists();
  const { push } = useNotifications();
  const promos = useApiPromotions("local");

  const [sortKey, setSortKey] = usePersistentState<SortKey>("local.sortKey", "title");
  const [sortDir, setSortDir] = usePersistentState<SortDir>("local.sortDir", "asc");
  const [viewStyle, setViewStyle] = usePersistentState<ViewStyle>("local.viewStyle", "list");
  const [filters, setFilters] = usePersistentState<Filters>("local.filters", NO_FILTERS);
  const [pinnedIds, setPinnedIds] = usePersistentState<string[]>("local.pinned", []);
  const [customOrder, setCustomOrder] = usePersistentState<string[]>("local.customOrder", []);

  const [filterOpen, setFilterOpen] = useState(false);
  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [addToPlaylistOpen, setAddToPlaylistOpen] = useState(false);
  const [dragId, setDragId] = useState<string | null>(null);
  const [dropTargetId, setDropTargetId] = useState<string | null>(null);

  const patchFilters = (patch: Partial<Filters>) => setFilters((prev) => ({ ...prev, ...patch }));

  const artistOptions = useMemo(() => [...new Set(tracks.map((t) => t.artist))].sort((a, b) => a.localeCompare(b)), [tracks]);
  const albumOptions = useMemo(() => [...new Set(tracks.map((t) => t.album))].sort((a, b) => a.localeCompare(b)), [tracks]);
  const formatOptions = useMemo(() => [...new Set(tracks.map((t) => extOf(t.path)).filter(Boolean))].sort(), [tracks]);

  const visibleTracks = useMemo(() => {
    const q = filters.query.trim().toLowerCase();
    const filtered = tracks.filter((t) => {
      if (q) {
        const haystack =
          filters.scope === "all" ? `${t.title} ${t.artist} ${t.album}` : filters.scope === "title" ? t.title : filters.scope === "artist" ? t.artist : t.album;
        if (!haystack.toLowerCase().includes(q)) return false;
      }
      if (filters.artist && t.artist !== filters.artist) return false;
      if (filters.album && t.album !== filters.album) return false;
      if (filters.length === "short" && t.duration >= 180) return false;
      if (filters.length === "medium" && (t.duration < 180 || t.duration > 300)) return false;
      if (filters.length === "long" && t.duration <= 300) return false;
      if (filters.format !== "any" && extOf(t.path) !== filters.format) return false;
      if (filters.artworkOnly && !t.artworkUrl) return false;
      if (filters.favoritesOnly && !favoriteIds.has(t.id)) return false;
      return true;
    });

    let sorted: Track[];
    if (sortKey === "custom") {
      const rank = new Map(customOrder.map((id, i) => [id, i]));
      sorted = [...filtered].sort((a, b) => (rank.get(a.id) ?? Infinity) - (rank.get(b.id) ?? Infinity));
    } else {
      sorted = [...filtered].sort((a, b) => (sortKey === "duration" ? a.duration - b.duration : a[sortKey].localeCompare(b[sortKey])));
      if (sortDir === "desc") sorted.reverse();
    }

    // Pinned tracks always float to the top, in the order they were pinned.
    const pinRank = new Map(pinnedIds.map((id, i) => [id, i]));
    const pinned = sorted.filter((t) => pinRank.has(t.id)).sort((a, b) => pinRank.get(a.id)! - pinRank.get(b.id)!);
    const rest = sorted.filter((t) => !pinRank.has(t.id));
    return [...pinned, ...rest];
  }, [tracks, filters, sortKey, sortDir, customOrder, pinnedIds, favoriteIds]);

  const onPlay = (track: Track) => playTrack(track, visibleTracks);

  const togglePin = (track: Track) => {
    if (pinnedIds.includes(track.id)) {
      setPinnedIds((prev) => prev.filter((id) => id !== track.id));
      return;
    }
    if (pinnedIds.length >= MAX_PINS) {
      push("Pin limit reached", `You can pin up to ${MAX_PINS} tracks — unpin one first.`);
      return;
    }
    setPinnedIds((prev) => [...prev, track.id]);
  };

  const toggleSelected = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const selectAll = () => setSelected(new Set(visibleTracks.map((t) => t.id)));
  const clearSelection = () => setSelected(new Set());

  // Selection in the order it's shown on screen, so "Play selected" follows the list.
  const selectedTracks = useMemo(() => visibleTracks.filter((t) => selected.has(t.id)), [visibleTracks, selected]);

  const playSelected = () => {
    if (selectedTracks.length === 0) return;
    playTrack(selectedTracks[0], selectedTracks);
    push("Playing selection", `${selectedTracks.length} selected track${selectedTracks.length === 1 ? "" : "s"} queued.`);
  };

  const addSelectedToPlaylist = (playlistId: string, name: string) => {
    const added = addTracks(playlistId, selectedTracks.map((t) => t.id));
    setAddToPlaylistOpen(false);
    push("Added to playlist", `${added} of ${selectedTracks.length} selected track${selectedTracks.length === 1 ? "" : "s"} added to “${name}”.`);
  };

  const createAndAdd = () => {
    const name = window.prompt("New playlist name");
    if (!name?.trim()) return;
    const playlist = createPlaylist(name.trim());
    addSelectedToPlaylist(playlist.id, playlist.name);
  };

  // --- drag & drop reordering (persisted) -----------------------------------
  const onDragStart = (event: DragEvent, id: string) => {
    setDragId(id);
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", id);
  };
  const onDrop = (targetId: string) => {
    if (!dragId || dragId === targetId) return;
    const order = visibleTracks.map((t) => t.id);
    const without = order.filter((id) => id !== dragId);
    const at = without.indexOf(targetId);
    without.splice(at === -1 ? without.length : at, 0, dragId);
    const rest = customOrder.filter((id) => !without.includes(id));
    setCustomOrder([...without, ...rest]);
    setSortKey("custom");
    setDragId(null);
    setDropTargetId(null);
  };

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

  const filterCount = activeFilterCount(filters);
  const slots = promotionSlots(visibleTracks.length, promos.length);
  const pinnedSet = new Set(pinnedIds);

  const renderTrack = (track: Track) => {
    const active = currentTrack?.id === track.id;
    const isSelected = selected.has(track.id);
    return (
      <div
        key={track.id}
        className="local-page__row"
        role="row"
        data-active={active}
        data-selected={isSelected}
        data-select-mode={selectMode}
        data-dragging={dragId === track.id}
        data-drop-target={dropTargetId === track.id}
        draggable
        onDragStart={(e) => onDragStart(e, track.id)}
        onDragOver={(e) => {
          e.preventDefault();
          if (dropTargetId !== track.id) setDropTargetId(track.id);
        }}
        onDragLeave={() => setDropTargetId((id) => (id === track.id ? null : id))}
        onDrop={() => onDrop(track.id)}
        onDragEnd={() => {
          setDragId(null);
          setDropTargetId(null);
        }}
        onDoubleClick={() => (selectMode ? toggleSelected(track.id) : onPlay(track))}
      >
        {selectMode && (
          <input type="checkbox" checked={isSelected} onChange={() => toggleSelected(track.id)} aria-label={`Select ${track.title}`} />
        )}
        <button type="button" className="local-page__play" onClick={() => onPlay(track)} aria-label={`Play ${track.title}`}>
          {viewStyle === "art" ? (
            <span className="local-page__thumb">
              {track.artworkUrl ? <img src={track.artworkUrl} alt="" loading="lazy" /> : <PlaygroundIcon />}
              <span className="local-page__thumb-play">
                <PlayIcon />
              </span>
            </span>
          ) : (
            <PlaygroundIcon />
          )}
        </button>
        <span className="local-page__title">
          {pinnedSet.has(track.id) && <PinIcon className="local-page__pinned-mark" />}
          {track.title}
          {active && isPlaying && <span className="local-page__now-playing">Playing</span>}
        </span>
        <span>{track.artist}</span>
        <span>{track.album}</span>
        <span>{formatDuration(track.duration)}</span>
        <span className="local-page__actions">
          <button
            type="button"
            className="local-page__pin"
            data-active={pinnedSet.has(track.id)}
            onClick={() => togglePin(track)}
            aria-label={pinnedSet.has(track.id) ? "Unpin" : "Pin to top"}
            title={pinnedSet.has(track.id) ? "Unpin" : `Pin to top (${pinnedIds.length}/${MAX_PINS})`}
          >
            <PinIcon />
          </button>
          <button
            type="button"
            className="local-page__favorite"
            data-active={isFavorite(track.id)}
            onClick={() => toggleFavorite(track.id)}
            aria-label="Toggle favorite"
          >
            <HeartIcon />
          </button>
        </span>
      </div>
    );
  };

  return (
    <div className="local-page" data-view={viewStyle}>
      <div className="local-page__header">
        <h1>Local Songs</h1>
        <div className="local-page__toolbar">
          <Tooltip label="View style" side="bottom">
            <button
              type="button"
              onClick={() => setViewStyle((v) => (v === "list" ? "art" : v === "art" ? "grid" : "list"))}
              aria-label={`View style: ${viewStyle}`}
            >
              {viewStyle === "grid" ? <GridIcon /> : <ListIcon />}
              <span className="local-page__view-label">{viewStyle === "list" ? "List" : viewStyle === "art" ? "Album art" : "Grid"}</span>
            </button>
          </Tooltip>
          <Tooltip label={filterCount ? `Filter (${filterCount} active)` : "Filter"} side="bottom">
            <button type="button" data-active={filterOpen || filterCount > 0} onClick={() => setFilterOpen((v) => !v)}>
              <FilterIcon />
              {filterCount > 0 && <span className="local-page__badge">{filterCount}</span>}
            </button>
          </Tooltip>
          <Tooltip label={sortDir === "asc" ? "Sort ascending" : "Sort descending"} side="bottom">
            <button type="button" onClick={() => setSortDir((d) => (d === "asc" ? "desc" : "asc"))} disabled={sortKey === "custom"}>
              {sortDir === "asc" ? <SortAscIcon /> : <SortDescIcon />}
            </button>
          </Tooltip>
          <Tooltip label={`Pinned ${pinnedIds.length}/${MAX_PINS} — pin a track to keep it at the top`} side="bottom">
            <button type="button" data-active={pinnedIds.length > 0} onClick={() => pinnedIds.length > 0 && setPinnedIds([])}>
              <PinIcon />
            </button>
          </Tooltip>
          <Tooltip label={selectMode ? "Exit select mode" : "Select"} side="bottom">
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

      {filterOpen && (
        <div className="local-page__filter-panel">
          <div className="local-page__filter-row">
            <input
              type="text"
              className="local-page__filter"
              placeholder="Search…"
              value={filters.query}
              onChange={(e) => patchFilters({ query: e.target.value })}
              autoFocus
            />
            <select value={filters.scope} onChange={(e) => patchFilters({ scope: e.target.value as Filters["scope"] })} aria-label="Search in">
              <option value="all">Everything</option>
              <option value="title">Title</option>
              <option value="artist">Artist</option>
              <option value="album">Album</option>
            </select>
            <select value={filters.artist} onChange={(e) => patchFilters({ artist: e.target.value })} aria-label="Artist">
              <option value="">Any artist</option>
              {artistOptions.slice(0, 500).map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>
            <select value={filters.album} onChange={(e) => patchFilters({ album: e.target.value })} aria-label="Album">
              <option value="">Any album</option>
              {albumOptions.slice(0, 500).map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>
          </div>
          <div className="local-page__filter-row">
            <select value={filters.length} onChange={(e) => patchFilters({ length: e.target.value as Filters["length"] })} aria-label="Length">
              <option value="any">Any length</option>
              <option value="short">Under 3 min</option>
              <option value="medium">3–5 min</option>
              <option value="long">Over 5 min</option>
            </select>
            <select value={filters.format} onChange={(e) => patchFilters({ format: e.target.value })} aria-label="Format">
              <option value="any">Any format</option>
              {formatOptions.map((f) => (
                <option key={f} value={f}>
                  {f.toUpperCase()}
                </option>
              ))}
            </select>
            <label className="local-page__check">
              <input type="checkbox" checked={filters.artworkOnly} onChange={(e) => patchFilters({ artworkOnly: e.target.checked })} />
              Has album art
            </label>
            <label className="local-page__check">
              <input type="checkbox" checked={filters.favoritesOnly} onChange={(e) => patchFilters({ favoritesOnly: e.target.checked })} />
              Favorites only
            </label>
            <button type="button" className="local-page__reset" disabled={filterCount === 0} onClick={() => setFilters(NO_FILTERS)}>
              Reset
            </button>
            <span className="local-page__result-count">
              {visibleTracks.length} of {tracks.length}
            </span>
          </div>
        </div>
      )}

      {selectMode && (
        <div className="local-page__selection-bar">
          <span>{selected.size} selected</span>
          <button type="button" onClick={selectAll}>
            Select all
          </button>
          <button type="button" onClick={clearSelection}>
            Clear
          </button>
          <button type="button" className="local-page__primary" disabled={selected.size === 0} onClick={playSelected}>
            Play selected
          </button>
          <div className="local-page__add-to-playlist">
            <button type="button" disabled={selected.size === 0} onClick={() => setAddToPlaylistOpen((v) => !v)}>
              Add {selected.size > 0 ? selected.size : ""} to playlist
            </button>
            {addToPlaylistOpen && (
              <div className="local-page__playlist-dropdown">
                <button type="button" onClick={createAndAdd}>
                  + New playlist…
                </button>
                {playlists.length === 0 ? (
                  <span className="local-page__playlist-empty">No playlists yet.</span>
                ) : (
                  playlists.map((p) => (
                    <button key={p.id} type="button" onClick={() => addSelectedToPlaylist(p.id, p.name)}>
                      {p.name}
                    </button>
                  ))
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {viewStyle === "grid" ? (
        <div className="local-page__grid">
          {visibleTracks.map((track) => {
            const isSelected = selected.has(track.id);
            return (
              <button
                key={track.id}
                type="button"
                className="local-page__card"
                data-active={currentTrack?.id === track.id}
                data-selected={isSelected}
                onClick={() => (selectMode ? toggleSelected(track.id) : onPlay(track))}
              >
                <span className="local-page__card-art">
                  {track.artworkUrl ? <img src={track.artworkUrl} alt="" loading="lazy" /> : <PlaygroundIcon />}
                  {pinnedSet.has(track.id) && <PinIcon className="local-page__card-pin" />}
                </span>
                <span className="local-page__card-title">{track.title}</span>
                <span className="local-page__card-artist">{track.artist}</span>
              </button>
            );
          })}
        </div>
      ) : (
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
            <button type="button" onClick={() => setSortKey("custom")} data-active={sortKey === "custom"} title="Your own drag-and-drop order">
              Custom
            </button>
          </div>

          {visibleTracks.map((track, index) => (
            <Fragment key={track.id}>
              {slots.includes(index) && <PromotionRow promotion={promos[slots.indexOf(index)]} variant="local" />}
              {renderTrack(track)}
            </Fragment>
          ))}
        </div>
      )}
    </div>
  );
}
