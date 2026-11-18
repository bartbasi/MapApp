// MapApp. Copyright 2026 Play, Inc.
// Free software under the GNU GPL v3 with additional terms: see LICENSE and NOTICE.

package io.github.bartbasi.mapapp.downloads;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.pm.ServiceInfo;
import android.os.Build;
import android.os.IBinder;
import android.os.SystemClock;
import android.util.Log;
import androidx.core.app.NotificationCompat;
import androidx.core.app.ServiceCompat;
import androidx.core.content.ContextCompat;
import java.util.Locale;

/**
 * Keeps downloads going with the screen off or the app in the background: a
 * foreground service of type dataSync with a notification that shows progress
 * (D33). It does no work itself; {@link DownloadEngine} does, and tells it when
 * there is work and when there is none.
 *
 * If the user refused notifications the service still runs; Android then only
 * hides the notification.
 */
public final class DownloadService extends Service implements DownloadEngine.ServiceHook {

    private static final String TAG = "MapAppDownloads";
    private static final String CHANNEL = "downloads";
    private static final int NOTIFICATION_ID = 3301;
    private static final long NOTIFY_INTERVAL_MS = 1000;

    private DownloadEngine engine;
    private NotificationManager notifications;
    private long lastNotify;
    private DownloadEngine.Snapshot last;

    /** Starts the service if it is not running. Safe to call often. */
    static void start(Context context) {
        try {
            ContextCompat.startForegroundService(context, new Intent(context, DownloadService.class));
        } catch (RuntimeException e) {
            // Android refuses a foreground service started from the background
            // (Android 12 and later). The download still runs while the process
            // lives, and goes on when the app is opened.
            Log.w(TAG, "could not start the download service", e);
        }
    }

    @Override
    public void onCreate() {
        super.onCreate();
        notifications = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
        makeChannel();
        engine = DownloadEngine.get(this);
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        try {
            ServiceCompat.startForeground(this, NOTIFICATION_ID, build(last), Build.VERSION.SDK_INT >= 29 ? ServiceInfo.FOREGROUND_SERVICE_TYPE_DATA_SYNC : 0);
        } catch (RuntimeException e) {
            Log.w(TAG, "could not run in the foreground", e);
            stopSelf();
            return START_NOT_STICKY;
        }
        engine.setService(this);
        // After Android restarted a killed process for this service, this is what starts the work again.
        engine.ensureRunning();
        if (!engine.hasWork()) idle();
        return START_STICKY;
    }

    /** Android 15 and later: the daily time limit for data sync services ran out. */
    @Override
    public void onTimeout(int startId, int fgsType) {
        Log.w(TAG, "Android's time limit for the download service ran out; stopping until the app is opened");
        engine.suspend();
        stopNow();
    }

    @Override
    public void onDestroy() {
        if (engine != null) engine.setService(null);
        super.onDestroy();
    }

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }

    // ------------------------------------------------------------ DownloadEngine.ServiceHook

    @Override
    public void busy() {
        // Starting is done through start(); nothing more here.
    }

    @Override
    public void idle() {
        if (engine.hasWork()) return;
        stopNow();
    }

    @Override
    public void progress(DownloadEngine.Snapshot area) {
        last = area;
        long now = SystemClock.elapsedRealtime();
        boolean progressOnly = "downloading".equals(area.status);
        if (progressOnly && now - lastNotify < NOTIFY_INTERVAL_MS) return;
        lastNotify = now;
        if (!"complete".equals(area.status)) notifications.notify(NOTIFICATION_ID, build(area));
    }

    private void stopNow() {
        ServiceCompat.stopForeground(this, ServiceCompat.STOP_FOREGROUND_REMOVE);
        stopSelf();
    }

    // ------------------------------------------------------------ the notification

    private void makeChannel() {
        if (Build.VERSION.SDK_INT < 26) return;
        NotificationChannel channel = new NotificationChannel(CHANNEL, "Map downloads", NotificationManager.IMPORTANCE_LOW);
        channel.setDescription("Progress of map areas being downloaded");
        channel.setShowBadge(false);
        notifications.createNotificationChannel(channel);
    }

    private Notification build(DownloadEngine.Snapshot area) {
        Intent open = getPackageManager().getLaunchIntentForPackage(getPackageName());
        PendingIntent tap = open == null ? null : PendingIntent.getActivity(this, 0, open, PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
        NotificationCompat.Builder b = new NotificationCompat.Builder(this, CHANNEL)
            .setSmallIcon(android.R.drawable.stat_sys_download)
            .setOngoing(true)
            .setOnlyAlertOnce(true)
            .setSilent(true)
            .setCategory(NotificationCompat.CATEGORY_PROGRESS)
            .setForegroundServiceBehavior(NotificationCompat.FOREGROUND_SERVICE_IMMEDIATE);
        if (tap != null) b.setContentIntent(tap);
        if (area == null) {
            b.setContentTitle("Downloading map data").setProgress(0, 0, true);
            return b.build();
        }
        String title = area.name.isEmpty() ? "Map area" : area.name;
        String sizes = mb(area.bytesDone) + " of " + mb(area.bytesTotal);
        switch (area.status) {
            case "waiting":
                b.setContentTitle(title).setContentText("Waiting for a connection. " + sizes).setProgress(0, 0, false);
                break;
            case "queued":
                b.setContentTitle(title).setContentText("Waiting to start").setProgress(0, 0, true);
                break;
            case "paused":
                b.setContentTitle(title).setContentText("Paused. " + sizes);
                break;
            case "failed":
                b.setContentTitle(title).setContentText("Download stopped. " + sizes);
                break;
            default:
                int percent = area.bytesTotal > 0 ? (int) (area.bytesDone * 100 / area.bytesTotal) : 0;
                b.setContentTitle("Downloading " + title).setContentText(sizes).setProgress(100, percent, false);
        }
        return b.build();
    }

    private static String mb(long bytes) {
        return String.format(Locale.US, "%.1f MB", bytes / 1_000_000.0);
    }
}
