import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
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
  removeTrack: (playlistId: string, trackId: string) => void;
}

const PlaylistsContext = createContext<PlaylistsContextValue | null>(null);

export function PlaylistsProvider({ children }: { children: ReactNode }) {
  const [playlists, setPlaylists] = useState<Playlist[]>([]);

  useEffect(() => {
    getPreference<Playlist[]>(STORAGE_KEY, []).then(setPlaylists);
  }, []);

  const persist = (next: Playlist[]) => {
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
    persist([...playlists, playlist]);
    return playlist;
  };

  const deletePlaylist = (id: string) => persist(playlists.filter((p) => p.id !== id));

  const renamePlaylist = (id: string, name: string) =>
    persist(playlists.map((p) => (p.id === id ? { ...p, name } : p)));

  const updatePlaylistDetails = (id: string, description: string, mood: PlaylistMood | null) =>
    persist(playlists.map((p) => (p.id === id ? { ...p, description, mood } : p)));

  const togglePin = (id: string) =>
    persist(playlists.map((p) => (p.id === id ? { ...p, pinned: !p.pinned } : p)));

  const addTrack = (playlistId: string, trackId: string) =>
    persist(
      playlists.map((p) =>
        p.id === playlistId && !p.trackIds.includes(trackId)
          ? { ...p, trackIds: [...p.trackIds, trackId] }
          : p,
      ),
    );

  const removeTrack = (playlistId: string, trackId: string) =>
    persist(
      playlists.map((p) =>
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
