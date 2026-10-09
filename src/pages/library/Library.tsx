import { Fragment, useMemo, useRef, useState, type FormEvent, type ReactNode } from "react";
import { useLibrary } from "@/app/context/LibraryContext";
import { useFavorites } from "@/app/context/FavoritesContext";
import { usePlayback } from "@/app/context/PlaybackContext";
import { usePlaylists, PLAYLIST_MOODS, type Playlist, type PlaylistMood } from "@/app/context/PlaylistsContext";
import { formatDuration } from "@/lib/formatDuration";
import { EditIcon, EyeOffIcon, HeartIcon, ImageIcon, LibraryIcon, PinIcon, TrashIcon } from "@/app/layout/icons";
import { TrackMenu } from "@/app/components/TrackMenu";
import { EditMetadataModal } from "@/app/components/EditMetadataModal";
import { PromotionRow, PromotionTile } from "@/app/components/Promotion";
import { useApiPromotions, useManualPromotions, promotionSlots } from "@/app/context/PromotionsContext";
import { usePersistentState } from "@/lib/usePersistentState";
import { useNotifications } from "@/app/context/NotificationsContext";
import type { Promotion } from "@/lib/promotions/types";
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
  const { playlists, createPlaylist, deletePlaylist, togglePin, updatePlaylistDetails, setCover, removeTrack } = usePlaylists();
  const [view, setView] = usePersistentState<View>("library.view", "all");
  const [openGroup, setOpenGroup] = usePersistentState<string | null>("library.openGroup", null);
  const albumPromos = useManualPromotions("library-albums");
  const artistPromos = useManualPromotions("library-artists");
  const playlistPromos = useManualPromotions("library-playlists");
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
            onSetCover={(url) => setCover(playlist.id, url)}
            onRemoveTrack={(trackId) => removeTrack(playlist.id, trackId)}
          />
        );
      }
    }
    // Stale key (e.g. the group was deleted) — but only clear it once the library has loaded,
    // otherwise a restored "open album" would be wiped before its tracks arrive.
    if (ready && !scanning) setOpenGroup(null);
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
            <AllMusicList
              tracks={tracks}
              onPlay={(track) => playTrack(track, tracks)}
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
                {withPromotions(
                  albums.map((album) => (
                    <Tile
                      key={album.key}
                      art={album.tracks[0]?.artworkUrl}
                      title={album.name}
                      subtitle={album.artist}
                      onClick={() => setOpenGroup(album.key)}
                    />
                  )),
                  albumPromos,
                )}
              </div>
            ))}

          {view === "artists" &&
            (artists.length === 0 ? (
              <p className="library-page__empty-text">No artists found yet.</p>
            ) : (
              <div className="library-page__grid">
                {withPromotions(
                  artists.map((artist) => (
                    <Tile
                      key={artist.key}
                      round
                      art={artist.tracks.find((t) => t.artworkUrl)?.artworkUrl}
                      title={artist.name}
                      subtitle={`${artist.tracks.length} tracks`}
                      onClick={() => setOpenGroup(artist.key)}
                    />
                  )),
                  artistPromos,
                )}
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
                  {withPromotions(
                    sortedPlaylists.map((playlist) => (
                      <Tile
                        key={playlist.id}
                        art={playlist.coverUrl ?? trackById.get(playlist.trackIds[0])?.artworkUrl}
                        title={playlist.name}
                        subtitle={`${playlist.trackIds.length} track${playlist.trackIds.length === 1 ? "" : "s"}${playlist.mood ? ` · ${playlist.mood}` : ""}`}
                        pinned={playlist.pinned}
                        onClick={() => setOpenGroup(`playlist::${playlist.id}`)}
                      />
                    )),
                    playlistPromos,
                  )}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

/** One manual promotion tile, tucked in a few cards down — never filling the grid. */
function withPromotions(tiles: ReactNode[], promos: Promotion[]): ReactNode[] {
  if (promos.length === 0) return tiles;
  const out = [...tiles];
  const at = Math.min(3, out.length);
  out.splice(at, 0, <PromotionTile key={`promo-${promos[0].id}`} promotion={promos[0]} />);
  return out;
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
  onSetCover,
  onRemoveTrack,
}: {
  playlist: Playlist;
  tracks: Track[];
  onBack: () => void;
  onPlay: (track: Track) => void;
  onSaveDetails: (description: string, mood: PlaylistMood | null) => void;
  onDelete: () => void;
  onTogglePin: () => void;
  onSetCover: (url: string | undefined) => void;
  onRemoveTrack: (trackId: string) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const { push } = useNotifications();
  const [description, setDescription] = useState(playlist.description);
  const [mood, setMood] = useState<PlaylistMood | null>(playlist.mood);
  const dirty = description !== playlist.description || mood !== playlist.mood;

  return (
    <div className="group-detail">
      <button type="button" className="group-detail__back" onClick={onBack}>
        ← Back
      </button>
      <div className="group-detail__header">
        <span className="group-detail__art group-detail__art--cover">
          {playlist.coverUrl ?? tracks[0]?.artworkUrl ? <img src={playlist.coverUrl ?? tracks[0]?.artworkUrl} alt="" /> : <LibraryIcon />}
          <button type="button" className="group-detail__cover-btn" onClick={() => fileRef.current?.click()} title="Upload cover art">
            <ImageIcon />
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            hidden
            onChange={async (e) => {
              const file = e.target.files?.[0];
              e.target.value = "";
              if (!file) return;
              const url = await fileToCover(file);
              if (url) {
                onSetCover(url);
                push("Playlist cover updated", `New cover saved for “${playlist.name}”.`);
              }
            }}
          />
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
            {playlist.coverUrl && (
              <button type="button" onClick={() => onSetCover(undefined)}>
                Remove cover
              </button>
            )}
            <button type="button" onClick={onDelete}>
              Delete playlist
            </button>
          </div>
        </div>
      </div>
      <TrackList tracks={tracks} onPlay={onPlay} empty="No tracks in this playlist yet." onRemove={(t) => onRemoveTrack(t.id)} />
    </div>
  );
}

/** Downscales an uploaded image to a small JPEG data URL so it's cheap to keep in localStorage/the store. */
async function fileToCover(file: File): Promise<string | undefined> {
  try {
    const bitmap = await createImageBitmap(file);
    const size = 400;
    const scale = Math.min(1, size / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    canvas.getContext("2d")?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    return canvas.toDataURL("image/jpeg", 0.85);
  } catch {
    return undefined;
  }
}

/** Library → All Music: three-dots menu per track + API promotions (never in Albums/Artists/Playlists). */
function AllMusicList({ tracks, onPlay }: { tracks: Track[]; onPlay: (track: Track) => void }) {
  const promos = useApiPromotions("library-all-music");
  const { hideTrack, removeFromLibrary } = useLibrary();
  const { push } = useNotifications();
  const [editing, setEditing] = useState<Track | null>(null);
  const slots = promotionSlots(tracks.length, promos.length, 5, 15);

  if (tracks.length === 0) return <p className="library-page__empty-text">Nothing here yet — add a watched folder in Folders.</p>;

  return (
    <>
      <TrackList
        tracks={tracks}
        onPlay={onPlay}
        menuFor={(track) => [
          { label: "Edit metadata", icon: <EditIcon />, onSelect: () => setEditing(track) },
          {
            label: "Hide from library",
            icon: <EyeOffIcon />,
            onSelect: () => {
              hideTrack(track.id);
              push("Hidden from library", `“${track.title}” is hidden. Unhide it from Settings.`);
            },
          },
          {
            label: "Remove from library",
            icon: <TrashIcon />,
            danger: true,
            onSelect: () => {
              removeFromLibrary(track.id);
              push("Removed from library", `“${track.title}” was removed (the file is untouched).`);
            },
          },
        ]}
        renderBefore={(_, index) => (slots.includes(index) ? <PromotionRow promotion={promos[slots.indexOf(index)]} variant="library-all-music" /> : null)}
      />
      {editing && <EditMetadataModal track={editing} onClose={() => setEditing(null)} />}
    </>
  );
}

function TrackList({
  tracks,
  onPlay,
  empty,
  onRemove,
  menuFor,
  renderBefore,
}: {
  tracks: Track[];
  onPlay: (track: Track) => void;
  empty?: string;
  onRemove?: (track: Track) => void;
  menuFor?: (track: Track) => import("@/app/components/TrackMenu").TrackMenuItem[];
  renderBefore?: (track: Track, index: number) => ReactNode;
}) {
  const { isFavorite, toggleFavorite } = useFavorites();

  if (tracks.length === 0 && empty) {
    return <p className="library-page__empty-text">{empty}</p>;
  }

  return (
    <div className="library-page__tracklist" data-extra={Boolean(onRemove || menuFor)}>
      {tracks.map((track, index) => (
        <Fragment key={track.id}>
          {renderBefore?.(track, index)}
          <div className="library-page__track" onDoubleClick={() => onPlay(track)}>
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
            {menuFor && <TrackMenu items={menuFor(track)} label={`More for ${track.title}`} />}
            {onRemove && (
              <button type="button" className="library-page__remove" onClick={() => onRemove(track)} aria-label={`Remove ${track.title} from playlist`} title="Remove from playlist">
                <TrashIcon />
              </button>
            )}
          </div>
        </Fragment>
      ))}
    </div>
  );
}
