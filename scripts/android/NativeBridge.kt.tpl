package __PKG__

import android.content.Context
import android.webkit.JavascriptInterface
import android.webkit.WebView
import org.json.JSONArray
import org.json.JSONObject
import java.util.concurrent.Executors

/**
 * Exposed to the web app as `window.BMNative` (see src/lib/mobileNative.ts). OPTIONAL native add-ons:
 *   - FFmpeg (audio only)  — present when native/android/ffmpeg-kit/*.aar was supplied at build time
 *   - whisper.cpp          — present when native/android/whisper.cpp/ was supplied at build time
 * scripts/native-addons.mjs fills the __HAS_*__ flags and the code between the markers. Without the add-ons this class still compiles
 * and simply reports `{"ffmpeg":false,"whisper":false}`, so the app shows a clear message instead of failing.
 * Work runs on one background thread; the answer returns through window.__bmNativeResult(id, json). Nothing here ever blocks the UI.
 */
class NativeBridge(private val ctx: Context, private val webView: () -> WebView?) {
    private val pool = Executors.newSingleThreadExecutor()

    @JavascriptInterface
    fun capabilities(): String = "{\"ffmpeg\":__HAS_FFMPEG__,\"whisper\":__HAS_WHISPER__}"

    @JavascriptInterface
    fun ffmpegRun(id: String, argsJson: String) {
        pool.execute {
            val out = JSONObject()
            try {
                /*FFMPEG_BEGIN*/
                out.put("code", -1).put("stderr", "FFmpeg add-on not installed")
                /*FFMPEG_END*/
            } catch (t: Throwable) {
                out.put("code", -1).put("stderr", t.message ?: t.javaClass.simpleName)
            }
            reply(id, out.toString())
        }
    }

    @JavascriptInterface
    fun whisperTranscribe(id: String, modelPath: String, wavPath: String, language: String) {
        pool.execute {
            val out = JSONObject()
            try {
                /*WHISPER_BEGIN*/
                out.put("error", "whisper.cpp add-on not installed")
                /*WHISPER_END*/
            } catch (t: Throwable) {
                out.put("error", "Speech-to-text failed: " + (t.message ?: t.javaClass.simpleName))
            }
            reply(id, out.toString())
        }
    }

    private fun reply(id: String, json: String) {
        val wv = webView() ?: return
        wv.post { wv.evaluateJavascript("window.__bmNativeResult&&window.__bmNativeResult(${JSONObject.quote(id)},${JSONObject.quote(json)})", null) }
    }
}
