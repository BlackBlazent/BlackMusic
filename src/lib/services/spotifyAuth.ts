const SPOTIFY_SCOPES = ["user-read-private", "user-read-email", "streaming", "playlist-read-private"];

export function buildSpotifyAuthUrl(): string | null {
  const clientId = import.meta.env.VITE_SPOTIFY_CLIENT_ID;
  if (!clientId) return null;

  const params = new URLSearchParams({
    client_id: clientId,
    response_type: "code",
    redirect_uri: "http://localhost/callback",
    scope: SPOTIFY_SCOPES.join(" "),
  });
  return `https://accounts.spotify.com/authorize?${params.toString()}`;
}

export async function openInSystemBrowser(url: string): Promise<void> {
  const { isTauri } = await import("@/lib/platform");
  if (isTauri()) {
    const { open } = await import("@tauri-apps/plugin-shell");
    await open(url);
    return;
  }
  window.open(url, "_blank", "noopener,noreferrer");
}
