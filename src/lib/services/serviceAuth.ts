import { openInSystemBrowser } from "./openInSystemBrowser";

/**
 * Every redirect in this app uses the `blackmusic://` custom scheme — including
 * in dev — never `http://localhost`. A localhost redirect only works while a
 * dev server happens to be running on that exact port; the deep link always
 * works, dev or production, because it's caught by the OS itself and handed to
 * whichever running instance of the app registered the scheme (see the
 * deep-link plugin config in src-tauri/tauri.conf.json).
 *
 * GitHub and Google aren't wired up end-to-end yet — both need a server-side
 * token exchange (see README) — but the redirect URIs are real and consistent
 * with Spotify's now, so registering them in each provider's dashboard ahead
 * of time won't need to change later.
 */
export function buildGithubAuthUrl(): string | null {
  const clientId = import.meta.env.VITE_GITHUB_CLIENT_ID;
  if (!clientId) return null;
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: "blackmusic://github/callback",
    scope: "user",
  });
  return `https://github.com/login/oauth/authorize?${params.toString()}`;
}

export function buildGoogleAuthUrl(): string | null {
  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
  if (!clientId) return null;
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: "blackmusic://google/callback",
    response_type: "code",
    scope: "openid email profile",
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

export { openInSystemBrowser };
