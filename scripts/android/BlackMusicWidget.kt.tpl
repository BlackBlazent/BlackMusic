package __PKG__

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.widget.RemoteViews

/**
 * FEAT-10 (3.0.0) — Android home-screen widget: now-playing title / artist and previous / play-pause / next.
 * It only mirrors MediaHub (which mirrors the web app) and sends the same actions the notification uses, so there is one
 * source of truth. Tapping the text opens the app. Installed by scripts/android-post-init.mjs.
 */
class BlackMusicWidget : AppWidgetProvider() {
    override fun onUpdate(context: Context, manager: AppWidgetManager, ids: IntArray) {
        ids.forEach { manager.updateAppWidget(it, views(context)) }
    }

    companion object {
        private fun action(ctx: Context, a: String, code: Int): PendingIntent {
            val i = Intent(ctx, MediaActionReceiver::class.java).putExtra("a", a)
            return PendingIntent.getBroadcast(ctx, 100 + code, i, PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT)
        }

        fun views(ctx: Context): RemoteViews {
            val v = RemoteViews(ctx.packageName, R.layout.bm_widget)
            val hasTrack = MediaHub.title.isNotEmpty()
            v.setTextViewText(R.id.bm_widget_title, if (hasTrack) MediaHub.title else ctx.getString(R.string.bm_widget_idle))
            v.setTextViewText(R.id.bm_widget_artist, if (hasTrack) MediaHub.artist else "")
            v.setImageViewResource(R.id.bm_widget_play, if (MediaHub.playing) android.R.drawable.ic_media_pause else android.R.drawable.ic_media_play)
            v.setContentDescription(R.id.bm_widget_play, if (MediaHub.playing) "Pause" else "Play")
            v.setOnClickPendingIntent(R.id.bm_widget_prev, action(ctx, "previous", 1))
            v.setOnClickPendingIntent(R.id.bm_widget_play, action(ctx, if (MediaHub.playing) "pause" else "play", 2))
            v.setOnClickPendingIntent(R.id.bm_widget_next, action(ctx, "next", 3))
            ctx.packageManager.getLaunchIntentForPackage(ctx.packageName)?.let {
                v.setOnClickPendingIntent(R.id.bm_widget_text, PendingIntent.getActivity(ctx, 99, it, PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT))
            }
            return v
        }

        /** Called by MediaHub whenever the track or play state changes. Never throws into playback. */
        fun refresh(ctx: Context) {
            try {
                val m = AppWidgetManager.getInstance(ctx)
                val ids = m.getAppWidgetIds(ComponentName(ctx, BlackMusicWidget::class.java))
                if (ids.isNotEmpty()) ids.forEach { m.updateAppWidget(it, views(ctx)) }
            } catch (_: Exception) {
            }
        }
    }
}
