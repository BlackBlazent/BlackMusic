package __PKG__

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.graphics.Bitmap
import android.graphics.drawable.Icon
import android.media.AudioAttributes
import android.media.AudioFocusRequest
import android.media.AudioManager
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

    // Fix 05: Disable native focus to prevent audio interruptions
    private const val USE_NATIVE_FOCUS = false
    @Volatile private var appCtx: Context? = null

    fun dispatch(action: String, seekSeconds: Double? = null) {
        // FIX-04: reflect play/pause in the notification IMMEDIATELY, without waiting for the web view round-trip.
        // (A backgrounded WebView may have its JS timers paused, which used to leave the card stale until the app was reopened.)
        if (action == "play" || action == "pause") {
            playing = action == "play"
            appCtx?.let { c ->
                try { c.getSystemService(NotificationManager::class.java).notify(NOTIFICATION_ID, publish(c)) } catch (_: Exception) {}
            }
        }
        val wv = webView ?: return
        val js = if (seekSeconds != null) "window.__bmMedia&&window.__bmMedia('seekto',$seekSeconds)"
                 else "window.__bmMedia&&window.__bmMedia('$action')"
        wv.post {
            wv.resumeTimers() // make sure the page can actually run the command while the app is in the background
            wv.evaluateJavascript(js, null)
        }
    }

    // ---- FIX-02: audio focus (another app starts playing -> pause; it stops -> resume) -----------------------------
    private var focusRequest: AudioFocusRequest? = null
    @Volatile private var hasFocus = false
    @Volatile private var resumeOnGain = false

    private val focusListener = AudioManager.OnAudioFocusChangeListener { change ->
        when (change) {
            // Temporary loss (a call, a navigation prompt, another player): pause, and remember to come back.
            AudioManager.AUDIOFOCUS_LOSS_TRANSIENT, AudioManager.AUDIOFOCUS_LOSS_TRANSIENT_CAN_DUCK -> {
                if (playing) { resumeOnGain = true; dispatch("pause") }
            }
            AudioManager.AUDIOFOCUS_GAIN -> {
                if (resumeOnGain) { resumeOnGain = false; dispatch("play") }
            }
            // Permanent loss (another music app took over): stay paused, do not resume.
            AudioManager.AUDIOFOCUS_LOSS -> {
                resumeOnGain = false
                if (playing) dispatch("pause")
                abandonFocus()
            }
        }
    }

    @Synchronized
    private fun requestFocus(ctx: Context) {
        if (hasFocus) return
        val am = ctx.applicationContext.getSystemService(Context.AUDIO_SERVICE) as AudioManager
        val granted = if (Build.VERSION.SDK_INT >= 26) {
            val req = AudioFocusRequest.Builder(AudioManager.AUDIOFOCUS_GAIN)
                .setAudioAttributes(AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_MEDIA).setContentType(AudioAttributes.CONTENT_TYPE_MUSIC).build())
                .setOnAudioFocusChangeListener(focusListener)
                .build()
            focusRequest = req
            am.requestAudioFocus(req)
        } else {
            @Suppress("DEPRECATION")
            am.requestAudioFocus(focusListener, AudioManager.STREAM_MUSIC, AudioManager.AUDIOFOCUS_GAIN)
        }
        hasFocus = granted == AudioManager.AUDIOFOCUS_REQUEST_GRANTED
    }

    @Synchronized
    fun abandonFocus() {
        val ctx = appCtx ?: return
        val am = ctx.getSystemService(Context.AUDIO_SERVICE) as AudioManager
        if (Build.VERSION.SDK_INT >= 26) focusRequest?.let { am.abandonAudioFocusRequest(it) }
        else @Suppress("DEPRECATION") am.abandonAudioFocus(focusListener)
        focusRequest = null
        hasFocus = false
    }

    /** Called with every state push from the web app: hold focus while playing; give it up when the user pauses. */
    fun syncFocus(ctx: Context) {
        appCtx = ctx.applicationContext
        if (!USE_NATIVE_FOCUS) return   // the WebView already handles audio focus; a second request pauses playback
        if (playing) { resumeOnGain = false; requestFocus(ctx) }
        else if (!resumeOnGain) abandonFocus() // a focus-caused pause keeps the request so GAIN can resume us
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
        appCtx = app
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
            // Status-bar icons must be a white silhouette (Google Play / Android rule) — the coloured launcher icon is not one.
            .setSmallIcon(app.resources.getIdentifier("ic_stat_music", "drawable", app.packageName).takeIf { it != 0 } ?: app.applicationInfo.icon)
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
        BlackMusicWidget.refresh(app)
        return builder.build()
    }

    @Synchronized
    fun release(ctx: Context) {
        resumeOnGain = false
        abandonFocus()
        active = false
        session?.release()
        session = null
        art = null
        ctx.getSystemService(NotificationManager::class.java).cancel(NOTIFICATION_ID)
    }
}
