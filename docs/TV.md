# BlackMusic on TV (3.0.0 — work in progress)

| Target | State | How |
|---|---|---|
| **Android TV** (Sony, TCL, Hisense, Fire TV, Chromecast with Google TV) | Manifest + remote control done; **not yet tested on a real TV** | Same Android build as the phone. `scripts/android-post-init.mjs` adds the Leanback launcher entry and "touchscreen not required". |
| **LG webOS** | Package script done; **not yet tested on a real TV** | `pnpm build:webos` builds the web app into `dist-webos/` and packages it with LG's `ares-package` if installed. Tauri cannot target webOS, so this is the web build. |
| **Apple TV (tvOS)** | **Starting scaffold only** — no real tvOS interface yet | `apple-tv/` (React Native tvOS) + `.github/workflows/build-appletv.yml` |

## Remote control (D-pad)
On a TV there is no mouse or touch. BlackMusic detects TV browsers (or `?tv=1` in the address for testing on a computer) and then:
Up / Down / Left / Right moves focus to the nearest button, card or field in that direction; Enter activates it; the focus ring is large and everything is bigger.
Code: `src/lib/tv/spatialNavigation.ts`, `src/app/components/TvMode.tsx`. Phones and desktops are not affected.

## Android TV: build and test
1. Follow the Android steps in [MOBILE.md](../MOBILE.md) (`pnpm tauri android init`, then `node scripts/android-post-init.mjs`).
2. On the TV: **Settings → System → About**, click *Android TV OS Build* 7 times; then enable *USB/ADB debugging* in Developer options.
3. `adb connect <TV_IP>:5555`, then `pnpm tauri android dev` (or install the release APK with `adb install`).
4. TVs mostly use `armeabi-v7a` or `arm64-v8a`; build for the right one.
5. Check: the app appears on the Android TV home screen; every screen can be reached with the D-pad only.

## LG webOS: build and test
```bash
npm i -g @webos-tools/cli      # LG's CLI (ares-*)
pnpm build:webos               # writes dist-webos/ ; packages it when ares-package is found
ares-setup-device              # add your TV (it must be in Developer Mode)
ares-install --device <tv> dist-webos-ipk/*.ipk
ares-launch  --device <tv> com.blackblazent.blackmusic
```
The web build has no native shell, so features that need Rust (library scanning from folders, tag writing) are not available there; the app shows a clear message instead of failing.

## Apple TV: for developers who want to run it
Needs a Mac with Xcode and CocoaPods.
1. Generate the tvOS project once (the template name may change; check the react-native-tvos README):
   `cd apple-tv && npx @react-native-community/cli@latest init BlackMusicTV --template @react-native-tvos/template --directory tmp-tv`
   then move the generated `ios/` (and `android/` if wanted) into `apple-tv/`, keeping this repo's `App.tsx`, `metro.config.js` and `package.json`.
2. `cd apple-tv && npm install && (cd ios && pod install)`
3. `npm run tvos` (simulator) — or open `apple-tv/ios/*.xcworkspace` in Xcode.
4. The shared logic is imported from the main project with `import … from "main-src/…"` (see `apple-tv/metro.config.js`). Only import pure TypeScript — no DOM, Tauri or React Router.
5. CI: **Actions → Apple TV add-on (manual)** builds an unsigned simulator build once `apple-tv/ios` exists and the scheme/workspace names in the workflow match your project.

What does **not** exist yet: the tvOS screens (library, player, search) — `App.tsx` is a placeholder. Contributions welcome.
