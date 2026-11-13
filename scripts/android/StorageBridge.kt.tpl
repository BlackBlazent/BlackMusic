package __PKG__

import android.app.Activity
import android.content.ContentUris
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.provider.MediaStore
import android.webkit.JavascriptInterface
import android.webkit.WebView
import org.json.JSONArray
import org.json.JSONObject

/**
 * Exposed to the web app as `window.BMStorage` (see src/lib/library/metadataEditor.ts).
 * Android 11+ scoped storage: BlackMusic may read a song in Downloads/Music but not open it for writing (EACCES, os error 13).
 * openForWrite() finds the song in MediaStore, asks the user ONCE for write access to that one file (MediaStore.createWriteRequest),
 * and answers through window.__bmNativeResult(id, json) with {"ok":true,"fd":N}; Rust writes the tags through that descriptor.
 * No broad "all files" permission is involved.
 */
class StorageBridge(private val activity: Activity, private val webView: () -> WebView?) {
    private data class Pending(val id: String, val uri: Uri)
    private var pending: Pending? = null
    private var pendingPick: String? = null

    init { instance = this }

    @JavascriptInterface
    fun openForWrite(id: String, path: String) {
        Thread {
            try {
                val uri = findAudioUri(path) ?: return@Thread reply(id, fail("Android hasn't indexed this file yet, so it can't be edited. Open it in the Files app or rescan, then try again."))
                val fd = tryOpen(uri)
                if (fd != null) return@Thread reply(id, ok(fd))
                if (Build.VERSION.SDK_INT < 30) return@Thread reply(id, fail("This Android version needs the song to be in BlackMusic's own folder to edit it."))
                pending = Pending(id, uri)
                val sender = MediaStore.createWriteRequest(activity.contentResolver, listOf(uri)).intentSender
                activity.runOnUiThread { activity.startIntentSenderForResult(sender, REQUEST_CODE, null, 0, 0, 0) }
            } catch (t: Throwable) {
                reply(id, fail(t.message ?: t.javaClass.simpleName))
            }
        }.start()
    }

    /**
     * Android's folder picker (tauri-plugin-dialog's `directory: true` throws "Folder picker is not implemented on mobile").
     * Opens the system "choose a folder" screen and answers {"ok":true,"uri":"content://…/tree/…"} (uri is null if cancelled).
     * The JS side turns that tree URI into /storage/<volume>/<folder> with folderPathFromPicker().
     */
    @JavascriptInterface
    fun pickFolder(id: String) {
        activity.runOnUiThread {
            try {
                pendingPick = id
                activity.startActivityForResult(Intent(Intent.ACTION_OPEN_DOCUMENT_TREE), PICK_CODE)
            } catch (t: Throwable) {
                pendingPick = null
                reply(id, fail(t.message ?: "This device has no folder picker."))
            }
        }
    }

    /**
     * Every folder that contains music according to Android's own media index (MediaStore) — internal storage AND SD cards / USB.
     * This is how the built-in music player finds the SD card: it asks the index instead of crawling /storage.
     * Needs the same "Music and audio" permission the app already requests. Answers {"ok":true,"dirs":["/storage/ABCD-1234/Music", …]}.
     */
    @JavascriptInterface
    fun listAudioDirs(id: String) {
        Thread {
            try {
                val dirs = linkedSetOf<String>()
                val sel = MediaStore.Audio.Media.IS_NOTIFICATION + "=0 AND " + MediaStore.Audio.Media.IS_ALARM + "=0 AND " + MediaStore.Audio.Media.IS_RINGTONE + "=0"
                activity.contentResolver.query(MediaStore.Audio.Media.EXTERNAL_CONTENT_URI, arrayOf(MediaStore.Audio.Media.DATA), sel, null, null)?.use { c ->
                    while (c.moveToNext()) {
                        val f = java.io.File(c.getString(0) ?: continue)
                        val parent = f.parent ?: continue
                        if (parent.contains("/Android/")) continue
                        dirs.add(parent)
                    }
                }
                reply(id, JSONObject().put("ok", true).put("dirs", JSONArray(dirs.toList())).toString())
            } catch (t: Throwable) {
                reply(id, fail(t.message ?: t.javaClass.simpleName))
            }
        }.start()
    }

    private fun onPick(resultCode: Int, data: Intent?) {
        val id = pendingPick ?: return
        pendingPick = null
        val uri = if (resultCode == Activity.RESULT_OK) data?.data else null
        reply(id, JSONObject().put("ok", true).put("uri", uri?.toString() ?: JSONObject.NULL).toString())
    }

    private fun findAudioUri(path: String): Uri? {
        val base = MediaStore.Audio.Media.EXTERNAL_CONTENT_URI
        activity.contentResolver.query(base, arrayOf(MediaStore.Audio.Media._ID), MediaStore.Audio.Media.DATA + "=?", arrayOf(path), null)?.use { c ->
            if (c.moveToFirst()) return ContentUris.withAppendedId(base, c.getLong(0))
        }
        return null
    }

    /** Opens for read+write WITHOUT truncating. Null when Android says the app has no write access yet. */
    private fun tryOpen(uri: Uri): Int? = try {
        activity.contentResolver.openFileDescriptor(uri, "rw")?.detachFd()
    } catch (_: SecurityException) { null } catch (_: java.io.FileNotFoundException) { null }

    private fun onResult(resultCode: Int) {
        val p = pending ?: return
        pending = null
        if (resultCode != Activity.RESULT_OK) return reply(p.id, fail("Write access was not granted, so the file was not changed."))
        Thread {
            val fd = try { tryOpen(p.uri) } catch (_: Throwable) { null }
            reply(p.id, if (fd != null) ok(fd) else fail("Android still refused to open the file for writing."))
        }.start()
    }

    private fun ok(fd: Int) = JSONObject().put("ok", true).put("fd", fd).toString()
    private fun fail(msg: String) = JSONObject().put("ok", false).put("error", msg).toString()
    private fun reply(id: String, json: String) {
        val wv = webView() ?: return
        wv.post { wv.evaluateJavascript("window.__bmNativeResult&&window.__bmNativeResult(${JSONObject.quote(id)},${JSONObject.quote(json)})", null) }
    }

    companion object {
        const val REQUEST_CODE = 7301
        const val PICK_CODE = 7302
        private var instance: StorageBridge? = null
        /** Called from MainActivity.onActivityResult (patched in by scripts/android-post-init.mjs). */
        fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent? = null) {
            if (requestCode == REQUEST_CODE) instance?.onResult(resultCode)
            else if (requestCode == PICK_CODE) instance?.onPick(resultCode, data)
        }
    }
}
