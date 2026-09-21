# BlackMusic

**BlackMusic** is a desktop music player for the music you already have, plus the services you already use — in one place, without giving up control of either.

[![Version](https://img.shields.io/github/v/release/BlackBlazent/BlackMusic?display_name=tag\&sort=semver\&label=Version\&labelColor=090040\&color=B13BFF)](https://github.com/BlackBlazent/BlackMusic/releases)
[![GitHub Downloads](https://img.shields.io/github/downloads/BlackBlazent/BlackMusic/total?label=GitHub%20Downloads\&labelColor=090040\&color=B13BFF)](https://github.com/BlackBlazent/BlackMusic/releases)
[![Project](https://img.shields.io/badge/Project-BlackMusic-B13BFF?labelColor=090040)](https://github.com/BlackBlazent/BlackMusic)
[![License](https://img.shields.io/github/license/BlackBlazent/BlackMusic?label=License\&labelColor=090040\&color=B13BFF)](https://github.com/BlackBlazent/BlackMusic)

**Current version:** `2.0.0`

## Downloads

Get BlackMusic from the following distribution channels:

[![GitHub Releases](https://img.shields.io/badge/GitHub%20Releases-Download-B13BFF?logo=github\&logoColor=white\&labelColor=090040)](https://github.com/BlackBlazent/BlackMusic/releases)
[![itch.io](https://img.shields.io/badge/itch.io-Download-B13BFF?logo=itchdotio\&logoColor=white\&labelColor=090040)](https://jednaz-lonestamp.itch.io/blackmusic)
[![SourceForge](https://img.shields.io/badge/SourceForge-Download-B13BFF?logo=sourceforge\&logoColor=white\&labelColor=090040)](https://sourceforge.net/projects/blackmusic/)

### Store availability

[![Microsoft Store](https://img.shields.io/badge/Microsoft%20Store-Not%20Available-B13BFF?logo=microsoft\&logoColor=white\&labelColor=090040)](#)
[![Uptodown](https://img.shields.io/badge/Uptodown-Not%20Available-B13BFF?labelColor=090040)](#)
[![Softonic](https://img.shields.io/badge/Softonic-Not%20Available-B13BFF?labelColor=090040)](#)

GitHub Releases remain the primary release source for BlackMusic during development and distribution.

## Screenshots

<div align="center">

<img src="https://a.fsdn.com/con/app/proj/blackmusic/screenshots/Slide1-9902ff54.PNG/max/max/1" alt="BlackMusic Library">

</div>

## What it does

* **Plays your own library.** Point it at the folders where your music lives and it stays in sync — add a folder and only that folder gets scanned; nothing gets re-imported every time you open the app.

* **Brings in streaming services alongside your library**, not instead of it. Connect Spotify or Audius from the sidebar logo and switch between "my files" and "my Spotify" without leaving the app or opening a separate player window.

* **One now-playing bar, everywhere.** Whatever's playing follows you from page to page at the bottom of the window, with a floating shortcut back to the full player.

* **A proper "theater" view** (Playground) for when you want to actually look at what's playing — album art front and center, an optional lyrics overlay, a loop creator for practicing a section of a song on repeat, and a filmstrip of your library to jump between tracks.

* **Organizes what you have.** Local, Library (all music / albums / artists / playlists / favorites), and Folders for managing what's available.

* **Stays out of your way by default.** Nothing talks to a third party you haven't explicitly connected — Last.fm (for missing album art) and YouTube are off until you turn them on in Settings.

## Getting it

BlackMusic is currently distributed through GitHub Releases and selected external distribution platforms.

For developers who want to build BlackMusic from source, see **[DEVELOPMENT.md](DEVELOPMENT.md)** for setup and build instructions, including Windows, macOS, and Linux.

Once it's set up, **Settings → Updates** will check GitHub Releases for new versions and install them in place.

## Using it

* **Folders** — add the folders on your machine where your music lives. BlackMusic watches them; removing a folder here removes its tracks from the app, not from your disk.

* **Local** — every track found in your watched folders, sortable and filterable, with pin, sort, and select tools in the corner.

* **Library** — the same music organized by album, by artist, as playlists you build, or just your favorites.

* **Online** — pick a connected service from the logo in the top-left of the sidebar; this page shows that service's content. Spotify needs a Premium account to actually play here — that's Spotify's own restriction on their Web Playback SDK, not something BlackMusic adds.

* **Playground** — the full-screen "now playing" view. Toggle the lyrics overlay, set up a loop section to repeat a part of a song, drop in a link to embed something, and adjust playback speed.

* **Settings** — theme, per-integration on/off switches, account, and update checks.

## A couple of things worth knowing

* **Spotify playback requires Spotify Premium.** Free accounts can authorize the app but can't use the Web Playback SDK that makes in-app playback possible — this is Spotify's restriction.

* **Video Mode and downloading from YouTube aren't implemented.** Downloading video off YouTube outside their official API sits in a legal gray area around their Terms of Service, so rather than quietly build it in, it's left as an open question for you to decide on — see **DEVELOPMENT.md**.

* **Third-party services are opt-in.** Nothing about how you use BlackMusic is sent to third-party services unless you explicitly connect or enable a supported integration.

## Project

BlackMusic is developed by **BlackBlazent**.

The project focuses on providing a local-first desktop music experience while allowing users to connect supported online music services when they choose.

## Distribution Status

| Platform        | Status        |
| --------------- | ------------- |
| GitHub Releases | Available     |
| itch.io         | Available     |
| SourceForge     | Available     |
| Microsoft Store | Not Available |
| Uptodown        | Not Available |
| Softonic        | Not Available |

## License

BlackMusic is released under the **MIT License**.

See the [LICENSE](LICENSE) file for the complete terms.
