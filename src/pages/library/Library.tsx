import { useMemo, useState, type FormEvent, type ReactNode } from "react";
import { useLibrary } from "@/app/context/LibraryContext";
import { useFavorites } from "@/app/context/FavoritesContext";
import { usePlayback } from "@/app/context/PlaybackContext";
import { usePlaylists, PLAYLIST_MOODS, type Playlist, type PlaylistMood } from "@/app/context/PlaylistsContext";
import { formatDuration } from "@/lib/formatDuration";
import { HeartIcon, LibraryIcon, PinIcon } from "@/app/layout/icons";
import { SkeletonRows } from "@/app/components/Skeleton";
import type { Track } from "@/lib/types";
import "./Library.css";

type View = "all" | "albums" | "artists" | "playlists" | "favorites";

interface Album {
  key: string;
  name: string;
  artist: string;
  tracks: Track[];
}

interface Artist {
  key: string;
  name: string;
  tracks: Track[];
}

export function Library() {
  const { tracks, scanning, ready } = useLibrary();
  const { favoriteIds } = useFavorites();
  const { playTrack } = usePlayback();
  const { playlists, createPlaylist, deletePlaylist, togglePin, updatePlaylistDetails } = usePlaylists();
  const [view, setView] = useState<View>("all");
  const [openGroup, setOpenGroup] = useState<string | null>(null);
  const [newPlaylistName, setNewPlaylistName] = useState("");
  const [newPlaylistMood, setNewPlaylistMood] = useState<PlaylistMood | null>(null);

  const albums = useMemo<Album[]>(() => {
    const byAlbum = new Map<string, Album>();
    for (const track of tracks) {
      const key = `album::${track.album}::${track.artist}`;
      if (!byAlbum.has(key)) byAlbum.set(key, { key, name: track.album, artist: track.artist, tracks: [] });
      byAlbum.get(key)!.tracks.push(track);
    }
    return [...byAlbum.values()].sort((a, b) => a.name.localeCompare(b.name));
  }, [tracks]);

  const artists = useMemo<Artist[]>(() => {
    const byArtist = new Map<string, Artist>();
    for (const track of tracks) {
      const key = `artist::${track.artist}`;
      if (!byArtist.has(key)) byArtist.set(key, { key, name: track.artist, tracks: [] });
      byArtist.get(key)!.tracks.push(track);
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

  const onCreatePlaylist = (event: FormEvent) => {
    event.preventDefault();
    const name = newPlaylistName.trim();
    if (!name) return;
    createPlaylist(name, "", newPlaylistMood);
    setNewPlaylistName("");
    setNewPlaylistMood(null);
  };

  // A group is open → show its detail view full-width instead of the grid,
  // regardless of which tab it came from.
  if (openGroup) {
    const [kind] = openGroup.split("::");
    if (kind === "album") {
      const album = albums.find((a) => a.key === openGroup);
      if (album) {
        return (
          <GroupDetail
            title={album.name}
            subtitle={album.artist}
            art={album.tracks[0]?.artworkUrl}
            onBack={() => setOpenGroup(null)}
          >
            <TrackList tracks={album.tracks} onPlay={(t) => playTrack(t, album.tracks)} />
          </GroupDetail>
        );
      }
    }
    if (kind === "artist") {
      const artist = artists.find((a) => a.key === openGroup);
      if (artist) {
        return (
          <GroupDetail
            title={artist.name}
            subtitle={`${new Set(artist.tracks.map((t) => t.album)).size} album(s) · ${artist.tracks.length} tracks`}
            round
            onBack={() => setOpenGroup(null)}
          >
            <TrackList tracks={artist.tracks} onPlay={(t) => playTrack(t, artist.tracks)} />
          </GroupDetail>
        );
      }
    }
    if (kind === "playlist") {
      const playlist = playlists.find((p) => `playlist::${p.id}` === openGroup);
      if (playlist) {
        const playlistTracks = playlist.trackIds.map((id) => trackById.get(id)).filter((t): t is Track => Boolean(t));
        return (
          <PlaylistDetail
            playlist={playlist}
            tracks={playlistTracks}
            onBack={() => setOpenGroup(null)}
            onPlay={(t) => playTrack(t, playlistTracks)}
            onSaveDetails={(description, mood) => updatePlaylistDetails(playlist.id, description, mood)}
            onDelete={() => {
              deletePlaylist(playlist.id);
              setOpenGroup(null);
            }}
            onTogglePin={() => togglePin(playlist.id)}
          />
        );
      }
    }
    setOpenGroup(null); // stale key (e.g. the group was deleted) — fall through to the grid
  }

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
              <div className="library-page__grid">
                {albums.map((album) => (
                  <Tile
                    key={album.key}
                    art={album.tracks[0]?.artworkUrl}
                    title={album.name}
                    subtitle={album.artist}
                    onClick={() => setOpenGroup(album.key)}
                  />
                ))}
              </div>
            ))}

          {view === "artists" &&
            (artists.length === 0 ? (
              <p className="library-page__empty-text">No artists found yet.</p>
            ) : (
              <div className="library-page__grid">
                {artists.map((artist) => (
                  <Tile
                    key={artist.key}
                    round
                    title={artist.name}
                    subtitle={`${artist.tracks.length} tracks`}
                    onClick={() => setOpenGroup(artist.key)}
                  />
                ))}
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
                <select
                  value={newPlaylistMood ?? ""}
                  onChange={(e) => setNewPlaylistMood((e.target.value || null) as PlaylistMood | null)}
                  aria-label="Mood"
                >
                  <option value="">No mood</option>
                  {PLAYLIST_MOODS.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
                <button type="submit">Create</button>
              </form>

              {sortedPlaylists.length === 0 ? (
                <p className="library-page__empty-text">No playlists yet — create one above.</p>
              ) : (
                <div className="library-page__grid">
                  {sortedPlaylists.map((playlist) => (
                    <Tile
                      key={playlist.id}
                      title={playlist.name}
                      subtitle={playlist.mood ?? `${playlist.trackIds.length} tracks`}
                      pinned={playlist.pinned}
                      onClick={() => setOpenGroup(`playlist::${playlist.id}`)}
                    />
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function Tile({
  art,
  title,
  subtitle,
  round,
  pinned,
  onClick,
}: {
  art?: string;
  title: string;
  subtitle: string;
  round?: boolean;
  pinned?: boolean;
  onClick: () => void;
}) {
  return (
    <button type="button" className="tile" onClick={onClick}>
      <span className={round ? "tile__art tile__art--round" : "tile__art"}>
        {art ? <img src={art} alt="" /> : <LibraryIcon />}
        {pinned && <PinIcon className="tile__pin" />}
      </span>
      <span className="tile__title">{title}</span>
      <span className="tile__subtitle">{subtitle}</span>
    </button>
  );
}

function GroupDetail({
  title,
  subtitle,
  art,
  round,
  onBack,
  children,
}: {
  title: string;
  subtitle: string;
  art?: string;
  round?: boolean;
  onBack: () => void;
  children: ReactNode;
}) {
  return (
    <div className="group-detail">
      <button type="button" className="group-detail__back" onClick={onBack}>
        ← Back
      </button>
      <div className="group-detail__header">
        <span className={round ? "group-detail__art group-detail__art--round" : "group-detail__art"}>
          {art ? <img src={art} alt="" /> : <LibraryIcon />}
        </span>
        <div>
          <h1>{title}</h1>
          <p>{subtitle}</p>
        </div>
      </div>
      {children}
    </div>
  );
}

function PlaylistDetail({
  playlist,
  tracks,
  onBack,
  onPlay,
  onSaveDetails,
  onDelete,
  onTogglePin,
}: {
  playlist: Playlist;
  tracks: Track[];
  onBack: () => void;
  onPlay: (track: Track) => void;
  onSaveDetails: (description: string, mood: PlaylistMood | null) => void;
  onDelete: () => void;
  onTogglePin: () => void;
}) {
  const [description, setDescription] = useState(playlist.description);
  const [mood, setMood] = useState<PlaylistMood | null>(playlist.mood);
  const dirty = description !== playlist.description || mood !== playlist.mood;

  return (
    <div className="group-detail">
      <button type="button" className="group-detail__back" onClick={onBack}>
        ← Back
      </button>
      <div className="group-detail__header">
        <span className="group-detail__art">
          <LibraryIcon />
        </span>
        <div className="group-detail__playlist-meta">
          <h1>{playlist.name}</h1>
          <textarea
            className="group-detail__description"
            placeholder="Add a description…"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
          />
          <div className="group-detail__moods">
            {PLAYLIST_MOODS.map((m) => (
              <button
                key={m}
                type="button"
                data-active={mood === m}
                onClick={() => setMood(mood === m ? null : m)}
              >
                {m}
              </button>
            ))}
          </div>
          <div className="group-detail__playlist-actions">
            {dirty && (
              <button type="button" className="group-detail__save" onClick={() => onSaveDetails(description, mood)}>
                Save details
              </button>
            )}
            <button type="button" data-active={playlist.pinned} onClick={onTogglePin}>
              <PinIcon /> {playlist.pinned ? "Pinned" : "Pin"}
            </button>
            <button type="button" onClick={onDelete}>
              Delete playlist
            </button>
          </div>
        </div>
      </div>
      <TrackList tracks={tracks} onPlay={onPlay} empty="No tracks in this playlist yet." />
    </div>
  );
}

function TrackList({
  tracks,
  onPlay,
  empty,
}: {
  tracks: Track[];
  onPlay: (track: Track) => void;
  empty?: string;
}) {
  const { isFavorite, toggleFavorite } = useFavorites();

  if (tracks.length === 0 && empty) {
    return <p className="library-page__empty-text">{empty}</p>;
  }

  return (
    <div className="library-page__tracklist">
      {tracks.map((track) => (
        <div key={track.id} className="library-page__track" onDoubleClick={() => onPlay(track)}>
          <button type="button" onClick={() => onPlay(track)} className="library-page__track-title">
            {track.title}
          </button>
          <span>{track.artist}</span>
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
