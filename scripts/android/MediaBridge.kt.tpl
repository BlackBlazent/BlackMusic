package __PKG__

import android.app.NotificationManager
import android.content.Context
import android.content.Intent
import android.graphics.BitmapFactory
import android.util.Base64
import android.webkit.JavascriptInterface

/** Exposed to the web app as `window.BlackMusicMedia` (see src/lib/mediaSession.ts). */
class MediaBridge(private val context: Context) {
    private var lastArtwork = ""

    @JavascriptInterface
    fun update(title: String, artist: String, album: String, artwork: String, playing: Boolean, positionMs: Long, durationMs: Long) {
        MediaHub.title = title
        MediaHub.artist = artist
        MediaHub.album = album
        MediaHub.playing = playing
        MediaHub.positionMs = positionMs
        MediaHub.durationMs = durationMs
        if (artwork != lastArtwork) {
            lastArtwork = artwork
            // Library thumbnails arrive as data: URLs; remote http(s) artwork is skipped (no network work on the bridge thread).
            MediaHub.art = try {
                if (artwork.startsWith("data:image")) {
                    val bytes = Base64.decode(artwork.substringAfter(","), Base64.DEFAULT)
                    BitmapFactory.decodeByteArray(bytes, 0, bytes.size)
                } else null
            } catch (e: Exception) { null }
        }
        if (!MediaHub.active) {
            MediaHub.active = true
            val intent = Intent(context, MediaPlaybackService::class.java)
            try {
                if (android.os.Build.VERSION.SDK_INT >= 26) context.startForegroundService(intent) else context.startService(intent)
            } catch (e: Exception) {
                // Foreground-service start refused (app not allowed right now): still show the notification + session.
                context.getSystemService(NotificationManager::class.java).notify(MediaHub.NOTIFICATION_ID, MediaHub.publish(context))
            }
        } else {
            context.getSystemService(NotificationManager::class.java).notify(MediaHub.NOTIFICATION_ID, MediaHub.publish(context))
        }
    }

    @JavascriptInterface
    fun clear() {
        context.stopService(Intent(context, MediaPlaybackService::class.java))
        MediaHub.release(context)
    }
}
