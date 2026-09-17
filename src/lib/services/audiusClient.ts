interface AudiusTrack {
  id: string;
  title: string;
  artwork?: { "150x150"?: string; "480x480"?: string };
  user: { name: string };
  duration: number;
  genre?: string;
}

const APP_NAME = "BlackMusic";
// Audius is a network of discovery nodes rather than one fixed host. This one is
// widely used and stable enough for a client read, but a hardened integration
// would resolve the current node list from https://api.audius.co first.
const DISCOVERY_HOST = "https://discoveryprovider.audius.co";

export async function fetchAudiusTrending(genre?: string): Promise<AudiusTrack[]> {
  const params = new URLSearchParams({ app_name: APP_NAME });
  if (genre) params.set("genre", genre);
  const apiKey = import.meta.env.VITE_AUDIUS_API_KEY;
  if (apiKey) params.set("api_key", apiKey);

  const response = await fetch(`${DISCOVERY_HOST}/v1/tracks/trending?${params.toString()}`);
  if (!response.ok) throw new Error(`Audius request failed: ${response.status}`);
  const body = await response.json();
  return (body.data ?? []) as AudiusTrack[];
}

export function audiusStreamUrl(trackId: string): string {
  const params = new URLSearchParams({ app_name: APP_NAME });
  const apiKey = import.meta.env.VITE_AUDIUS_API_KEY;
  if (apiKey) params.set("api_key", apiKey);
  return `${DISCOVERY_HOST}/v1/tracks/${trackId}/stream?${params.toString()}`;
}

export type { AudiusTrack };
