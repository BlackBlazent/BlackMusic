package __PKG__

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.graphics.Bitmap
import android.graphics.drawable.Icon
import android.media.MediaMetadata
import android.media.session.MediaSession
import android.media.session.PlaybackState
import android.os.Build
import android.webkit.WebView

/**
 * BlackMusic Media Controls (Android): one MediaSession + a MediaStyle notification (shade / lock screen / Android 13+ media
 * output switcher / Bluetooth + headset buttons). The web app owns playback; this object only mirrors its state and forwards
 * button presses back to it via window.__bmMedia(action). Installed by scripts/android-post-init.mjs.
 */
object MediaHub {
    const val CHANNEL_ID = "blackmusic_playback"
    const val NOTIFICATION_ID = 4202
    const val ACTION = "__PKG__.MEDIA_ACTION"

    @Volatile var webView: WebView? = null
    private var session: MediaSession? = null
    @Volatile var title = ""
    @Volatile var artist = ""
    @Volatile var album = ""
    @Volatile var art: Bitmap? = null
    @Volatile var playing = false
    @Volatile var positionMs = 0L
    @Volatile var durationMs = 0L
    @Volatile var active = false

    fun dispatch(action: String, seekSeconds: Double? = null) {
        val wv = webView ?: return
        val js = if (seekSeconds != null) "window.__bmMedia&&window.__bmMedia('seekto',$seekSeconds)"
                 else "window.__bmMedia&&window.__bmMedia('$action')"
        wv.post { wv.evaluateJavascript(js, null) }
    }

    @Synchronized
    private fun ensureSession(ctx: Context): MediaSession {
        session?.let { return it }
        val s = MediaSession(ctx.applicationContext, "BlackMusic")
        s.setCallback(object : MediaSession.Callback() {
            override fun onPlay() = dispatch("play")
            override fun onPause() = dispatch("pause")
            override fun onStop() = dispatch("stop")
            override fun onSkipToNext() = dispatch("next")
            override fun onSkipToPrevious() = dispatch("previous")
            override fun onSeekTo(pos: Long) = dispatch("seekto", pos / 1000.0)
        })
        s.isActive = true
        session = s
        return s
    }

    private fun ensureChannel(ctx: Context) {
        if (Build.VERSION.SDK_INT < 26) return
        val nm = ctx.getSystemService(NotificationManager::class.java)
        if (nm.getNotificationChannel(CHANNEL_ID) == null) {
            val ch = NotificationChannel(CHANNEL_ID, "Playback", NotificationManager.IMPORTANCE_LOW)
            ch.setShowBadge(false)
            ch.lockscreenVisibility = Notification.VISIBILITY_PUBLIC
            nm.createNotificationChannel(ch)
        }
    }

    private fun pending(ctx: Context, action: String, code: Int): PendingIntent {
        val i = Intent(ctx, MediaActionReceiver::class.java).setAction(ACTION).putExtra("a", action)
        return PendingIntent.getBroadcast(ctx, code, i, PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT)
    }

    /** Pushes the latest state to the MediaSession and returns the notification that shows it. */
    @Synchronized
    fun publish(ctx: Context): Notification {
        val app = ctx.applicationContext
        val s = ensureSession(app)
        s.setMetadata(
            MediaMetadata.Builder()
                .putString(MediaMetadata.METADATA_KEY_TITLE, title)
                .putString(MediaMetadata.METADATA_KEY_ARTIST, artist)
                .putString(MediaMetadata.METADATA_KEY_ALBUM, album)
                .putLong(MediaMetadata.METADATA_KEY_DURATION, durationMs)
                .apply { art?.let { putBitmap(MediaMetadata.METADATA_KEY_ALBUM_ART, it) } }
                .build()
        )
        s.setPlaybackState(
            PlaybackState.Builder()
                .setActions(
                    PlaybackState.ACTION_PLAY or PlaybackState.ACTION_PAUSE or PlaybackState.ACTION_PLAY_PAUSE or
                        PlaybackState.ACTION_SKIP_TO_NEXT or PlaybackState.ACTION_SKIP_TO_PREVIOUS or
                        PlaybackState.ACTION_SEEK_TO or PlaybackState.ACTION_STOP
                )
                .setState(if (playing) PlaybackState.STATE_PLAYING else PlaybackState.STATE_PAUSED, positionMs, if (playing) 1f else 0f)
                .build()
        )
        ensureChannel(app)
        val open = app.packageManager.getLaunchIntentForPackage(app.packageName)
            ?.let { PendingIntent.getActivity(app, 0, it, PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT) }
        fun action(icon: Int, label: String, a: String, code: Int) =
            Notification.Action.Builder(Icon.createWithResource(app, icon), label, pending(app, a, code)).build()
        val builder = if (Build.VERSION.SDK_INT >= 26) Notification.Builder(app, CHANNEL_ID) else @Suppress("DEPRECATION") Notification.Builder(app)
        builder
            .setSmallIcon(app.applicationInfo.icon)
            .setContentTitle(title)
            .setContentText(artist)
            .setSubText(album.ifEmpty { null })
            .setLargeIcon(art)
            .setContentIntent(open)
            .setVisibility(Notification.VISIBILITY_PUBLIC)
            .setOnlyAlertOnce(true)
            .setShowWhen(false)
            .setOngoing(playing)
            .addAction(action(android.R.drawable.ic_media_previous, "Previous", "previous", 1))
            .addAction(
                if (playing) action(android.R.drawable.ic_media_pause, "Pause", "pause", 2)
                else action(android.R.drawable.ic_media_play, "Play", "play", 3)
            )
            .addAction(action(android.R.drawable.ic_media_next, "Next", "next", 4))
            .setStyle(Notification.MediaStyle().setMediaSession(s.sessionToken).setShowActionsInCompactView(0, 1, 2))
        return builder.build()
    }

    @Synchronized
    fun release(ctx: Context) {
        active = false
        session?.release()
        session = null
        art = null
        ctx.getSystemService(NotificationManager::class.java).cancel(NOTIFICATION_ID)
    }
}
