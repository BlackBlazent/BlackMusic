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
  readonly VITE_TIDAL_ACCESS_TOKEN: string;
  readonly VITE_TIDAL_CLIENT_ID: string;
  readonly VITE_TIDAL_CLIENT_SECRET: string;
  readonly VITE_TIDAL_COUNTRY: string;
  readonly VITE_AMAZON_MUSIC_ACCESS_TOKEN: string;
  readonly VITE_AMAZON_MUSIC_API_KEY: string;
  readonly VITE_APPLE_MUSIC_DEVELOPER_TOKEN: string;
  readonly VITE_APPLE_MUSIC_STOREFRONT: string;
  readonly VITE_SOUNDCLOUD_CLIENT_ID: string;
  readonly VITE_YANDEX_MUSIC_TOKEN: string;
  readonly VITE_PANDORA_API_URL: string;
  readonly VITE_PANDORA_API_KEY: string;
  readonly VITE_PROMOTIONS_API_URL: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

declare module "*.svg" {
  const src: string;
  export default src;
}
