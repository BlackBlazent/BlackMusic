import { useMemo, useState } from "react";
import { useLibrary } from "@/app/context/LibraryContext";
import { useFavorites } from "@/app/context/FavoritesContext";
import { usePlayback } from "@/app/context/PlaybackContext";
import { usePlaylists } from "@/app/context/PlaylistsContext";
import { formatDuration } from "@/lib/formatDuration";
import { HeartIcon, LibraryIcon, PinIcon } from "@/app/layout/icons";
import { SkeletonRows } from "@/app/components/Skeleton";
import type { Track } from "@/lib/types";
import "./Library.css";

type View = "all" | "albums" | "artists" | "playlists" | "favorites";

interface Album {
  name: string;
  artist: string;
  tracks: Track[];
}

interface Artist {
  name: string;
  tracks: Track[];
}

export function Library() {
  const { tracks, scanning, ready } = useLibrary();
  const { favoriteIds } = useFavorites();
  const { playTrack } = usePlayback();
  const { playlists, createPlaylist, deletePlaylist, togglePin } = usePlaylists();
  const [view, setView] = useState<View>("all");
  const [openGroup, setOpenGroup] = useState<string | null>(null);
  const [newPlaylistName, setNewPlaylistName] = useState("");

  const albums = useMemo<Album[]>(() => {
    const byAlbum = new Map<string, Album>();
    for (const track of tracks) {
      const key = `${track.album}::${track.artist}`;
      if (!byAlbum.has(key)) byAlbum.set(key, { name: track.album, artist: track.artist, tracks: [] });
      byAlbum.get(key)!.tracks.push(track);
    }
    return [...byAlbum.values()].sort((a, b) => a.name.localeCompare(b.name));
  }, [tracks]);

  const artists = useMemo<Artist[]>(() => {
    const byArtist = new Map<string, Artist>();
    for (const track of tracks) {
      if (!byArtist.has(track.artist)) byArtist.set(track.artist, { name: track.artist, tracks: [] });
      byArtist.get(track.artist)!.tracks.push(track);
    }
    return [...byArtist.values()].sort((a, b) => a.name.localeCompare(b.name));
  }, [tracks]);

  const favoriteTracks = useMemo(
    () => tracks.filter((t) => favoriteIds.has(t.id)),
    [tracks, favoriteIds],
  );

  const trackById = useMemo(() => new Map(tracks.map((t) => [t.id, t])), [tracks]);
  const sortedPlaylists = useMemo(
    () => [...playlists].sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.createdAt - a.createdAt),
    [playlists],
  );

  const onCreatePlaylist = (event: React.FormEvent) => {
    event.preventDefault();
    const name = newPlaylistName.trim();
    if (!name) return;
    createPlaylist(name);
    setNewPlaylistName("");
  };

  return (
    <div className="library-page">
      <div className="library-page__header">
        <h1>Library</h1>
        <div className="library-page__tabs" role="tablist">
          {(["all", "albums", "artists", "playlists", "favorites"] as View[]).map((v) => (
            <button key={v} role="tab" aria-selected={view === v} onClick={() => setView(v)}>
              {v === "all" ? "All music" : v[0].toUpperCase() + v.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {!ready || (scanning && tracks.length === 0) ? (
        <SkeletonRows count={6} />
      ) : (
        <>
          {view === "all" && (
            <TrackList
              tracks={tracks}
              onPlay={(track) => playTrack(track, tracks)}
              empty="Nothing here yet — add a watched folder in Folders."
            />
          )}

          {view === "favorites" && (
            <TrackList
              tracks={favoriteTracks}
              onPlay={(track) => playTrack(track, favoriteTracks)}
              empty="No favorites yet — star a track from Local or Playground."
            />
          )}

          {view === "albums" &&
            (albums.length === 0 ? (
              <p className="library-page__empty-text">No albums found yet.</p>
            ) : (
              <div className="library-page__groups">
                {albums.map((album) => {
                  const key = `album::${album.name}::${album.artist}`;
                  const isOpen = openGroup === key;
                  return (
                    <div key={key} className="group-card" data-open={isOpen}>
                      <button
                        type="button"
                        className="group-card__header"
                        onClick={() => setOpenGroup(isOpen ? null : key)}
                      >
                        <span className="group-card__art">
                          {album.tracks[0]?.artworkUrl ? (
                            <img src={album.tracks[0].artworkUrl} alt="" />
                          ) : (
                            <LibraryIcon />
                          )}
                        </span>
                        <span className="group-card__info">
                          <span className="group-card__name">{album.name}</span>
                          <span className="group-card__sub">{album.artist}</span>
                        </span>
                        <span className="group-card__count">{album.tracks.length}</span>
                      </button>
                      {isOpen && (
                        <TrackList tracks={album.tracks} onPlay={(track) => playTrack(track, album.tracks)} compact />
                      )}
                    </div>
                  );
                })}
              </div>
            ))}

          {view === "artists" &&
            (artists.length === 0 ? (
              <p className="library-page__empty-text">No artists found yet.</p>
            ) : (
              <div className="library-page__groups">
                {artists.map((artist) => {
                  const key = `artist::${artist.name}`;
                  const isOpen = openGroup === key;
                  return (
                    <div key={key} className="group-card" data-open={isOpen}>
                      <button
                        type="button"
                        className="group-card__header"
                        onClick={() => setOpenGroup(isOpen ? null : key)}
                      >
                        <span className="group-card__art group-card__art--round">
                          <LibraryIcon />
                        </span>
                        <span className="group-card__info">
                          <span className="group-card__name">{artist.name}</span>
                          <span className="group-card__sub">
                            {new Set(artist.tracks.map((t) => t.album)).size} album(s)
                          </span>
                        </span>
                        <span className="group-card__count">{artist.tracks.length}</span>
                      </button>
                      {isOpen && (
                        <TrackList tracks={artist.tracks} onPlay={(track) => playTrack(track, artist.tracks)} compact />
                      )}
                    </div>
                  );
                })}
              </div>
            ))}

          {view === "playlists" && (
            <div className="library-page__playlists">
              <form className="library-page__new-playlist" onSubmit={onCreatePlaylist}>
                <input
                  type="text"
                  placeholder="New playlist name…"
                  value={newPlaylistName}
                  onChange={(e) => setNewPlaylistName(e.target.value)}
                />
                <button type="submit">Create</button>
              </form>

              {sortedPlaylists.length === 0 ? (
                <p className="library-page__empty-text">No playlists yet — create one above.</p>
              ) : (
                <div className="library-page__groups">
                  {sortedPlaylists.map((playlist) => {
                    const key = `playlist::${playlist.id}`;
                    const isOpen = openGroup === key;
                    const playlistTracks = playlist.trackIds
                      .map((id) => trackById.get(id))
                      .filter((t): t is Track => Boolean(t));
                    return (
                      <div key={playlist.id} className="group-card" data-open={isOpen}>
                        <button
                          type="button"
                          className="group-card__header"
                          onClick={() => setOpenGroup(isOpen ? null : key)}
                        >
                          <span className="group-card__art">
                            <LibraryIcon />
                          </span>
                          <span className="group-card__info">
                            <span className="group-card__name">{playlist.name}</span>
                            <span className="group-card__sub">{playlistTracks.length} tracks</span>
                          </span>
                          <span className="group-card__count">{playlist.trackIds.length}</span>
                        </button>
                        <div className="group-card__actions">
                          <button
                            type="button"
                            data-active={playlist.pinned}
                            onClick={() => togglePin(playlist.id)}
                            aria-label="Pin playlist"
                          >
                            <PinIcon />
                          </button>
                          <button type="button" onClick={() => deletePlaylist(playlist.id)}>
                            Delete
                          </button>
                        </div>
                        {isOpen && (
                          <TrackList
                            tracks={playlistTracks}
                            onPlay={(track) => playTrack(track, playlistTracks)}
                            empty="No tracks in this playlist yet."
                            compact
                          />
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function TrackList({
  tracks,
  onPlay,
  empty,
  compact,
}: {
  tracks: Track[];
  onPlay: (track: Track) => void;
  empty?: string;
  compact?: boolean;
}) {
  const { isFavorite, toggleFavorite } = useFavorites();

  if (tracks.length === 0 && empty) {
    return <p className="library-page__empty-text">{empty}</p>;
  }

  return (
    <div className={compact ? "library-page__tracklist library-page__tracklist--compact" : "library-page__tracklist"}>
      {tracks.map((track) => (
        <div key={track.id} className="library-page__track" onDoubleClick={() => onPlay(track)}>
          <button type="button" onClick={() => onPlay(track)} className="library-page__track-title">
            {track.title}
          </button>
          {!compact && <span>{track.artist}</span>}
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
  );
}
