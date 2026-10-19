package __PKG__

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent

/** Notification buttons (previous / play / pause / next) land here and are forwarded to the web app. */
class MediaActionReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        MediaHub.dispatch(intent.getStringExtra("a") ?: return)
    }
}
