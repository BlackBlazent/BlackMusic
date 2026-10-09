# Changelog

## 2.1.0

See `src/lib/changelog.ts` for the in-app "What's new" list (shown from the 2.1.0 notification).

### Needs your setup (code is done, credentials/binaries are not)
- Supabase: enable the Spotify provider; add `blackmusic://auth/callback` to Redirect URLs.
- `yt-dlp` installed and on PATH (Video Mode + Download).
- `pnpm add -D exiftool-vendored && pnpm prepare:exiftool` also universalforce install | pnpm add -D exiftool-vendored exiftool-vendored.exe exiftool-vendored.pl (metadata editing).
- Service keys in `.env` or Settings → Service API keys.
- Promotions: deploy `server/promotions-server.mjs` with `INVOLVE_API_KEY` / `INVOLVE_API_SECRET`, set `VITE_PROMOTIONS_API_URL`; paste your tracking link into `src/lib/promotions/manualPromotions.ts`.
- `pnpm install` (adds `@tauri-apps/plugin-http`) then `pnpm tauri:dev`; Cargo adds `tauri-plugin-http`, `tauri-plugin-single-instance`, `lofty`.

### Fast import
Rust command `scan_folder_fast` (src-tauri/src/importer.rs): discover → stat/skip unchanged → parallel header-only tag read → one result → one UI update. Cover art loads lazily, once per album.
