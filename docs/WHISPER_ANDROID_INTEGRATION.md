# BlackMusic — Android Whisper.cpp Integration & Build Guide

> **Purpose:** This is the handover and maintenance guide for building BlackMusic for Android with local Whisper.cpp speech recognition. It combines the earlier native C++/linker investigation with the Kotlin source fix and the later successful universal-release APK build.
>
> **Last verified build:** November 5, 2026  
> **Build result:** `BUILD SUCCESSFUL` — `pnpm tauri android build --apk --verbose`  
> **Project used for verification:** `C:\Projects\BlackMusic`  
> **Status:** Full Android APK build is successful. Runtime transcription and device-level Whisper operation still need separate testing.

---

## Quick synopsis

There were two distinct build blockers during this integration:

1. **Native C++ link stage — Whisper JNI / C++ runtime.** The earlier investigation traced unresolved C++ runtime symbols to Clang being invoked through a Windows short executable name (`CLANG_~1.EXE`), which can cause C driver mode to be selected instead of C++ driver mode. Replaying the real JNI link with `--driver-mode=g++` succeeded manually. This is a linker-driver issue, not evidence that Whisper.cpp or GGML source is missing.
2. **Kotlin compile stage — unclosed nested block comment.** A KDoc line contained `ffmpeg-kit/*.aar`. Kotlin supports nested block comments, so the `/*` inside that path opened a nested comment. The apparent closing `*/` closed the nested comment rather than the outer KDoc. The compiler consequently reported `Unclosed comment` in `NativeBridge.kt`; `MainActivity.kt` then reported `Unresolved reference: NativeBridge` as a downstream parse consequence. Replacing the comment text with `ffmpeg-kit (AAR files)` fixed the parser error without changing executable code.

After the Kotlin comment correction, the complete Tauri/Gradle Android build completed successfully. The log reports successful CMake/Ninja `whisper_jni` builds, Kotlin compilation, universal release APK assembly, and:

```text
BUILD SUCCESSFUL in 8m 35s
247 actionable tasks: 31 executed, 216 up-to-date
```

**APK output:**

```text
C:\Projects\BlackMusic\src-tauri\gen\android\app\build\outputs\apk\universal\release\app-universal-release.apk
```

This confirms a successful APK build. It does not, by itself, prove that Whisper transcription works on a physical device; test model loading, JNI calls, audio preprocessing, and transcription separately.

---

## 1. Architecture at a glance

BlackMusic integrates Whisper.cpp into its Android application using the Android NDK, CMake/Ninja, JNI, and Kotlin.

| Layer | Responsibility |
|---|---|
| React / TypeScript | Application UI and frontend feature integration |
| Tauri / Rust | Desktop/mobile application bridge and Rust-side functionality |
| Kotlin / Android | Android activity and native bridge integration |
| JNI C++ | Exposes Whisper native functionality to Android/JVM code |
| whisper.cpp | Local speech-recognition engine |
| GGML | Tensor and compute implementation used by Whisper |
| Android NDK + Clang | Compiles and links native Android code |
| CMake + Ninja | Configures and executes native builds |
| Gradle | Coordinates Kotlin, native builds, packaging, and APK assembly |

The JNI shared library target is named `whisper_jni`; its Android shared-library filename is conventionally `libwhisper_jni.so`.

The earlier integration notes identify Android API level 24 as the native minimum used in the linker diagnostic example. Verify the current `minSdk` and ABI configuration in the project before changing them; do not treat a diagnostic command as authoritative configuration.

---

## 2. Native linker investigation: what happened and what fixed the diagnosis

### 2.1 Symptoms

The earlier failure occurred while linking the JNI shared library. The linker reported undefined references to C++ runtime symbols originating from Whisper.cpp and its dependencies.

The relevant native components included static libraries such as:

- `libwhisper.a`
- `libggml.a`
- `libggml-cpu.a`
- `libggml-base.a`

These libraries contain C++ code. The final JNI shared-library link must use the appropriate Android C++ runtime.

### 2.2 Root cause found in the investigation

The generated Ninja link command invoked Clang through a Windows short executable name:

```text
CLANG_~1.EXE
```

That short name does not retain the `++` suffix from `clang++.exe`. Clang can therefore interpret the invocation as C driver mode rather than C++ driver mode. In C driver mode, the C++ runtime is not automatically selected in the same way as it is by the C++ driver.

The investigation recorded these results:

1. The original Ninja-generated JNI link command failed.
2. Replaying the link with the full `clang++.exe` executable path succeeded.
3. The full and short executable paths resolved to the same Clang binary.
4. Explicitly passing `--driver-mode=g++` made the short-path invocation use C++ driver mode.
5. Replaying the complete JNI link operation with that option succeeded.
6. The manual replay returned exit code `0` and produced `libwhisper_jni.so` of approximately 14.8 MB.

**Interpretation:** This was a Clang driver-mode / C++ runtime linkage issue. It was not evidence that Whisper.cpp or GGML was absent or inherently incompatible with Android.

### 2.3 Targeted CMake workaround

The earlier investigation proposed this target-specific option:

```cmake
target_link_options(whisper_jni PRIVATE --driver-mode=g++)
```

It belongs after the `whisper_jni` target has been created. Example placement:

```cmake
add_library(whisper_jni SHARED whisper_jni.cpp)

target_include_directories(whisper_jni PRIVATE
    "${WHISPER_SOURCE_DIR}/include"
    "${WHISPER_SOURCE_DIR}/ggml/include"
)

target_link_libraries(whisper_jni whisper log android)

# Force Clang to use C++ driver mode for this JNI shared-library link.
target_link_options(whisper_jni PRIVATE --driver-mode=g++)
```

Keep the target name and existing Whisper/GGML dependencies consistent with the project. Do not copy this illustrative snippet over the complete project CMake file without comparing the current configuration first.

### 2.4 What the successful full build proves — and what it does not

The November 5 successful build log shows CMake/Ninja successfully building the `whisper_jni` target for the configured Android ABI build tasks. It also shows the overall APK build succeeding.

However, the uploaded successful log does **not** print the actual linker command and does not contain the literal `--driver-mode=g++` string. Therefore:

- **Confirmed:** the native `whisper_jni` CMake/Ninja build tasks completed successfully in the full Gradle/Tauri build.
- **Confirmed:** the complete universal-release APK build succeeded.
- **Confirmed from the earlier diagnostic replay:** the manual JNI link succeeded when `--driver-mode=g++` was explicitly supplied.
- **Not independently confirmed by the final log:** that the generated Ninja command for this successful build contained that exact option.
- **Maintenance action:** retain the working native CMake configuration and, when changing it, inspect the generated link command to ensure the C++ runtime selection remains correct.

Do not describe the manual linker replay as the sole proof of the final APK build. The final Gradle build is a separate and stronger end-to-end build result.

---

## 3. Kotlin parser failure: root cause and correction

### 3.1 Compiler errors

The earlier Kotlin compile failure reported:

```text
MainActivity.kt:38:38 Unresolved reference: NativeBridge
NativeBridge.kt:59:1 Unclosed comment
```

The important primary error was `Unclosed comment` in `NativeBridge.kt`. The unresolved `NativeBridge` reference in `MainActivity.kt` was consistent with Kotlin failing to parse the bridge source file.

### 3.2 Exact source of the unclosed comment

The KDoc contained a path-like example:

```kotlin
*   - FFmpeg (audio only) — present when native/android/ffmpeg-kit/*.aar was supplied at build time
```

The sequence `/*` occurs inside `ffmpeg-kit/*.aar`:

```text
ffmpeg-kit/ *
           ^^
```

More precisely, the slash followed by the asterisk is the Kotlin block-comment opener `/*`. Kotlin block comments can be nested. That sequence therefore starts an inner block comment inside the KDoc. The visible `*/` later in the KDoc closes the inner comment, leaving the outer KDoc comment open. The compiler reaches the end of the file and reports `Unclosed comment`.

### 3.3 Minimal safe correction

The comment was changed to wording that does not contain the `/*` token:

```kotlin
*   - FFmpeg (audio only) — present when native/android/ffmpeg-kit (AAR files) was supplied at build time
```

This is a documentation-only correction. It does not change the JNI API, Kotlin runtime behavior, native library name, or Whisper implementation.

### 3.4 Safe PowerShell patch

If this exact issue reappears in a working copy, first confirm the path and expected old text. The following script creates a backup and changes only the comment phrase:

```powershell
$File = "C:\Projects\BlackMusic\src-tauri\gen\android\app\src\main\java\com\blackmusic\blackblazent\ravensyntha\NativeBridge.kt"

Copy-Item $File "$File.before-comment-fix.bak" -Force

$Text = [System.IO.File]::ReadAllText($File)
$Old = "native/android/ffmpeg-kit/*.aar"
$New = "native/android/ffmpeg-kit (AAR files)"

if (-not $Text.Contains($Old)) {
    Write-Host "ERROR: Expected text was not found. No change made." -ForegroundColor Red
} else {
    $Text = $Text.Replace($Old, $New)
    [System.IO.File]::WriteAllText(
        $File,
        $Text,
        [System.Text.UTF8Encoding]::new($false)
    )
    Write-Host "SUCCESS: Kotlin comment fixed." -ForegroundColor Green
}
```

Verify the beginning of the file:

```powershell
Get-Content $File | Select-Object -First 20
```

Then rebuild. If the comment has already been corrected, do not apply the replacement repeatedly or modify unrelated Kotlin code.

### 3.5 Kotlin maintenance rules

- Avoid raw `/*` and `*/` sequences inside KDoc examples unless deliberately balanced for Kotlin's nested-comment rules.
- Prefer prose such as `AAR files in the ffmpeg-kit directory` over wildcard path examples that contain comment delimiters.
- When Kotlin reports `Unclosed comment`, inspect comments earlier in the file before changing imports, package declarations, or class names.
- Treat an unresolved class that lives in a file with a parser error as potentially downstream until the parser error is fixed and compilation is retried.
- Keep the package declaration, Kotlin class/object name, and references from `MainActivity.kt` consistent.
- Do not rewrite the bridge implementation to fix a comment-only parsing issue.

---

## 4. Important project files

The paths below reflect the working copy used in the November 5 build. Some Android files are under Tauri's generated `gen/android` tree; check the repository's generation process before assuming that a generated file is the permanent source of truth.

### 4.1 Whisper.cpp source and GGML

```text
native/
└── android/
    └── whisper.cpp/
        ├── CMakeLists.txt
        ├── include/
        ├── src/
        └── ggml/
```

**Role:** Whisper engine source and its GGML implementation.

**Preserve:**
- The full source tree and required submodules/dependencies.
- Project-specific changes and the version/revision used by the JNI integration.
- The upstream CMake configuration unless a deliberate, tested change is required.

Do not replace or update Whisper.cpp independently of the JNI wrapper without checking API compatibility and rebuilding Android.

### 4.2 JNI C++ integration

```text
src-tauri/
└── gen/
    └── android/
        └── app/
            └── src/
                └── main/
                    └── cpp/
                        ├── CMakeLists.txt
                        └── whisper_jni.cpp
```

**Role:**
- `CMakeLists.txt` defines the `whisper_jni` target, includes Whisper.cpp, and links Android/native dependencies.
- `whisper_jni.cpp` implements the native JNI functions.

**Preserve:**
- The JNI implementation and exported function signatures.
- The target name `whisper_jni`, unless every dependent reference is intentionally changed.
- Whisper/GGML include paths and link dependencies.
- Any validated target-specific C++ driver-mode setting.

### 4.3 Kotlin Android integration

```text
src-tauri/
└── gen/
    └── android/
        └── app/
            └── src/
                └── main/
                    └── java/
                        └── com/
                            └── blackmusic/
                                └── blackblazent/
                                    └── ravensyntha/
                                        ├── MainActivity.kt
                                        ├── NativeBridge.kt
                                        └── WhisperNative.kt
```

**Role:** Android-side bridge and activity integration. The final build log lists these Kotlin source files in the compiler's source inputs.

**Preserve:**
- The package declaration and directory relationship.
- The bridge types and method signatures expected by `MainActivity.kt`.
- The Kotlin-to-JNI method names and signatures expected by `whisper_jni.cpp`.
- The native library loading name, which must match the built library.
- The corrected KDoc wording; do not reintroduce the nested-comment token.

### 4.4 Gradle and generated native build files

```text
src-tauri/
└── gen/
    └── android/
        └── app/
            ├── build.gradle.kts
            ├── src/main/cpp/CMakeLists.txt
            └── .cxx/
                └── RelWithDebInfo/
                    └── <build-hash>/
                        └── <abi>/
                            ├── build.ninja
                            └── CMakeCache.txt
```

Gradle's Android module configures CMake. `.cxx`, `build.ninja`, and `CMakeCache.txt` are generated build state.

**Do not:**
- Edit `build.ninja` as a permanent fix.
- Treat `CMakeCache.txt` as authoritative source.
- Copy `.cxx` from another machine or project checkout as a substitute for correct configuration.
- assume that editing a file under `gen/android` will survive Tauri Android regeneration.

**Important follow-up:** Identify the repository-owned script, template, or generation hook that creates `gen/android/app/src/main/cpp/CMakeLists.txt` and the Kotlin files. Keep durable customizations in that authoritative source whenever possible. The supplied build log does not identify that generator, so this guide does not guess its location.

---

## 5. Reproducing the Android APK build

### 5.1 Environment recorded in the successful build

The November 5 build log records:

| Component | Value recorded |
|---|---|
| Project root | `C:\Projects\BlackMusic` |
| Tauri CLI | Android build invoked through `pnpm tauri` |
| Android SDK | `C:\Users\Albina\AppData\Local\Android\Sdk` |
| NDK detected by Tauri | `27.1.12297006` |
| CMake | `3.22.1` |
| Gradle | `8.14.3` |
| Android Gradle Plugin | `8.11.0` appears in the R8/proguard log |
| Kotlin | Kotlin Android plugin; compiler task `compileUniversalReleaseKotlin` |
| Rust crate | `blackmusic v3.0.0` |
| Build variant | `universalRelease` |
| Build command | `pnpm tauri android build --apk --verbose` |

**NDK version note:** Tauri's initial detection reported NDK `27.1.12297006`, while Gradle's Android module repeatedly reported `android.ndkVersion` as `27.0.12077973`. The log also says `ndkPath` and `ndk.dir` are not set. This discrepancy did not prevent this build from succeeding, but it should be reconciled deliberately in a future environment setup. Do not silently change the NDK version just because two tools report different values.

### 5.2 Build command

From PowerShell:

```powershell
Set-Location "C:\Projects\BlackMusic"
pnpm tauri android build --apk --verbose
```

The Tauri build hook runs the frontend build (`pnpm build`, which invokes `tsc -b && vite build` in the recorded run), compiles the Rust Android target, then invokes the Android Gradle build.

### 5.3 Successful build evidence

The final supplied log records:

```text
✓ built in 4.85s
Finished `release` profile [optimized] target(s) in 1m 33s
```

It also records successful CMake/Ninja target execution, including `whisper_jni` for the ABI tasks shown:

```text
C/C++: evaluate library whisper_jni (...)
C/C++: about to build targets whisper_jni
C/C++: Build whisper_jni
C/C++: Received process result: 0
C/C++: check expected build outputs
C/C++: build complete
```

Kotlin compilation proceeded without the previous `Unclosed comment` or `Unresolved reference: NativeBridge` errors. The universal release APK was assembled:

```text
> Task :app:assembleUniversalRelease
...
BUILD SUCCESSFUL in 8m 35s
247 actionable tasks: 31 executed, 216 up-to-date
```

Tauri then reported one APK at:

```text
C:\Projects\BlackMusic\src-tauri\gen\android\app\build\outputs\apk\universal\release\app-universal-release.apk
```

### 5.4 Check the APK exists

```powershell
$Apk = "C:\Projects\BlackMusic\src-tauri\gen\android\app\build\outputs\apk\universal\release\app-universal-release.apk"

if (Test-Path $Apk) {
    Get-Item $Apk | Select-Object FullName, Length, LastWriteTime
} else {
    Write-Error "APK was not found at the expected output path."
}
```

Optional install to a connected Android device:

```powershell
adb devices
adb install -r "$Apk"
```

Installation is not a substitute for testing the Whisper feature itself.

---

## 6. ABI and packaging caution

The successful log includes Android Gradle warning `CXX5202` for `armeabi-v7a` and `x86`, stating that the app only has 32-bit native libraries for those ABI variants and reminding that Google Play requires 64-bit native libraries.

The log also shows CMake/Ninja `whisper_jni` build tasks for ABI names including:

- `armeabi-v7a`
- `arm64-v8a`
- `x86`
- `x86_64`

These statements are not contradictory: a native target being built for an ABI does not alone prove every native library required by the APK is packaged for that ABI. The warning is specifically about the app's native-library packaging for the affected variants.

Before publishing:
1. Inspect the APK's actual `lib/<abi>/` contents.
2. Confirm every native library required by the app is present for each ABI you claim to support.
3. Ensure at least the required 64-bit ABI coverage for Play distribution.
4. If only `arm64-v8a` is intended to be supported, configure ABI filters consistently and test on a matching device.
5. Do not suppress the warning without correcting or consciously narrowing the supported ABI set.

The supplied log does not include a final APK contents listing, so this guide does not claim that all four ABIs are packaged correctly.

---

## 7. Updating BlackMusic without losing Whisper integration

When merging a future application update, preserve the integration source and regenerate build artifacts. Do not copy stale build output.

### Keep and review these source components

| Component | Preserve? | Reason |
|---|---:|---|
| `native/android/whisper.cpp/` | Yes | Whisper engine and GGML source |
| `whisper_jni.cpp` | Yes | Native JNI implementation |
| JNI `CMakeLists.txt` | Yes | Native target, includes, link dependencies, linker options |
| Kotlin `NativeBridge.kt` | Yes | Android bridge API |
| Kotlin `WhisperNative.kt` | Yes | Native method declarations/loading integration |
| Kotlin `MainActivity.kt` | Yes | Android activity integration |
| Relevant Rust integration | Yes | Application-side native/mobile integration |
| Relevant frontend Whisper integration | Yes | UI and feature invocation |
| Model configuration/assets | Review and preserve as required | Model selection and runtime loading |
| Generated `.cxx/` | No | Recreated by CMake/Gradle |
| Generated `.a` files | No | Rebuilt from source |
| Generated `.so` outputs | No | Rebuilt per ABI |
| Temporary linker diagnostics | No | Investigation artifacts |

This list is limited to Whisper-related components. It is not a general instruction to delete or omit other Android project files.

### Update procedure

1. **Start from the intended project revision.** Confirm the repository root and branch before copying files.
2. **Preserve the Whisper.cpp tree.** Confirm its CMake file, include directory, source directory, and GGML subdirectory are present.
3. **Preserve the JNI interface.** Compare C++ exported JNI symbols with Kotlin native declarations and package/class names.
4. **Preserve CMake configuration.** Keep the `whisper_jni` target, its Whisper/GGML dependencies, Android system libraries, and any validated C++ driver-mode option.
5. **Preserve Kotlin integration.** Keep the bridge classes and ensure KDoc does not contain accidental nested comment openers such as `/*`.
6. **Find the authoritative generator.** If `gen/android` is regenerated, move durable customizations into the source/template or generation hook that produces it. Do not guess this location; verify it in the repository.
7. **Regenerate native build state.** Let Gradle/CMake/Ninja rebuild. Do not copy another machine's `.cxx` directory.
8. **Build the APK.** Run the command in Section 5.
9. **Inspect ABI packaging.** Resolve or document the `CXX5202` warning before distribution.
10. **Test on device.** Install the APK and test model loading and a real transcription.

---

## 8. Troubleshooting decision tree

### A. Linker reports undefined C++ symbols while building `libwhisper_jni.so`

Check in this order:

1. Is the Whisper.cpp source tree present and complete?
2. Is GGML included and are the expected static libraries linked?
3. Is the JNI target actually named `whisper_jni`?
4. What exact compiler executable does the generated Ninja link command invoke?
5. Does the invocation use C++ driver mode?
6. Does the Clang link plan include the Android C++ runtime?
7. Does the same complete link command succeed when replayed with `clang++` or with `--driver-mode=g++`?

Useful commands (adjust the build directory and ABI to the current build):

```powershell
$BuildDir = "C:\Projects\BlackMusic\src-tauri\gen\android\app\.cxx\RelWithDebInfo\<build-hash>\arm64-v8a"

Select-String -Path "$BuildDir\build.ninja" -Pattern "whisper_jni|libwhisper_jni"
```

Inspect the CMake source:

```powershell
$JniCMake = "C:\Projects\BlackMusic\src-tauri\gen\android\app\src\main\cpp\CMakeLists.txt"
Get-Content $JniCMake
```

Do not use a minimal compiler test as a substitute for replaying the actual generated JNI link command with all of its original arguments.

### B. Kotlin reports `Unclosed comment`

1. Open the exact file and line reported by the compiler.
2. Inspect preceding KDoc/block comments for `/*` or `*/` sequences embedded in examples or paths.
3. Remember that Kotlin block comments nest.
4. Rewrite the path/example in prose to avoid accidental comment delimiters.
5. Rebuild before changing class names or imports.

### C. `MainActivity.kt` reports `Unresolved reference: NativeBridge`

1. Check whether `NativeBridge.kt` itself has a parser error.
2. Fix the first Kotlin syntax/parser error first.
3. Confirm the package declaration matches the directory and imports.
4. Confirm the declared class/object name matches the usage in `MainActivity.kt`.
5. Re-run Kotlin compilation before making unrelated changes.

### D. `whisper_jni` builds but the app cannot load the library

A successful native build does not prove runtime loading. Check:

- The `.so` file is packaged under the expected `lib/<abi>/` directory.
- The Kotlin `System.loadLibrary(...)` name matches the library basename (without `lib` prefix and `.so` suffix).
- The device ABI is supported by the packaged APK.
- All dependent native shared libraries are present.
- JNI exported names/signatures match the Kotlin declarations.
- Runtime logcat output for `UnsatisfiedLinkError`, missing symbols, or ABI mismatch.

### E. APK builds but transcription fails

Investigate separately from compilation:

- Model file availability, path, and permissions.
- Audio decoding and expected sample format/rate.
- JNI method invocation and returned error handling.
- Native memory use and lifecycle.
- Device ABI and runtime dependencies.
- Logcat/native logs around model initialization and inference.

A successful APK build is not proof of successful transcription.

---

## 9. Warnings observed in the successful build

The final build log includes warnings that did not fail APK assembly:

- Vite reported several modules being both dynamically and statically imported. These are chunking warnings, not the Whisper JNI linker failure.
- Rust reported unused code items, including `decode_to_wav_16k`, `WHISPER_BUSY`, `WHISPER_TIMEOUT`, `BusyGuard`, and `sanitize`.
- Kotlin reported deprecated `databaseEnabled` setter usage in generated `RustWebView.kt`.
- R8 reported ProGuard keep rules that did not match anything.
- Gradle reported deprecated features that may be incompatible with Gradle 9.0.
- Android Gradle reported `CXX5202` 32-bit-only native-library warnings for `armeabi-v7a` and `x86`.
- The log shows the NDK version discrepancy described in Section 5.1.

These warnings should be triaged independently. Do not confuse them with the previous Kotlin unclosed-comment failure or the earlier native C++ runtime linker failure.

---

## 10. Contributor checklist

Before merging a change that touches Android Whisper integration:

- [ ] Whisper.cpp source and GGML dependencies are present.
- [ ] JNI C++ source and Kotlin bridge declarations still agree.
- [ ] `whisper_jni` target name and library loading name agree.
- [ ] CMake includes and link dependencies are preserved.
- [ ] C++ driver mode / Android C++ runtime behavior has been checked if linker configuration changed.
- [ ] Kotlin comments do not contain accidental nested comment openers.
- [ ] The authoritative source/template for generated Android files has been identified.
- [ ] No permanent fix exists only in generated `build.ninja` or `.cxx` output.
- [ ] `pnpm tauri android build --apk --verbose` completes successfully.
- [ ] The produced APK exists and its ABI contents have been inspected.
- [ ] The APK installs on a supported Android device.
- [ ] Whisper model loading and actual transcription have been tested.

---

## 11. Verification status as of November 5, 2026

| Item | Status | Evidence / qualification |
|---|---|---|
| Whisper.cpp and GGML integration | Present in build configuration | Earlier integration investigation and successful CMake tasks |
| JNI target `whisper_jni` | Built successfully | CMake/Ninja target completed in final log |
| Earlier Clang C++ driver-mode diagnosis | Diagnosed | Manual replay evidence in earlier investigation |
| Manual link with `--driver-mode=g++` | Successful | Exit code 0; approximately 14.8 MB output |
| Exact driver-mode flag in final Ninja command | Not shown in final log | Inspect generated command if validating this specific detail |
| Kotlin `NativeBridge.kt` parser failure | Fixed | The `ffmpeg-kit/*.aar` KDoc example was rewritten |
| `MainActivity.kt` unresolved bridge reference | No longer reported | Final Kotlin compilation succeeded |
| Kotlin release compilation | Successful | `compileUniversalReleaseKotlin` completed |
| Universal release APK assembly | Successful | `assembleUniversalRelease` completed |
| Full Tauri Android APK build | **Successful** | `BUILD SUCCESSFUL in 8m 35s` |
| APK output | Reported by Tauri | Exact path in Section 5 |
| All ABI packaging | Needs inspection | `CXX5202` warnings for `armeabi-v7a` and `x86` |
| Whisper runtime transcription | Not yet verified by this build log | Requires device test |
| Authoritative generator for `gen/android` custom files | Still to identify | Must inspect repository generation workflow |

---

## 12. Final engineering notes

The integration encountered two different classes of failure, at different stages:

- **Native linking:** Clang driver mode affected how the C++ runtime was selected for the Whisper JNI shared-library link. The earlier investigation demonstrated a successful manual link using C++ driver mode. The latest complete build then demonstrated successful CMake/Ninja native target execution and APK assembly.
- **Kotlin parsing:** An apparent path wildcard in KDoc accidentally formed a nested block-comment opener. Rewording the comment fixed the Kotlin parser failure; it was not necessary to redesign the bridge or change native code.

The final recorded build command:

```powershell
pnpm tauri android build --apk --verbose
```

completed successfully and produced:

```text
src-tauri/gen/android/app/build/outputs/apk/universal/release/app-universal-release.apk
```

Treat this as a **verified build milestone**, not a claim that every Android ABI is correctly packaged or that Whisper transcription has already passed runtime testing. Those are the next validation steps.

The most important long-term maintenance task is to identify where Tauri's Android project generation obtains the custom JNI CMake and Kotlin files. Keep permanent changes in the repository-owned source/template or generation hook so a future regeneration does not erase them.


---

## 13. Supplemental: Make the Whisper JNI Linker Fix Persistent

This section extends the linker investigation and Android regeneration guidance above. Its purpose is to ensure that the C++ driver-mode workaround is present when needed and is not lost when Tauri regenerates the Android project.

### 13.1 Check whether the CMake fix already exists

Inspect:

```text
src-tauri/gen/android/app/src/main/cpp/CMakeLists.txt
```

Look for this exact instruction:

```cmake
target_link_options(whisper_jni PRIVATE --driver-mode=g++)
```

- If the instruction already exists after the `whisper_jni` target is declared, do not add a duplicate.
- If it is missing, add it after the target has been created and its libraries have been linked.

Example:

```cmake
add_library(whisper_jni SHARED whisper_jni.cpp)

target_include_directories(whisper_jni PRIVATE
    "${WHISPER_SOURCE_DIR}/include"
    "${WHISPER_SOURCE_DIR}/ggml/include"
)

target_link_libraries(whisper_jni whisper log android)

# Workaround: force C++ driver behavior for Windows NDK short-path Clang invocation.
target_link_options(whisper_jni PRIVATE --driver-mode=g++)
```

Keep the existing target name, include paths, and dependencies. Do not replace the complete project CMake file with this illustrative snippet.

### 13.2 Identify the authoritative Android project generator

The CMake file above is inside Tauri's generated Android project:

```text
src-tauri/gen/android/
```

A direct edit there may be lost when the Android project is regenerated.

Investigate these repository scripts:

```text
scripts/native-addons.mjs
scripts/android-post-init.mjs
```

They are candidate locations only; neither is confirmed by the supplied build log as the authoritative generator.

Search the repository for the code that creates or modifies:

```text
app/src/main/cpp/CMakeLists.txt
```

Then determine which script, template, or post-initialization hook actually writes the `whisper_jni` CMake configuration.

### 13.3 Add the option to the generator only if it is missing

After identifying the authoritative generator:

1. Inspect the CMake content that the generator writes.
2. Check whether it already includes `target_link_options(whisper_jni PRIVATE --driver-mode=g++)`.
3. If the option is missing, add it to the generated CMake content immediately after the `whisper_jni` target and its link dependencies are declared.
4. If the option is already present, leave it in place and avoid inserting a duplicate.
5. Preserve the existing Whisper.cpp and GGML configuration, Android system-library dependencies, and JNI target.
6. Ensure the post-initialization workflow does not overwrite or remove the option.

Do not modify generated `build.ninja` as the permanent solution. The durable change belongs in the source, template, or generation hook that produces the CMake file.

### 13.4 Regenerate and verify the actual Ninja linker command

After updating the authoritative generator, regenerate or reinitialize the Android project using the project's normal workflow.

Inspect the generated native build directory under:

```text
src-tauri/gen/android/app/.cxx/
```

Find the `build.ninja` file for the relevant build configuration and ABI, then inspect the `whisper_jni` link command.

For example, from PowerShell:

```powershell
$AndroidApp = "C:\Projects\BlackMusic\src-tauri\gen\android\app"

Get-ChildItem "$AndroidApp\.cxx" -Filter build.ninja -Recurse |
    Select-String -Pattern "whisper_jni|libwhisper_jni"
```

The actual `whisper_jni` linker command must contain:

```text
--driver-mode=g++
```

If it is absent, the option has not reached the generated Ninja link command. Recheck the CMake source, generator, and CMake reconfiguration rather than assuming the fix was applied.

### 13.5 Rebuild and validate

From the project root:

```powershell
Set-Location "C:\Projects\BlackMusic"
pnpm tauri android build --apk --verbose
```

Verify that:

- The `whisper_jni` target links successfully.
- The previous unresolved C++ runtime symbols no longer appear.
- The Android APK build completes successfully.
- The resulting APK contains the expected native library for each ABI the application intends to support.

A successful build should be recorded with its build log and the relevant generated linker command so the presence of the workaround can be verified later.

### 13.6 Completion checklist

- [ ] Existing `CMakeLists.txt` checked for the linker option.
- [ ] `target_link_options` added only if it was missing.
- [ ] Authoritative Android project generator identified by inspecting the repository.
- [ ] Candidate scripts reviewed: `scripts/native-addons.mjs` and `scripts/android-post-init.mjs`.
- [ ] Generator updated only if its generated CMake content lacked the option.
- [ ] Android regeneration preserves the option.
- [ ] Generated `build.ninja` contains `--driver-mode=g++` in the `whisper_jni` link command.
- [ ] `libwhisper_jni.so` links successfully.
- [ ] The Android APK build succeeds.
- [ ] ABI packaging and device-level Whisper transcription are validated separately.

**Completion note:** The supplied build evidence establishes the earlier manual linker workaround and a successful full APK build, but it does not identify the authoritative generator or prove that the successful build's Ninja command contained this flag. Those checks remain required before marking the persistent fix as verified.
