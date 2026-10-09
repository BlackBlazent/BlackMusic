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
