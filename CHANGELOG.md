# Changelog

## 2.2.0 — immediate fix (not yet released)
**Desktop**
- Whisper: `whisper-cli failed: unknown error` was the Windows loader failing (the bundled `whisper-cli.exe` is the *shared* build and its DLLs were never shipped). DLLs are now bundled (`tauri.windows.conf.json`), put on the child's PATH, pre-checked, and every failure maps to a readable message. One run at a time, cancellable, 45-min timeout, per-run scratch folder, empty transcripts are never saved.
- Tidal 401: a stale pasted token always beat the client-credentials exchange. Order is now backend broker → unexpired pasted token → dev-only client credentials; a 401 retries once with a fresh token; 401/403/429/5xx/network are told apart. The confidential secret no longer ships in production bundles (`GET /api/tidal/token` on the promotions server). Tracks now use their own artist.

**Mobile / UI**
- Zoom lock (viewport + gesture guards), hidden scrollbars, safe areas, no horizontal overflow (the cause of the shrunken, cut-off canvas).
- Top bar fits: Services · Undo/Redo · Search icon · Theme · Notifications · Account. Services is a left drawer; search opens a top-layer overlay.
- Seven swipeable bottom tabs (Local restored), above the system navigation bar (Android inset handling in `android-post-init`).
- Compact playback bar with a speaker button → volume popover. Library tabs under the title, no background.
- Playground fullscreen works on every platform (OS window / Fullscreen API / immersive stage).
- Audio filters apply and revert immediately (last filter off now clears the chain; no silent routing into a suspended context; analyser leak fixed).
- Banner upload no longer needs `fs:allow-copy-file`.
- Media Controls / Media Notification (lock screen & notification shade) via Media Session + Android native service.

**Library scanning**
- Symlinks followed, unreadable folders reported, inaccessible ≠ empty (existing tracks are kept), SD cards/volumes discovered, rescan on return to the app, queued (never concurrent) scans, whole-segment path matching, wider audio extensions, skipped-file diagnostics, Android folder-picker URIs converted to paths.
See `REQUIREMENTS_2_2_0.md` for the item-by-item status and `src/lib/changelog.ts` for the in-app notes.

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
