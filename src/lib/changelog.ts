export interface ChangelogSection {
  heading: string;
  items: string[];
}

export const CHANGELOG_2_1_0: { version: string; sections: ChangelogSection[] } = {
  version: "2.1.0",
  sections: [
    {
      heading: "Fixes",
      items: [
        "Sign-in now actually lands: Google, GitHub, Facebook (Not Available), Spotify and email return you to your account (photo, name, email, log out).",
        "Real profile placeholder icon when signed out.",
        "Add to playlist now adds every selected track at once, not just one.",
        "Interactive toggles turn pink when active.",
        "Library tabs stay fixed while you scroll.",
      ],
    },
    {
      heading: "New in Playground",
      items: [
      `Video Mode (official video via yt-dlp) with download to your Downloads folder.
      
      Note: Video Mode uses yt-dlp. If yt-dlp is not already installed:
      
      1. Download and install the latest version of Python from https://www.python.org/. During installation, enable "Add Python to PATH".
      2. Download the Raven yt-dlp Installer: https://github.com/BlackBlazent/BlackMusic/blob/main/scripts/raven_ytdl_installer.py
      3. Run the script. It will automatically install or update yt-dlp to the latest available version.
      4. Restart BlackMusic after installation.`,
      
        "Click the start time to type a position (e.g. 2:30) and jump there.",
        "Picture-in-Picture mini player, Ambient mode, Sleep timer (10m–1h by whole songs).",
        "Genius-powered lyric lookup, saved locally, with a styleable overlay.",
        "Draggable, minimizable link window.",
        "Playlists appear as folders in the queue strip; pin (up to 10), drag to reorder, edit metadata, remove.",
        "Fullscreen controls (Back, previous/next) and crop: fit, 1×1, 4×3, 16×9.",
],
    },
    {
      heading: "Local & Library",
      items: [
        "Album-art view, real filters, pinning (max 10), Play Selected, drag-to-reorder (saved).",
        "Edit metadata, hide, or remove tracks; custom playlist covers; remove tracks from playlists.",
        "All ten Folder view styles are complete; Open Folder uses the Explorer sidecar.",
      ],
    },
    {
      heading: "Services & more",
      items: [
        "Ready-to-wire clients for Tidal, Amazon Music, Apple Music, Deezer, SoundCloud, Last.fm, Pandora, Yandex and YouTube — just add keys.",
        "Settings: your own custom music API and service keys.",
        "Spotify now signs in through Supabase.",
        "Affiliate promotions (manual + Involve Asia) with strict placement rules.",
        "Resumes where you left off: track, position, page, views and filters.",
        "Resizable global playback bar with an up-next list.",
        "Much faster library import (parallel, batched).",
      ],
    },
  ],
};

export const CHANGELOG_2_2_0: { version: string; sections: ChangelogSection[] } = {
  version: "2.2.0",
  sections: [
    {
      heading: "Fixes",
      items: [
        "Update checks now explain exactly why they fail (draft release, missing Windows build in latest.json, bad signature) instead of a generic message — and the release workflow builds Windows and publishes non-draft releases so updating actually works.",
        "Services menu, link window, metadata editor and modals now live in one global overlay layer: they can be dragged anywhere, never disturb page layout, and the navbar and footer always stay on top.",
        "YouTube and Last.fm tracks are playable (stream resolver backed by the bundled yt-dlp, with Deezer/Audius fallbacks). Tidal, Spotify and other services now report the real reason when something fails; Spotify asks for the full permission set and has a Reconnect button.",
        "Service icons no longer get stuck on the large letter after one failed load.",
        "Playground stage never collapses: option panels are floating popovers, the page scrolls instead of squeezing, and lyrics adapt to the space available.",
        "yt-dlp ships with the app (and can be updated or replaced in Settings → Plugins & Tools) — no Python install needed.",
      ],
    },
    {
      heading: "Search",
      items: [
        "@youtube:, @online-<service>:, @lastfm: (tracks, artists, tag:, similar:), @musicbrainz:, @genius: (songs, artists, info), @music:, @page:.",
      ],
    },
    {
      heading: "Online",
      items: [
        "Spotify-style browse shelves for every service (stations, recents, best-of, favourite artists, podcasts where available) with a manual-promotion banner slot; the old table is one click away under List.",
      ],
    },
    {
      heading: "Playground",
      items: [
        "Karaoke lyrics, whisper.cpp lyric generation (offline), visualizer effects (Bars, Waves, Particles, Liquid), cover-art effects, timeline markers, focus zones, audio cutter, volume normalizer, pitch shifter, filters (reverb, echo, distortion, 8-bit), auto volume, deep-sleep fader, radio simulation, Hue mood lighting, live BPM/key/energy insights, aspect-ratio presets.",
      ],
    },
    {
      heading: "Library, Home, Folders",
      items: [
        "Library: Bitrate Analyzer, Duplicate Finder, Memory Lane, Mood Tuner, Batch Tag Editor, Format Converter (needs ffmpeg), File Organizer (preview only), Smart Playlists.",
        "Home: play this week / last 30 days, Memory Highlights, Listening Diary, Cover Battle.",
        "Folders: subfolder strip. Edit Metadata now covers album artist, year, genre, composer, comments, lyrics and artwork (embedded under 500 KB).",
      ],
    },
    {
      heading: "System",
      items: [
        "Open with BlackMusic: audio/video file associations (Windows, Linux, macOS), multi-file open, already-running app support.",
        "Settings → Personalization: banner (photo/video), dock mode, screensaver, cover effects, button animations. Settings → Language: English, Deutsch, 日本語, Português (Brasil), English (India), हिन्दी, Français, Español.",
        "Android and iOS: shared codebase, bottom navigation, automatic music discovery on mobile (see MOBILE.md).",
      ],
    },
  ],
};

export const LATEST_CHANGELOG = CHANGELOG_2_2_0;
