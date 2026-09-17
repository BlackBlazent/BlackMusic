interface LastfmAlbumInfo {
  album?: {
    image?: { "#text": string; size: string }[];
  };
}

const BASE_URL = "https://ws.audioscrobbler.com/2.0/";

/** Largest non-empty image Last.fm returns for the album, or null if none / not found. */
export async function fetchAlbumArtwork(artist: string, album: string): Promise<string | null> {
  const apiKey = import.meta.env.VITE_LASTFM_API_KEY;
  if (!apiKey || !artist || !album || artist === "Unknown artist" || album === "Unknown album") return null;

  const params = new URLSearchParams({
    method: "album.getinfo",
    api_key: apiKey,
    artist,
    album,
    format: "json",
  });

  try {
    const response = await fetch(`${BASE_URL}?${params.toString()}`);
    if (!response.ok) return null;
    const data = (await response.json()) as LastfmAlbumInfo;
    const images = data.album?.image ?? [];
    const best = [...images].reverse().find((img) => img["#text"]);
    return best?.["#text"] || null;
  } catch {
    return null;
  }
}
