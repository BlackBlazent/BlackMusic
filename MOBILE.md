# BlackMusic 3.0.0 (in progress) — Android & iOS

The desktop app and the mobile apps share one codebase (`src-tauri/src/lib.rs` is the common entry point).

## What changes on mobile (automatic)
| Feature | Mobile behaviour | Why |
|---|---|---|
| Layout | Bottom tab bar instead of the sidebar, touch-sized controls, safe-area padding, swipe-friendly shelves | `src/styles/mobile.css`, `useIsMobile()` |
| Library | **Automatic discovery is the default**; *Add folder* is for isolated folders | `src/lib/library/mobileDiscovery.ts` |
| Disabled | Mini player (PiP window), Dock Mode, file associations UI, window-level features. **yt-dlp and the desktop FFmpeg runner are not compiled into mobile builds at all** (video uses the YouTube API: search and play, no download) | no OS support / store policy |
| Tools (3.0.0) | Batch Tag Editor and File Organizer work on mobile. Format Converter and speech-to-text work when the optional native add-ons are included — see [docs/MOBILE_NATIVE.md](docs/MOBILE_NATIVE.md); otherwise they explain that the add-on is missing | native libraries are supplied by you |
| Updater | Hidden — updates come from the store / sideloaded builds | `tauri-plugin-updater` is desktop-only |
| Screensaver | Works as an in-app visualizer after 5 min idle (a true OS screensaver is not possible on mobile) | platform limit |

## Android (builds on Windows)
1. Install Android Studio (SDK 34, NDK 26), JDK 17, and the Rust targets:
   `rustup target add aarch64-linux-android armv7-linux-androideabi i686-linux-android x86_64-linux-android`
2. Set `JAVA_HOME`, `ANDROID_HOME`, `NDK_HOME`.
3. `pnpm tauri android init`
4. `node scripts/android-post-init.mjs` — adds the permissions (audio library, notifications, foreground service),
   the "Open with" intent filter and the runtime permission prompt. **Re-run after every `android init`.**
5. `pnpm tauri:android:dev` (device/emulator) or `pnpm tauri:android` (release `.apk` / `.aab`).
   For a Play Store `.aab`, configure signing in `src-tauri/gen/android/app/build.gradle.kts`.

Permissions requested: `READ_MEDIA_AUDIO` (Android 13+), `READ_EXTERNAL_STORAGE` (≤ 12), `POST_NOTIFICATIONS`,
`FOREGROUND_SERVICE(_MEDIA_PLAYBACK)`, `WAKE_LOCK`, `INTERNET`.

## iOS (build through GitHub Actions)
`.github/workflows/mobile.yml` builds iOS on a GitHub macOS runner (iOS can't be built on Windows).
1. Push to GitHub, then run **Actions → BlackMusic Mobile → Run workflow** (or push a `vX.Y.Z` tag).
2. Add repository secrets: `APPLE_DEVELOPMENT_TEAM` (+ the `VITE_*` keys). For App Store/TestFlight signing, add your
   certificate/provisioning secrets and change `--export-method` to `app-store-connect`.
3. Info.plist additions (after `pnpm tauri ios init`, in `src-tauri/gen/apple/*/Info.plist`):
   - `NSAppleMusicUsageDescription` — "BlackMusic plays music from your library."
   - `UIBackgroundModes` → `audio`
   - `UIFileSharingEnabled` and `LSSupportsOpeningDocumentsInPlace` → `true` (lets users drop music into the app's Files folder)

### iOS limitation (manual step)
iOS does not let an app scan other apps' files or the system music library from Rust. **Automatic discovery on iOS
scans the app's own Documents folder** (reachable from the Files app); for the Apple Music library you would add a small
Swift plugin using `MPMediaQuery` — not included. *Add folder* (document picker) works for everything else.

## Manual testing checklist
- [ ] First launch asks for the audio permission; music appears without importing a folder
- [ ] *Add folder* imports an extra folder
- [ ] Bottom navigation + mini playback bar usable one-handed, nothing clipped by notch / gesture bar
- [ ] Playback continues with the screen off (foreground service)
- [ ] Opening an audio file from the Files app offers BlackMusic (Android)

## 2.2.0 immediate fix — what changed for phones
- `pnpm tauri android init` then `node scripts/android-post-init.mjs` now also installs: window-inset handling (bottom nav above the system bar) and **Media Controls** (MediaSession + MediaStyle notification + foreground service; sources in `scripts/android/*.kt.tpl`). It relies on `TauriActivity.onWebViewCreate`; if your Tauri version names it differently the script's marker `BLACKMUSIC_MEDIA_BRIDGE` shows where to adjust.
- Automatic discovery watches whole volumes (internal + SD) and retries whenever the app returns to the foreground, so it fills in right after the permission prompt. Removing a discovered folder is remembered; “Find music on this device” (Folders) restores it.
- Android only lists audio the app may see: files in folders that aren't indexed, or video containers (.mp4), can be invisible to a path scan. The Folders page now shows what was skipped and why. iOS can only read the app's own Documents folder plus folders you pick.
- iOS ignores `audio.volume` (hardware buttons control it).

## 3.0.0 — what changed for phones and TVs
- **Sign-in fix:** the Android build now registers `blackmusic://auth/callback` (intent filter + `singleTask`), so GitHub / Google / Facebook sign-in returns to the app. Keep that URL in Supabase → Auth → Redirect URLs.
- **Audio focus (Android):** another app's sound pauses BlackMusic and it resumes afterwards; a permanent loss stays paused. **iOS:** `scripts/ios-post-init.mjs` (run by `mobile.yml`) adds an audio-interruption observer.
- **Media notification** updates immediately; the status-bar icon is a white silhouette.
- **SD card:** if the card's top level is locked (Android 11+), its Music/Download/… folders are watched instead; the Folders page shows the reason and a *Copy storage details* button.
- **Home-screen widget** (Android): now playing + previous / play-pause / next.
- **Same-Wi-Fi Meet Room:** Android uses plain `ws://` on the local network (`usesCleartextTraffic`), iOS asks for local-network access (`src-tauri/Info.ios.plist`). Hosting is from a computer; phones join.
- **Android TV:** see [docs/TV.md](docs/TV.md).
- **Native add-ons workflow:** `.github/workflows/mobile.yml` can fetch whisper.cpp and an FFmpeg AAR from repository variables; see [docs/MOBILE_NATIVE.md](docs/MOBILE_NATIVE.md).

## iOS home-screen widget (manual, needs Xcode)
A widget on iOS is a separate **WidgetKit extension target**, which can't be generated safely from a script. Steps:
1. Open `src-tauri/gen/apple/*.xcodeproj` → **File → New → Target → Widget Extension** ("BlackMusicWidget", no Live Activity).
2. Enable the same **App Group** (e.g. `group.com.blackmusic.blackblazent.ravensyntha`) on the app and the extension.
3. The app writes now-playing details (title, artist, playing) into the App Group's `UserDefaults`; the widget's `TimelineProvider` reads them. Add a tiny Tauri/Swift command (or the same WKScriptMessageHandler used for the native add-ons) to write them when the web app's `mediaSession` state changes — the web side already knows the state (`src/lib/mediaSession.ts`).
4. Widgets can't run playback; use `Link`/App Intents (iOS 17+) for the buttons.
