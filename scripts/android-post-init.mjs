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
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { installNativeAddons } from "./native-addons.mjs";

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

// FIX-05 (3.0.0) — OAuth return path. Supabase answers the provider login with `302 -> blackmusic://auth/callback?code=...`.
// Without a BROWSABLE intent filter for that scheme Android has nothing to hand the link to, so Chrome just shows the
// raw "<a href=blackmusic://auth/callback?...>Found</a>" body and the user is never signed in.
const authFilter = `
            <intent-filter>
                <action android:name="android.intent.action.VIEW" />
                <category android:name="android.intent.category.DEFAULT" />
                <category android:name="android.intent.category.BROWSABLE" />
                <data android:scheme="blackmusic" android:host="auth" android:pathPrefix="/callback" />
                <data android:scheme="blackmusic" android:host="spotify" android:pathPrefix="/callback" />
            </intent-filter>`;
if (!manifest.includes('android:scheme="blackmusic"')) {
  manifest = manifest.replace(/(<activity[\s\S]*?android:name="\.MainActivity"[\s\S]*?>)/, `$1${authFilter}`);
}
// One MainActivity instance, so a callback link re-uses the running app (and its stored PKCE verifier) instead of starting a second one.
if (!/android:launchMode=/.test(manifest)) {
  manifest = manifest.replace(/(<activity[^>]*android:name="\.MainActivity")/, '$1 android:launchMode="singleTask"');
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
      webView.addJavascriptInterface(NativeBridge(applicationContext) { MediaHub.webView }, "BMNative")
      webView.addJavascriptInterface(StorageBridge(this) { MediaHub.webView }, "BMStorage")
    }
`;
    const lastBrace = src.lastIndexOf("}");
    src = src.slice(0, lastBrace) + hook + src.slice(lastBrace);
    changed = true;
  }
  
  /*
  // Projects patched by an older run: add the BMNative line once.
  if (pkg && src.includes("BLACKMUSIC_MEDIA_BRIDGE") && !src.includes('"BMNative"')) {
    src = src.replace(/(webView\.addJavascriptInterface\(MediaBridge\(applicationContext\), "BlackMusicMedia"\))/, '$1\n      webView.addJavascriptInterface(NativeBridge(applicationContext) { MediaHub.webView }, "BMNative")');
    changed = true;
  }
  if (changed) writeFileSync(kt, src);
  */

   // Projects patched by an older run: add the BMNative line once.
  if (pkg && src.includes("BLACKMUSIC_MEDIA_BRIDGE") && !src.includes('"BMNative"')) {
    src = src.replace(/(webView\.addJavascriptInterface\(MediaBridge\(applicationContext\), "BlackMusicMedia"\))/, '$1\n      webView.addJavascriptInterface(NativeBridge(applicationContext) { MediaHub.webView }, "BMNative")');
    changed = true;
  }

  // FIX-03: Add StorageBridge to previously initialized Android projects.
  if (pkg && src.includes("BLACKMUSIC_MEDIA_BRIDGE") && !src.includes('"BMStorage"')) {
    src = src.replace(
      /(webView\.addJavascriptInterface\(NativeBridge\(applicationContext\) \{ MediaHub\.webView \}, "BMNative"\))/,
      '$1\n      webView.addJavascriptInterface(StorageBridge(this) { MediaHub.webView }, "BMStorage")'
    );
    changed = true;
  }

  // FIX-03: Forward Android's file-write permission result to StorageBridge.
  // BLACKMUSIC_STORAGE_BRIDGE — forwards the MediaStore write-grant result to StorageBridge.
  if (pkg && !src.includes("BLACKMUSIC_STORAGE_BRIDGE")) {
    const hook = `
    // BLACKMUSIC_STORAGE_BRIDGE
    override fun onActivityResult(requestCode: Int, resultCode: Int, data: android.content.Intent?) {
      super.onActivityResult(requestCode, resultCode, data)
      // StorageBridge.onActivityResult(requestCode, resultCode)
      StorageBridge.onActivityResult(requestCode, resultCode, data)
    }
`;
    const lastBrace = src.lastIndexOf("}");
    src = src.slice(0, lastBrace) + hook + src.slice(lastBrace);
    changed = true;
  }

  // Projects patched before the folder picker existed: pass the result Intent through as well.
if (src.includes("StorageBridge.onActivityResult(requestCode, resultCode)")) {
  src = src.replace(
    "StorageBridge.onActivityResult(requestCode, resultCode)",
    "StorageBridge.onActivityResult(requestCode, resultCode, data)"
  );
  changed = true;
}

  if (changed) writeFileSync(kt, src);

  if (pkg) {
    const templates = join(dirname(fileURLToPath(import.meta.url)), "android");
    const outDir = dirname(kt);
    // for (const name of ["MediaHub", "MediaBridge", "MediaPlaybackService", "MediaActionReceiver", "BlackMusicWidget"]) 
    for (const name of ["MediaHub", "MediaBridge", "MediaPlaybackService", "MediaActionReceiver", "BlackMusicWidget", "StorageBridge"]) {
      const body = readFileSync(join(templates, `${name}.kt.tpl`), "utf8").replaceAll("__PKG__", pkg);
      writeFileSync(join(outDir, `${name}.kt`), body);
    }
    installNativeAddons({ pkg, srcMain: root, appDir: join(root, "..", ".."), javaDir: outDir });
    let m = readFileSync(manifestPath, "utf8");
    // FEAT-10: home-screen widget receiver
    if (!m.includes(".BlackMusicWidget")) {
      m = m.replace(/<\/application>/, `    <receiver android:name=".BlackMusicWidget" android:exported="false" android:label="BlackMusic">
            <intent-filter><action android:name="android.appwidget.action.APPWIDGET_UPDATE" /></intent-filter>
            <meta-data android:name="android.appwidget.provider" android:resource="@xml/bm_widget_info" />
        </receiver>
    </application>`);
      writeFileSync(manifestPath, m);
    }
    // FEAT-03c: same-Wi-Fi rooms talk plain ws:// to a computer on the local network (an IP address cannot have a certificate).
    if (!m.includes("usesCleartextTraffic")) {
      m = m.replace(/<application/, '<application android:usesCleartextTraffic="true"');
      writeFileSync(manifestPath, m);
    }
    // FEAT-15: Android TV — no touchscreen required, appears in the Leanback launcher; a phone is unaffected.
    if (!m.includes("android.software.leanback")) {
      m = m.replace(/<application/, `<uses-feature android:name="android.hardware.touchscreen" android:required="false" />
    <uses-feature android:name="android.software.leanback" android:required="false" />
    <application`);
      m = m.replace(/(<activity[\s\S]*?android:name="\.MainActivity"[\s\S]*?>)/, `$1
            <intent-filter>
                <action android:name="android.intent.action.MAIN" />
                <category android:name="android.intent.category.LEANBACK_LAUNCHER" />
            </intent-filter>`);
      if (!m.includes("android:banner=")) m = m.replace(/<application/, '<application android:banner="@mipmap/ic_launcher"');
      writeFileSync(manifestPath, m);
    }
    if (!m.includes(".MediaPlaybackService")) {
      m = m.replace(/<\/application>/, `    <service android:name=".MediaPlaybackService" android:exported="false" android:foregroundServiceType="mediaPlayback" />
        <receiver android:name=".MediaActionReceiver" android:exported="false" />
    </application>`);
      writeFileSync(manifestPath, m);
    }
  } else console.warn("Couldn't read the Android package name — media controls were not installed.");
}
// Resources used by the notification icon (IMP-01) and the widget (FEAT-10). Written only when missing, so edits survive.
const res = join(root, "res");
const put = (rel, body) => {
  const f = join(res, rel);
  if (!existsSync(f)) {
    mkdirSync(dirname(f), { recursive: true });
    writeFileSync(f, body);
  }
};
put("drawable/ic_stat_music.xml", `<vector xmlns:android="http://schemas.android.com/apk/res/android" android:width="24dp" android:height="24dp" android:viewportWidth="24" android:viewportHeight="24">
    <path android:fillColor="#FFFFFFFF" android:pathData="M12,3v10.55c-0.59,-0.34 -1.27,-0.55 -2,-0.55 -2.21,0 -4,1.79 -4,4s1.79,4 4,4 4,-1.79 4,-4V7h4V3h-6z" />
</vector>
`);
put("drawable/bm_widget_bg.xml", `<shape xmlns:android="http://schemas.android.com/apk/res/android" android:shape="rectangle">
    <solid android:color="#E6282C34" />
    <corners android:radius="18dp" />
</shape>
`);
put("xml/bm_widget_info.xml", `<appwidget-provider xmlns:android="http://schemas.android.com/apk/res/android"
    android:minWidth="250dp" android:minHeight="70dp" android:targetCellWidth="4" android:targetCellHeight="1"
    android:updatePeriodMillis="0" android:resizeMode="horizontal" android:widgetCategory="home_screen"
    android:initialLayout="@layout/bm_widget" android:description="@string/bm_widget_desc" />
`);
put("layout/bm_widget.xml", `<LinearLayout xmlns:android="http://schemas.android.com/apk/res/android" android:layout_width="match_parent" android:layout_height="match_parent"
    android:background="@drawable/bm_widget_bg" android:gravity="center_vertical" android:orientation="horizontal" android:padding="12dp">
    <LinearLayout android:id="@+id/bm_widget_text" android:layout_width="0dp" android:layout_height="wrap_content" android:layout_weight="1" android:orientation="vertical">
        <TextView android:id="@+id/bm_widget_title" android:layout_width="match_parent" android:layout_height="wrap_content" android:ellipsize="end" android:maxLines="1" android:textColor="#FFFFFF" android:textSize="15sp" android:textStyle="bold" />
        <TextView android:id="@+id/bm_widget_artist" android:layout_width="match_parent" android:layout_height="wrap_content" android:ellipsize="end" android:maxLines="1" android:textColor="#ABB2BF" android:textSize="12sp" />
    </LinearLayout>
    <ImageButton android:id="@+id/bm_widget_prev" android:layout_width="40dp" android:layout_height="40dp" android:background="@null" android:contentDescription="Previous" android:src="@android:drawable/ic_media_previous" />
    <ImageButton android:id="@+id/bm_widget_play" android:layout_width="44dp" android:layout_height="44dp" android:background="@null" android:contentDescription="Play" android:src="@android:drawable/ic_media_play" />
    <ImageButton android:id="@+id/bm_widget_next" android:layout_width="40dp" android:layout_height="40dp" android:background="@null" android:contentDescription="Next" android:src="@android:drawable/ic_media_next" />
</LinearLayout>
`);
put("values/bm_widget_strings.xml", `<resources>
    <string name="bm_widget_idle">Nothing playing</string>
    <string name="bm_widget_desc">Now playing, with previous, play/pause and next.</string>
</resources>
`);
console.log("Android project patched.");
