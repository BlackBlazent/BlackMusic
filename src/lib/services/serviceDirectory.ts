export interface ServiceDefinition {
  id: string;
  name: string;
  /** Only BlackMusic, Spotify, Audius, and Tidal are actually wired up right now. */
  available: boolean;
}

// Order matches the original app's account menu exactly.
export const SERVICE_DIRECTORY: ServiceDefinition[] = [
  { id: "bmusic", name: "BlackMusic", available: true },
  { id: "spotify", name: "Spotify", available: true },
  { id: "audius", name: "Audius", available: true },
  { id: "tidal", name: "Tidal", available: true },
  { id: "amazon", name: "Amazon Music", available: false },
  { id: "apple", name: "Apple Music", available: false },
  { id: "deezer", name: "Deezer", available: false },
  { id: "soundcloud", name: "SoundCloud", available: false },
  { id: "pandora", name: "Pandora", available: false },
  { id: "yandex", name: "Yandex Music", available: false },
  { id: "youtube", name: "YouTube", available: false },
];
