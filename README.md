# BlackMusic

BlackMusic is a desktop music player for the music you already have, plus the services you
already use — in one place, without giving up control of either.

## What it does

- **Plays your own library.** Point it at the folders where your music lives and it stays in
  sync — add a folder and only that folder gets scanned; nothing gets re-imported every time you
  open the app.
- **Brings in streaming services alongside your library**, not instead of it. Connect Spotify or
  Audius from the sidebar logo and switch between "my files" and "my Spotify" without leaving the
  app or opening a separate player window.
- **One now-playing bar, everywhere.** Whatever's playing follows you from page to page at the
  bottom of the window, with a floating shortcut back to the full player.
- **A proper "theater" view** (Playground) for when you want to actually look at what's playing —
  album art front and center, an optional lyrics overlay, a loop creator for practicing a section
  of a song on repeat, and a filmstrip of your library to jump between tracks.
- **Organizes what you have.** Local, Library (all music / albums / artists / playlists /
  favorites), and Folders for managing what's watched.
- **Stays out of your way by default.** Nothing talks to a third party you haven't explicitly
  connected — Last.fm (for missing album art) and YouTube are off until you turn them on in
  Settings.

## Getting it

BlackMusic isn't published anywhere yet — for now, building it from source is the only way to run
it. See **DEVELOPMENT.md** for how, including build instructions for Windows, macOS, and Linux.
Once it's set up, **Settings → Updates** will check GitHub Releases for new versions and install
them in place.

## Using it

- **Folders** — add the folders on your machine where your music lives. BlackMusic watches them;
  removing a folder here removes its tracks from the app (not from your disk).
- **Local** — every track found in your watched folders, sortable and filterable, with pin/sort/
  select tools in the corner.
- **Library** — the same music organized by album, by artist, as playlists you build, or just your
  favorites.
- **Online** — pick a connected service from the logo in the top-left of the sidebar; this page
  shows that service's content. Spotify needs a Premium account to actually play here — that's
  Spotify's own restriction on their Web Playback SDK, not something BlackMusic adds.
- **Playground** — the full-screen "now playing" view. Toggle the lyrics overlay, set up a loop
  section to repeat a part of a song, drop in a link to embed something, adjust playback speed.
- **Settings** — theme, per-integration on/off switches, account, and update checks.

## A couple of things worth knowing

- **Spotify playback requires Spotify Premium.** Free accounts can authorize the app but can't use
  the Web Playback SDK that makes in-app playback possible — this is Spotify's restriction.
- **Video Mode and downloading from YouTube aren't implemented.** Downloading video off YouTube
  outside their official API sits in a legal gray area around their Terms of Service, so rather
  than quietly build it in, it's left as an open question for you to decide on — see
  DEVELOPMENT.md.
- Nothing about how you use BlackMusic is sent anywhere except to the services you explicitly
  connect, and only once you've connected them.
