export interface ServiceDefinition {
  id: string;
  name: string;
  /** 2.1.0: every service has a client function (serviceRegistry.ts); it just needs its key. */
  available: boolean;
}

// Order matches the original app's account menu exactly.
export const SERVICE_DIRECTORY: ServiceDefinition[] = [
  { id: "bmusic", name: "BlackMusic", available: true },
  { id: "spotify", name: "Spotify", available: true },
  { id: "audius", name: "Audius", available: true },
  { id: "tidal", name: "Tidal", available: true },
  { id: "amazon", name: "Amazon Music", available: true },
  { id: "apple", name: "Apple Music", available: true },
  { id: "deezer", name: "Deezer", available: true },
  { id: "soundcloud", name: "SoundCloud", available: true },
  { id: "pandora", name: "Pandora", available: true },
  { id: "yandex", name: "Yandex Music", available: true },
  { id: "lastfm", name: "Last.fm", available: true },
  { id: "youtube", name: "YouTube", available: true },
];
