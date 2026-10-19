# BlackMusic 2.2.0 — Android & iOS

The desktop app and the mobile apps share one codebase (`src-tauri/src/lib.rs` is the common entry point).

## What changes on mobile (automatic)
| Feature | Mobile behaviour | Why |
|---|---|---|
| Layout | Bottom tab bar instead of the sidebar, touch-sized controls, safe-area padding, swipe-friendly shelves | `src/styles/mobile.css`, `useIsMobile()` |
| Library | **Automatic discovery is the default**; *Add folder* is for isolated folders | `src/lib/library/mobileDiscovery.ts` |
| Disabled | Mini player (PiP window), Dock Mode, file associations UI, yt-dlp / whisper.cpp tools, format converter, window-level features | no OS support / needs desktop binaries |
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
