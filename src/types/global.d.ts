/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string;
  readonly VITE_SUPABASE_ANON_KEY: string;
  readonly VITE_YOUTUBE_API_KEY: string;
  readonly VITE_GENIUS_ACCESS_TOKEN: string;
  readonly VITE_SPOTIFY_CLIENT_ID: string;
  readonly VITE_GITHUB_CLIENT_ID: string;
  readonly VITE_GOOGLE_CLIENT_ID: string;
  readonly VITE_AUDIUS_API_KEY: string;
  readonly VITE_LASTFM_API_KEY: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
