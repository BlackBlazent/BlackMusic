# Mobile native add-ons: on-device FFmpeg and whisper.cpp

BlackMusic's phone app can convert audio and transcribe speech **on the device**. Those two features use C/C++ libraries that are **not stored in this repository**. You add them, and the build wires them in automatically. A build without them still works; the app then says "add-on not installed" where it is needed (it never fails silently).

| Feature | Needs | Where it goes |
|---|---|---|
| Format Converter, speech-to-text input | FFmpeg audio library (Android `.aar`) | `native/android/ffmpeg-kit/*.aar` |
| Speech-to-text (lyrics from audio) | whisper.cpp source | `native/android/whisper.cpp/` (the folder that contains `CMakeLists.txt`) |

Speech-to-text needs **both** (FFmpeg prepares the audio, whisper reads it). The Batch Tag Editor and File Organizer need neither.

## What you need to provide
### 1. FFmpeg (audio only)
* Get an **LGPL "audio" build** of [FFmpegKit for Android](https://github.com/ffmpegkit-maintained/ffmpeg-kit) (a `.aar`). Check the licence you accept: keep to the **LGPL** variant and follow its terms (e.g. say you use FFmpeg and allow relinking). **Verify the project's current maintenance status first** — the original FFmpegKit repository was archived; a maintained fork or your own build is fine, as long as the AAR exposes `com.arthenica.ffmpegkit.FFmpegKit` (the code calls `FFmpegKit.executeWithArguments`).
* Copy it to `native/android/ffmpeg-kit/` (any file name ending in `.aar`).

### 2. whisper.cpp
* `git clone --depth 1 --branch <tag> https://github.com/ggml-org/whisper.cpp native/android/whisper.cpp` (pick a release tag; test it).
* The build script compiles it for Android with CMake (NDK 26, CMake 3.22.1 from the SDK Manager) and adds a small JNI layer. Models are **not** bundled (Google Play policy): users download them in **Settings → Plug-ins & Tools** from the official source over HTTPS; the app checks size and file signature before use and lets users delete them.

## Build
```bash
pnpm install
pnpm tauri android init
node scripts/android-post-init.mjs        # prints which add-ons it found and wired in
pnpm tauri:android                         # or tauri:android:dev
```
In GitHub Actions (`mobile.yml`) you can instead set repository **variables** `WHISPER_CPP_REF` (a tag) and `FFMPEG_KIT_AAR_URL` (direct link to the AAR you may use); the workflow fetches them. Commit large files with Git LFS, or keep them out of git and use the variables.

## How it works (so you can change it)
`scripts/native-addons.mjs` generates `NativeBridge.kt` (always), `WhisperNative.kt` + `cpp/whisper_jni.cpp` + `CMakeLists.txt` (only if whisper.cpp is present), adds the Gradle lines and keep-rules, and the web app calls it through `window.BMNative` (`src/lib/mobileNative.ts`). Capability flags come from `BMNative.capabilities()`.

## Checklist before a Play Store release
- [ ] Both add-ons built on a **real device** (convert a song; transcribe a 30 s clip with the `tiny` model).
- [ ] 16 KB page-size support: use NDK r27+ / recent whisper.cpp, and check the FFmpeg `.so` files are 16 KB aligned.
- [ ] Licence notices for FFmpeg (LGPL) and whisper.cpp (MIT) shown in the app or store listing.
- [ ] No model file is bundled in the APK/AAB.

## iOS
Not automated. Steps for a developer with Xcode:
1. Build whisper.cpp as an XCFramework (`./build-xcframework.sh` in the whisper.cpp repo) and add it to the app target.
2. Add an FFmpeg build for iOS (LGPL audio). Keep to the same licence rules.
3. Expose them to the web view with a `WKScriptMessageHandler` that implements the same three calls as `NativeBridge.kt` (`capabilities`, `ffmpegRun`, `whisperTranscribe`) and answers through `window.__bmNativeResult(id, json)`.
The web side needs no change: it already uses `window.BMNative` if present. (A WKWebView exposes native code through message handlers, so a small JS shim that defines `window.BMNative` and posts messages is needed; keep the same method names.)
