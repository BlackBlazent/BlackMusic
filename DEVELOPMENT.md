# Developing BlackMusic

This is the technical companion to README.md (which is written for people using the app, not
building it). This doc covers architecture, local setup, building for each desktop platform, and
what's changed and why.

## Stack

- **Tauri 2** (Rust shell) instead of Electron -- smaller binaries, and Tauri 2 targets
  Android/iOS natively, so no separate mobile rewrite is needed later.
- **React 18 + React Router 6**, hash-based routing (`createHashRouter`) since the production
  build is loaded from disk inside the webview, not served by anything that resolves arbitrary
  paths.
- **TypeScript** everywhere except a couple of config files.
- **Plain CSS** with a small design-token system (`src/styles/tokens.css`) -- no CSS framework.
- **pnpm** as the package manager.

## Project layout

```
src/
  app/
    layout/        Sidebar, TopBar, AppShell, GlobalPlaybackBar, FloatingPlaygroundToggle,
                    Footer, ServicesMenu, NotificationsPopover, AccountModal, icon set
    context/        One React context per concern -- see "State" below
    providers/      ThemeProvider (dark/light)
    components/     Shared UI (Tooltip, Skeleton, Switch, PagePlaceholder)
    router.tsx      Route table
  pages/
    home/ playground/ local/ online/ library/ folder/ search/ settings/
  lib/
    services/       Per-integration clients (spotifyClient, spotifyPlayerBridge, audiusClient,
                     lastfmClient, serviceAuth, serviceDirectory, openInSystemBrowser)
    library/        scanFolder.ts -- the folder walker + tag reader
    updater.ts, preferencesStore.ts, platform.ts, openInFileExplorer.ts, useClickOutside.ts
  styles/           tokens.css (design tokens), reset.css
  types/            Ambient TS declarations
src-tauri/          Rust shell: Cargo.toml, main.rs, tauri.conf.json, capabilities/
```

## State

Each concern is its own context, composed in `App.tsx`:

| Context | Owns |
|---|---|
| `ThemeProvider` | dark/light |
| `PaneContext` | sidebar collapse/width |
| `AppSettingsContext` | per-integration on/off toggles (Settings -> Integrations) |
| `FoldersContext` | the watched-folder list only -- no scanning logic |
| `LibraryContext` | the scanned track cache, delta scanning, Last.fm enrichment |
| `FavoritesContext` | favorited track IDs |
| `PlaylistsContext` | user-created playlists |
| `PlaybackHistoryContext` | the play-event log Home's stats are computed from |
| `PlaybackContext` | the actual transport -- see below |
| `ServicesContext` | which service is "active" (picked from the logo), connection state |
| `NotificationsContext` | the notification list |
| `AuthContext` | Supabase session, if configured |

All of it persists through `src/lib/preferencesStore.ts`, which wraps the Tauri store plugin
(falling back to `localStorage` when running in a plain browser via `pnpm dev`). **Every write
calls `store.save()` explicitly** -- `store.set()` alone only updates the in-memory store; skipping
`save()` was a real bug that shipped for a while and made every setting (watched folders, the
track cache, theme, everything) fail to survive a restart.

### PlaybackContext: two engines, one set of state

Local files and Audius both play through a single `<audio>` element. Spotify tracks can't -- their
streams are DRM-protected and only play through Spotify's own Web Playback SDK
(`src/lib/services/spotifyPlayerBridge.ts`). Rather than build a separate "Spotify player" UI,
`PlaybackContext` routes every transport call (`playTrack`, `togglePlay`, `seek`, volume) to
whichever engine the current track belongs to (`isSpotifyTrackId(track.id)` -- Spotify tracks are
given a real `spotify:track:<id>` URI as their `Track.id`), and the SDK's `player_state_changed`
event feeds the exact same `position`/`duration`/`isPlaying` state a local track would. Every page
that reads `usePlayback()` -- the global bar, Playground -- works identically regardless of source.

What this does *not* do: give Spotify its own multi-track queue. `next`/`previous` still walk our
own `queue` array and call `loadTrackAt`, which happens to route to Spotify when the resolved
track is one of theirs -- so skipping through a mixed local/Spotify queue works, but a Spotify
track's *own* `nextTrack()`/`previousTrack()` SDK methods are unused, since we only ever hand it a
single URI via `spotifyPlayUri`. A from-scratch Spotify Connect queue integration would replace
that with their queue API -- not done here.

### Folder scanning

`LibraryContext` caches scanned tracks per folder (`blackmusic:tracksByFolder` in the preferences
store). On launch, the cache loads and nothing gets rescanned. Adding a folder scans only that
folder; removing one drops its cached tracks. The "Rescan" button does a full refresh of
everything, on purpose. `scanFolder.ts` walks the directory tree first (cheap -- just `readDir`
calls) and then reads tag metadata for up to 8 files concurrently, streaming results into the UI
in small batches as they're found rather than waiting for the whole folder to finish.

Paths are joined with `@tauri-apps/api/path`'s `join()`, not manual string concatenation -- a
watched folder on Windows is backslash-separated (`C:\Users\...\Musics`), and concatenating with a
literal `/` produces a mixed-separator path that can silently fail to resolve.

## Setup

Requires Node 18+, pnpm (https://pnpm.io), and the Rust toolchain
(https://www.rust-lang.org/tools/install) plus Tauri's platform prerequisites
(https://v2.tauri.app/start/prerequisites/) for your OS.

```bash
pnpm install
cp .env.example .env   # fill in what you have; see the comments in the file
pnpm tauri:dev          # full app in the Tauri webview
pnpm dev                 # UI only, in a regular browser tab -- no native APIs, useful for fast CSS/layout iteration
```

### Environment variables

Every `VITE_`-prefixed variable is bundled straight into the app's JS and is recoverable by anyone
who unzips the installer. That's fine for public **client IDs** and **api_key**-style values that
services themselves treat as safe for client-side use (Spotify's client ID with PKCE, Audius'
app API key, Last.fm's api_key). It is never fine for a true OAuth **client secret**
(GitHub/Google/Facebook/Genius/Jamendo/TikTok/VK all issue one) -- those need a server-side token
exchange, which isn't built here. See `.env.example` for the full list and which category each
one falls into.

### Redirects

Every OAuth redirect uses the `blackmusic://` custom scheme (e.g.
`blackmusic://spotify/callback`), in dev and in production alike -- never `http://localhost`. A
localhost redirect only works while a dev server happens to be running on that exact port; the
deep link is caught by the OS itself and handed to whichever running instance of the app
registered the scheme, so it works the same way regardless of how the app was launched. Register
the exact URI in each provider's dashboard.

### Supabase-backed logins (GitHub, Google, Facebook) specifically

These go through Supabase Auth, not a direct provider-to-app OAuth flow like Spotify's, so there
are **two different callback URLs involved** -- easy to mix up:

1. **The provider's OAuth app settings** (e.g. GitHub -> Settings -> Developer settings -> OAuth
   Apps -> your app -> "Authorization callback URL") get Supabase's own fixed endpoint:
   `https://<your-project-ref>.supabase.co/auth/v1/callback`. Yes -- that Supabase URL, not
   `blackmusic://...`. GitHub redirects to Supabase first; Supabase does the token exchange with
   GitHub (using the client secret configured in the Supabase dashboard, not in this codebase),
   then redirects again, this time to us.
2. **Supabase's own "Redirect URLs" allowlist** (Supabase Dashboard -> Authentication -> URL
   Configuration) needs `blackmusic://auth/callback` added -- this is the second hop, Supabase
   handing control back to the actual app. Without this, Supabase has nowhere it's allowed to send
   the browser back to, and the sign-in silently fails to return to the app even though the GitHub
   side succeeded.
3. In the app itself, `AuthContext.tsx` calls `signInWithOAuth` with
   `redirectTo: "blackmusic://auth/callback"` and `skipBrowserRedirect: true` (opens the URL in the
   system browser ourselves, same pattern as Spotify), then a deep-link listener catches that
   callback and calls `exchangeCodeForSession` -- PKCE flow, set explicitly in
   `supabaseClient.ts`, since there's no browser location bar in a desktop app for Supabase's
   normal automatic detect-it-from-the-URL behavior to work against.

If GitHub login still doesn't return control to the app after both callback URLs above are set
correctly, the next thing to check is that the GitHub provider is actually toggled on in Supabase
Dashboard -> Authentication -> Providers, with the client ID/secret filled in there (not in this
app's `.env`).

## Building for desktop

`pnpm tauri:build` produces a platform-native installer for whatever OS you run it on -- Tauri
doesn't cross-compile a Windows build from macOS or vice versa without extra toolchains, so build
on (or in CI for) each target platform separately.

### Windows

1. Install Rust (https://www.rust-lang.org/tools/install, the `rustup` installer) and the
   **Desktop development with C++** workload from Visual Studio Build Tools (Tauri's Windows
   prerequisite for the MSVC linker).
2. `pnpm install`
3. `pnpm tauri:build` -- outputs an `.msi` and/or `.exe` (NSIS) installer under
   `src-tauri/target/release/bundle/`.

### macOS

1. Install Xcode Command Line Tools: `xcode-select --install`.
2. Install Rust via `rustup`.
3. `pnpm install`
4. `pnpm tauri:build` -- outputs a `.dmg` and a `.app` bundle under
   `src-tauri/target/release/bundle/`. Distributing outside the App Store needs your own Apple
   Developer ID for code signing/notarization -- unsigned builds will trigger Gatekeeper warnings
   on other people's Macs.

### Linux

1. Install your distro's Tauri prerequisites (WebKitGTK, build-essential/gcc, and a few dev
   packages -- the exact list is distro-specific; see Tauri's Linux prerequisites at
   https://v2.tauri.app/start/prerequisites/#linux).
2. Install Rust via `rustup`.
3. `pnpm install`
4. `pnpm tauri:build` -- outputs a `.deb`, `.rpm`, and/or an `.AppImage` depending on what's
   available on your system, under `src-tauri/target/release/bundle/`.

### Building from Windows for Mac/Linux

You can't, directly -- Tauri builds a native binary for the OS it's running on. The standard way
around this is CI: a GitHub Actions workflow with a job per OS (`windows-latest`, `macos-latest`,
`ubuntu-latest`), each running `pnpm tauri:build` on its own runner. That's also exactly the setup
the auto-updater below expects.

## Mobile (brief -- desktop is the focus right now)

Tauri 2 supports Android and iOS from the same codebase:

```bash
pnpm tauri android init   # first time only
pnpm tauri android dev

pnpm tauri ios init        # first time only, macOS + Xcode required
pnpm tauri ios dev
```

Neither has been tested against this codebase -- expect to need to adjust things that assume a
desktop window (the fixed 1080x1920 size in `tauri.conf.json`, the file-picker-based folder
scanning, which won't map cleanly onto mobile's sandboxed storage). Worth its own pass later
rather than assuming it "just works."

## Auto-updates

The Tauri updater plugin is wired in (`src-tauri/Cargo.toml`, `main.rs`, `tauri.conf.json`
`plugins.updater`, and a Settings -> Updates section in the UI), but the config in
`tauri.conf.json` right now has **placeholder** values:

```json
"updater": {
  "endpoints": ["https://github.com/<your-github-username>/<your-repo>/releases/latest/download/latest.json"],
  "pubkey": "REPLACE_WITH_YOUR_GENERATED_PUBLIC_KEY"
}
```

To make it real:

1. Generate a signing keypair: `pnpm tauri signer generate -w ~/.tauri/blackmusic.key`. This
   prints a public key -- put that in `pubkey` above. Keep the private key file and its password
   somewhere safe (a CI secret, not committed).
2. Point `endpoints` at your actual GitHub repo.
3. Set up a release workflow -- `tauri-apps/tauri-action` on GitHub
   (https://github.com/tauri-apps/tauri-action) is the standard GitHub Action for this; it builds
   the app, signs it with your private key, and publishes both the installers and a `latest.json`
   manifest to a GitHub Release. A minimal workflow looks like:

   ```yaml
   name: release
   on:
     push:
       tags: ["v*"]
   jobs:
     release:
       strategy:
         matrix:
           platform: [windows-latest, macos-latest, ubuntu-latest]
       runs-on: ${{ matrix.platform }}
       steps:
         - uses: actions/checkout@v4
         - uses: pnpm/action-setup@v4
         - uses: actions/setup-node@v4
           with: { node-version: 20 }
         - uses: dtolnay/rust-toolchain@stable
         - run: pnpm install
         - uses: tauri-apps/tauri-action@v0
           env:
             GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
             TAURI_SIGNING_PRIVATE_KEY: ${{ secrets.TAURI_SIGNING_PRIVATE_KEY }}
             TAURI_SIGNING_PRIVATE_KEY_PASSWORD: ${{ secrets.TAURI_SIGNING_PRIVATE_KEY_PASSWORD }}
           with:
             tagName: ${{ github.ref_name }}
             releaseName: "BlackMusic ${{ github.ref_name }}"
   ```

   Store `TAURI_SIGNING_PRIVATE_KEY` (the private key file's contents) and
   `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` as repo secrets, not in the workflow file.

Once that's in place, pushing a `v*` tag builds and publishes for all three desktop platforms, and
Settings -> Updates in the app will find it.

## Status / what's been fixed

Rebuilt from an Electron + plain-HTML app onto Tauri 2 + React across several passes. Recent,
concrete bug fixes worth knowing about if something seems off:

- **The production build was failing to compile.** Four files (`AccountModal.tsx`, `Sidebar.tsx`,
  `Library.tsx`, `SeekBar.tsx`) referenced the `React` namespace (`React.FormEvent`,
  `React.MouseEvent`) without importing it -- only named imports like `{ useState }` were present.
  `pnpm build` runs `tsc -b` before `vite build`; this failed that step every time, which is very
  likely why a "production" build kept trying to load `http://localhost:1420` (a stale or partial
  `dist/` from a build that never actually completed) instead of the bundled app. Confirmed with an
  actual TypeScript pass, not guessed -- and fixed, by importing the specific types needed
  (aliased where a name would've collided with the DOM's own `MouseEvent`).
- **`tsconfig.json` was missing `esModuleInterop`.** `main.tsx`'s `import React from "react"` is
  exactly the pattern that requires it against `@types/react`'s declarations; without it, that's
  also a `tsc -b`-failing error. Added, along with `allowSyntheticDefaultImports`.
- **The updater config shipped with `"active": true` and a placeholder (invalid) `pubkey`.** That's
  a real risk of its own — set to `"active": false"` until a real signing key is generated (see
  "Auto-updates" above); flip it once that's done.
- **Embedded album art could be huge and was stored at full resolution** as a base64 data URL, per
  track, kept in memory for the app's lifetime. On a library of a few hundred tracks with
  large/uncompressed embedded art, that's a real way to run a webview out of memory. Now downscaled
  to a ~320px thumbnail via canvas before it's ever turned into a data URL.
- **GitHub/Google/Facebook sign-in via Supabase had no `redirectTo`**, so Supabase fell back to its
  default site URL (commonly `http://localhost:3000`) instead of anything that could hand control
  back to the app -- the sign-in would complete with the provider but never return. Fixed: routes
  through the system browser with an explicit `blackmusic://auth/callback` redirect, PKCE flow, and
  a deep-link listener that finishes the exchange. See "Supabase-backed logins" above for the two
  *different* callback URLs this needs configured (provider dashboard vs. Supabase dashboard).
- **Preferences weren't persisting.** `preferencesStore.ts` called `store.set()` without the
  follow-up `store.save()` the Tauri store plugin needs to actually write to disk. This is very
  likely why folders used to rescan on every launch, and probably contributed to general
  instability too.
- **Playback could get "stuck" switching between sources** (e.g. an Audius track, then a Local
  one) -- `playTrack` read the play queue from React state in the same tick it had just replaced
  that state, so the `<audio>` element sometimes loaded against the *previous* queue while the
  displayed metadata (driven by state, which *had* updated) showed the new track. Title/art looked
  right; duration and seeking didn't work. Fixed by having every transport action pass its queue
  explicitly instead of reading it back off state.
- **Folder paths used manual `/` concatenation**, not `@tauri-apps/api/path`'s `join()` -- a likely
  cause of files failing to load on Windows, where a mixed-separator path can silently not
  resolve. Fixed.
- **Last.fm enrichment re-rendered every page once per album resolved**, one at a time -- a real
  source of jank on a large library. Batched instead.
- Folder scanning is now delta-based (only new/removed folders trigger work) and streams results
  into the UI as they're found, rather than a full rescan on every launch that only appears once
  finished.

## Deliberately not implemented

- **YouTube Video Mode + downloading.** Downloading video off YouTube outside their official API
  sits in a Terms-of-Service gray area; rather than quietly wire it up, it's left as a stubbed
  TODO (`src/pages/playground/downloadService.ts`, the disabled Video toggle in Playground) for
  you to make a call on.
- **Genius lyrics, GitHub/Google/Facebook/Tidal/Jamendo/TikTok/VK/MusicBrainz/Amazon connections.**
  All need a server-side piece to hold a client secret and do the token exchange -- none of that
  exists yet. The redirect URIs are wired consistently (`blackmusic://<service>/callback`) so
  registering them now won't need to change later.
- **Spotify's own multi-track queue** (see "PlaybackContext" above) -- our own queue navigation
  drives Spotify tracks one URI at a time instead.
- **Most of the 10 Folder view styles** from the original app -- Cover Art View and List View are
  real; the rest are listed (so the menu matches) but fall back to List View.
