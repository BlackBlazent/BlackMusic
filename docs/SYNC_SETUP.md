# Music Portable Sync — set-up (3.0.0)

Sync is optional. Without it BlackMusic is a fully local player.

**What syncs:** song details (title, artist, album, genre, year, composer, country, mood), playlists, favorites, play history, folder **names**. **What never syncs:** audio files and file paths.
**Audio between devices** goes directly device-to-device (WebRTC); Supabase only relays the tiny connection set-up messages on a private channel.

## One-time server set-up
1. In your Supabase project, open **SQL Editor** and run `supabase/migrations/20261028000000_blackmusic_sync.sql` (or `supabase db push`).
2. **Authentication → URL Configuration → Redirect URLs:** keep `blackmusic://auth/callback` (mobile and desktop sign-in).
3. **Realtime:** make sure Realtime is enabled for the project. The migration adds the policies that make the `p2p:<your user id>` channel private.
4. The app ships only the **anon** key. Never put a service-role key in the app.

## In the app
**Settings → Music Portable Sync:** sign in, turn it on, name the device. Choose *Automatic*, *Copy*, or *Stream with buffering*, and a monthly transfer budget. Open a folder under **Folder → On your other devices** to play or copy its songs.

## Connection notes
* Same Wi-Fi: works without anything extra.
* Different networks: devices find each other with a public STUN server (default: Google's, which sees both devices' network addresses). If a strict network blocks it, set your own TURN server in the same settings page.
* Linux builds use WebKitGTK; some distributions ship it without WebRTC. If so, device transfer says it is unsupported.
* Duplicate songs (same title, artist, album and length on both devices) are matched and not transferred twice.

## Tests to run before relying on it
Two devices, one account: create a playlist on each; delete one; favorite offline then reconnect; sign out and in; expired session; interrupted transfer; 10,000+ songs on one side.
