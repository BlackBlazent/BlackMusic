package __PKG__

import android.app.Service
import android.content.Intent
import android.content.pm.ServiceInfo
import android.os.IBinder

/** Keeps the process (and therefore playback) alive while the app is in the background, and owns the media notification. */
class MediaPlaybackService : Service() {
    override fun onBind(intent: Intent?): IBinder? = null

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        val notification = MediaHub.publish(this)
        if (android.os.Build.VERSION.SDK_INT >= 29) {
            startForeground(MediaHub.NOTIFICATION_ID, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PLAYBACK)
        } else {
            startForeground(MediaHub.NOTIFICATION_ID, notification)
        }
        return START_NOT_STICKY
    }

    override fun onTaskRemoved(rootIntent: Intent?) {
        // The user swiped the app away: stop cleanly instead of leaving an orphan notification.
        MediaHub.release(this)
        stopSelf()
        super.onTaskRemoved(rootIntent)
    }

    override fun onDestroy() {
        MediaHub.active = false
        super.onDestroy()
    }
}
