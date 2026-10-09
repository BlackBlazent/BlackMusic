import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { useNotifications } from "./NotificationsContext";
import { getPreference, setPreference } from "@/lib/preferencesStore";

const STORAGE_KEY = "blackmusic:playlists";

export const PLAYLIST_MOODS = ["Happy", "Chill", "Energetic", "Sad", "Electronic", "Acoustic", "Focus"] as const;
export type PlaylistMood = (typeof PLAYLIST_MOODS)[number];

export interface Playlist {
  id: string;
  name: string;
  description: string;
  mood: PlaylistMood | null;
  trackIds: string[];
  pinned: boolean;
  /** Custom cover (data URL, downscaled) uploaded by the user. */
  coverUrl?: string;
  createdAt: number;
}

interface PlaylistsContextValue {
  playlists: Playlist[];
  createPlaylist: (name: string, description?: string, mood?: PlaylistMood | null) => Playlist;
  deletePlaylist: (id: string) => void;
  renamePlaylist: (id: string, name: string) => void;
  updatePlaylistDetails: (id: string, description: string, mood: PlaylistMood | null) => void;
  togglePin: (id: string) => void;
  addTrack: (playlistId: string, trackId: string) => void;
  /** Adds every id in one write — the old one-at-a-time loop lost all but one (stale state). */
  addTracks: (playlistId: string, trackIds: string[]) => number;
  setCover: (playlistId: string, coverUrl: string | undefined) => void;
  removeTrack: (playlistId: string, trackId: string) => void;
}

const PlaylistsContext = createContext<PlaylistsContextValue | null>(null);

export function PlaylistsProvider({ children }: { children: ReactNode }) {
  const { push } = useNotifications();
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  // Always-current copy: lets several actions run back to back (create then add)
  // without any of them reading a stale `playlists` from an earlier render.
  const playlistsRef = useRef<Playlist[]>([]);

  useEffect(() => {
    getPreference<Playlist[]>(STORAGE_KEY, []).then((stored) => {
      playlistsRef.current = stored;
      setPlaylists(stored);
    });
  }, []);

  const persist = (next: Playlist[]) => {
    playlistsRef.current = next;
    setPlaylists(next);
    void setPreference(STORAGE_KEY, next);
  };

  const createPlaylist = (name: string, description = "", mood: PlaylistMood | null = null): Playlist => {
    const playlist: Playlist = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      name,
      description,
      mood,
      trackIds: [],
      pinned: false,
      createdAt: Date.now(),
    };
    persist([...playlistsRef.current, playlist]);
    push("Playlist created", `“${name}” was added to your library.`);
    return playlist;
  };

  const deletePlaylist = (id: string) => persist(playlistsRef.current.filter((p) => p.id !== id));

  const renamePlaylist = (id: string, name: string) =>
    persist(playlistsRef.current.map((p) => (p.id === id ? { ...p, name } : p)));

  const updatePlaylistDetails = (id: string, description: string, mood: PlaylistMood | null) =>
    persist(playlistsRef.current.map((p) => (p.id === id ? { ...p, description, mood } : p)));

  const togglePin = (id: string) =>
    persist(playlistsRef.current.map((p) => (p.id === id ? { ...p, pinned: !p.pinned } : p)));

  const addTrack = (playlistId: string, trackId: string) =>
    persist(
      playlistsRef.current.map((p) =>
        p.id === playlistId && !p.trackIds.includes(trackId)
          ? { ...p, trackIds: [...p.trackIds, trackId] }
          : p,
      ),
    );

  const addTracks = (playlistId: string, trackIds: string[]): number => {
    const target = playlistsRef.current.find((p) => p.id === playlistId);
    if (!target) return 0;
    const existing = new Set(target.trackIds);
    const fresh = [...new Set(trackIds)].filter((id) => !existing.has(id));
    if (fresh.length === 0) return 0;
    persist(playlistsRef.current.map((p) => (p.id === playlistId ? { ...p, trackIds: [...p.trackIds, ...fresh] } : p)));
    return fresh.length;
  };

  const setCover = (playlistId: string, coverUrl: string | undefined) =>
    persist(playlistsRef.current.map((p) => (p.id === playlistId ? { ...p, coverUrl } : p)));

  const removeTrack = (playlistId: string, trackId: string) =>
    persist(
      playlistsRef.current.map((p) =>
        p.id === playlistId ? { ...p, trackIds: p.trackIds.filter((id) => id !== trackId) } : p,
      ),
    );

  return (
    <PlaylistsContext.Provider
      value={{
        playlists,
        createPlaylist,
        deletePlaylist,
        renamePlaylist,
        updatePlaylistDetails,
        togglePin,
        addTrack,
        addTracks,
        setCover,
        removeTrack,
      }}
    >
      {children}
    </PlaylistsContext.Provider>
  );
}

export function usePlaylists(): PlaylistsContextValue {
  const ctx = useContext(PlaylistsContext);
  if (!ctx) throw new Error("usePlaylists must be used within a PlaylistsProvider");
  return ctx;
}
