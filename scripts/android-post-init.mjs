#!/usr/bin/env node
/**
 * Run AFTER `pnpm tauri android init` (and again after any re-init). Patches the generated Android project:
 *   - AndroidManifest.xml: audio-library permissions, notification + foreground-service permissions, hardware
 *     acceleration, and VIEW intent filters so "Open with BlackMusic" works for audio files on Android;
 *   - MainActivity.kt: asks for the media permission at launch (Android 13+: READ_MEDIA_AUDIO, older: READ_EXTERNAL_STORAGE),
 *     which is what lets BlackMusic's automatic music discovery see the device's music.
 *   - MainActivity.kt: pads the window by the system-bar / cutout / keyboard insets, so the bottom navigation sits ABOVE the
 *     Android gesture / 3-button bar and nothing hides under the status bar (the template enables edge-to-edge, which otherwise
 *     draws the web view under the system bars and gives WebView no reliable CSS safe-area insets);
 *   - Media Controls: MediaHub / MediaBridge / MediaPlaybackService / MediaActionReceiver (scripts/android/*.kt.tpl) — the
 *     notification-shade / lock-screen playback card, plus the `window.BlackMusicMedia` bridge used by src/lib/mediaSession.ts.
 * Idempotent: running it twice changes nothing.
 */
import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(process.cwd(), "src-tauri", "gen", "android", "app", "src", "main");
const manifestPath = join(root, "AndroidManifest.xml");
if (!existsSync(manifestPath)) {
  console.error("Android project not found. Run `pnpm tauri android init` first.");
  process.exit(1);
}

let manifest = readFileSync(manifestPath, "utf8");
const perms = [
  "android.permission.INTERNET",
  "android.permission.READ_MEDIA_AUDIO",
  'android.permission.READ_EXTERNAL_STORAGE" android:maxSdkVersion="32',
  "android.permission.POST_NOTIFICATIONS",
  "android.permission.FOREGROUND_SERVICE",
  "android.permission.FOREGROUND_SERVICE_MEDIA_PLAYBACK",
  "android.permission.WAKE_LOCK",
];
for (const p of perms) {
  const name = p.split('"')[0];
  if (!manifest.includes(`android:name="${name}"`)) {
    manifest = manifest.replace(/<application/, `<uses-permission android:name="${p}" />\n    <application`);
  }
}

const filters = `
            <intent-filter>
                <action android:name="android.intent.action.VIEW" />
                <category android:name="android.intent.category.DEFAULT" />
                <category android:name="android.intent.category.BROWSABLE" />
                <data android:scheme="content" />
                <data android:scheme="file" />
                <data android:mimeType="audio/*" />
            </intent-filter>`;
if (!manifest.includes('android:mimeType="audio/*"')) {
  manifest = manifest.replace(/(<activity[\s\S]*?android:name="\.MainActivity"[\s\S]*?>)/, `$1${filters}`);
}
writeFileSync(manifestPath, manifest);

// MainActivity.kt
function findKt(dir) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      const hit = findKt(full);
      if (hit) return hit;
    } else if (entry === "MainActivity.kt") return full;
  }
  return null;
}
const kt = findKt(join(root, "java"));
if (kt) {
  let src = readFileSync(kt, "utf8");
  if (!src.includes("BLACKMUSIC_MEDIA_PERMISSION")) {
    src = src.replace(/import androidx.activity.enableEdgeToEdge/, "import androidx.activity.enableEdgeToEdge\nimport android.Manifest\nimport android.os.Build\nimport androidx.core.app.ActivityCompat\nimport androidx.core.content.ContextCompat\nimport android.content.pm.PackageManager");
    if (!src.includes("import android.Manifest")) {
      src = src.replace(/(package [^\n]+\n)/, "$1\nimport android.Manifest\nimport android.os.Build\nimport androidx.core.app.ActivityCompat\nimport androidx.core.content.ContextCompat\nimport android.content.pm.PackageManager\n");
    }
    src = src.replace(/super\.onCreate\(savedInstanceState\)/, `super.onCreate(savedInstanceState)
    // BLACKMUSIC_MEDIA_PERMISSION — lets BlackMusic's automatic music discovery read the device's audio library.
    val perms = if (Build.VERSION.SDK_INT >= 33)
      arrayOf(Manifest.permission.READ_MEDIA_AUDIO, Manifest.permission.POST_NOTIFICATIONS)
    else arrayOf(Manifest.permission.READ_EXTERNAL_STORAGE)
    val missing = perms.filter { ContextCompat.checkSelfPermission(this, it) != PackageManager.PERMISSION_GRANTED }
    if (missing.isNotEmpty()) ActivityCompat.requestPermissions(this, missing.toTypedArray(), 4201)`);
    writeFileSync(kt, src);
  }
} else console.warn("MainActivity.kt not found — add the runtime permission request manually (see MOBILE.md).");

// ---- Insets + media controls ------------------------------------------------------------------------------------------
if (kt) {
  let src = readFileSync(kt, "utf8");
  const pkg = /^package\s+([\w.]+)/m.exec(src)?.[1];
  let changed = false;

  if (!src.includes("BLACKMUSIC_INSETS")) {
    src = src.replace(/super\.onCreate\(savedInstanceState\)/, `super.onCreate(savedInstanceState)
    // BLACKMUSIC_INSETS — keep the app clear of the status bar, display cutout, gesture/3-button bar and keyboard.
    androidx.core.view.ViewCompat.setOnApplyWindowInsetsListener(findViewById<android.view.View>(android.R.id.content)) { v, insets ->
      val bars = insets.getInsets(
        androidx.core.view.WindowInsetsCompat.Type.systemBars() or
          androidx.core.view.WindowInsetsCompat.Type.displayCutout() or
          androidx.core.view.WindowInsetsCompat.Type.ime()
      )
      v.setPadding(bars.left, bars.top, bars.right, bars.bottom)
      androidx.core.view.WindowInsetsCompat.CONSUMED
    }`);
    changed = true;
  }

  if (pkg && !src.includes("BLACKMUSIC_MEDIA_BRIDGE")) {
    const hook = `
    // BLACKMUSIC_MEDIA_BRIDGE — notification-shade / lock-screen media controls (window.BlackMusicMedia)
    override fun onWebViewCreate(webView: android.webkit.WebView) {
      super.onWebViewCreate(webView)
      MediaHub.webView = webView
      webView.addJavascriptInterface(MediaBridge(applicationContext), "BlackMusicMedia")
    }
`;
    const lastBrace = src.lastIndexOf("}");
    src = src.slice(0, lastBrace) + hook + src.slice(lastBrace);
    changed = true;
  }
  if (changed) writeFileSync(kt, src);

  if (pkg) {
    const templates = join(dirname(fileURLToPath(import.meta.url)), "android");
    const outDir = dirname(kt);
    for (const name of ["MediaHub", "MediaBridge", "MediaPlaybackService", "MediaActionReceiver"]) {
      const body = readFileSync(join(templates, `${name}.kt.tpl`), "utf8").replaceAll("__PKG__", pkg);
      writeFileSync(join(outDir, `${name}.kt`), body);
    }
    let m = readFileSync(manifestPath, "utf8");
    if (!m.includes(".MediaPlaybackService")) {
      m = m.replace(/<\/application>/, `    <service android:name=".MediaPlaybackService" android:exported="false" android:foregroundServiceType="mediaPlayback" />
        <receiver android:name=".MediaActionReceiver" android:exported="false" />
    </application>`);
      writeFileSync(manifestPath, m);
    }
  } else console.warn("Couldn't read the Android package name — media controls were not installed.");
}
console.log("Android project patched.");
