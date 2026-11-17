// MapApp. Copyright 2026 Play, Inc.
// Free software under the GNU GPL v3 with additional terms: see LICENSE and NOTICE.

package io.github.bartbasi.mapapp.location;

import android.Manifest;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.content.pm.ApplicationInfo;
import android.location.Location;
import android.location.LocationListener;
import android.location.LocationManager;
import android.location.LocationRequest;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.os.SystemClock;
import android.util.Log;
import androidx.annotation.NonNull;
import androidx.annotation.RequiresApi;
import androidx.core.content.ContextCompat;
import androidx.core.location.LocationManagerCompat;
import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;

/**
 * The phone's position, read through Android's own location service only
 * (DECISIONS D31). It links no closed library: there is no Google Play
 * services code in it or under it.
 *
 * It listens to the GPS provider, a fix a second, and, where the phone has
 * the platform's fused provider (Android 12 and later), to that too.
 * {@link FixArbiter} decides which fixes reach the app: GPS always, the fused
 * provider only while the GPS has given nothing for 5 s.
 *
 * Permission works as Capacitor's usual permission calls: the alias
 * "location" is the precise permission (fine and coarse), "coarseLocation"
 * the approximate one. The app watches only with the precise one.
 *
 * Listening stops while the app is off screen and starts again when it
 * returns, so the GPS is never kept on for an app nobody is looking at.
 * Nothing here stores or sends a position (DECISIONS D21). In a debug build
 * each fix is noted in the log by provider and age, never by place.
 *
 * Its counterpart is src/position/native-source.ts. Every watch event is a
 * resolved callback with a "type": "fix", or "error" with a "code" of
 * "denied", "location-off" or "unavailable". An error ends the watch.
 */
@CapacitorPlugin(
    name = "DeviceLocation",
    permissions = {
        @Permission(
            strings = { Manifest.permission.ACCESS_COARSE_LOCATION, Manifest.permission.ACCESS_FINE_LOCATION },
            alias = DeviceLocationPlugin.PRECISE
        ),
        @Permission(strings = { Manifest.permission.ACCESS_COARSE_LOCATION }, alias = DeviceLocationPlugin.APPROXIMATE)
    }
)
public class DeviceLocationPlugin extends Plugin {

    static final String PRECISE = "location";
    static final String APPROXIMATE = "coarseLocation";

    private static final String TAG = "DeviceLocation";
    /** A fix a second from each provider, with no minimum distance. */
    static final long INTERVAL_MS = 1000L;

    private final Handler main = new Handler(Looper.getMainLooper());
    private final FixArbiter arbiter = new FixArbiter();
    private final LocationListener gpsListener = new ProviderListener(FixArbiter.Provider.GPS);
    private final LocationListener fusedListener = new ProviderListener(FixArbiter.Provider.FUSED);

    private LocationManager manager;
    /** The running watch, or null. Touched on the main thread only. */
    private PluginCall watch;
    private boolean listening;
    private boolean onScreen = true;
    private BroadcastReceiver switchReceiver;
    /** A debug build: each fix is noted in the log. */
    private boolean debuggable;

    @Override
    public void load() {
        manager = (LocationManager) getContext().getSystemService(Context.LOCATION_SERVICE);
        debuggable = (getContext().getApplicationInfo().flags & ApplicationInfo.FLAG_DEBUGGABLE) != 0;
    }

    /** Whether Location is on, and which providers this phone has. */
    @PluginMethod
    public void status(PluginCall call) {
        JSObject ret = new JSObject();
        ret.put("locationEnabled", locationEnabled());
        ret.put("gps", hasGps());
        ret.put("fused", hasFused());
        call.resolve(ret);
    }

    /** Starts the one watch. A second watch replaces the first. */
    @PluginMethod(returnType = PluginMethod.RETURN_CALLBACK)
    public void watch(PluginCall call) {
        // Kept alive at once, before the bridge decides whether to keep the
        // call; finish() lets it go if the watch cannot start.
        call.setKeepAlive(true);
        main.post(() -> startWatch(call));
    }

    /** Ends the watch with this id. Ending one that has already ended is not an error. */
    @PluginMethod
    public void clearWatch(PluginCall call) {
        String id = call.getString("id");
        main.post(() -> {
            if (watch != null && watch.getCallbackId().equals(id)) endWatch();
            call.resolve();
        });
    }

    @Override
    protected void handleOnStart() {
        onScreen = true;
        if (watch == null) return;
        // Location may have been switched off while the app was away.
        if (!locationEnabled()) {
            fail("location-off");
            return;
        }
        startListening();
    }

    @Override
    protected void handleOnStop() {
        onScreen = false;
        stopListening();
    }

    @Override
    protected void handleOnDestroy() {
        endWatch();
    }

    private void startWatch(PluginCall call) {
        if (watch != null) endWatch();
        if (getPermissionState(PRECISE) != PermissionState.GRANTED) {
            finish(call, "denied");
            return;
        }
        if (!locationEnabled()) {
            finish(call, "location-off");
            return;
        }
        if (!hasGps() && !hasFused()) {
            finish(call, "unavailable");
            return;
        }
        watch = call;
        arbiter.reset();
        if (onScreen) startListening();
    }

    private void startListening() {
        if (listening || watch == null) return;
        try {
            if (hasGps()) {
                manager.requestLocationUpdates(LocationManager.GPS_PROVIDER, INTERVAL_MS, 0f, gpsListener, Looper.getMainLooper());
            }
            if (hasFused()) requestFused();
        } catch (SecurityException e) {
            // The precise permission was taken away while the watch ran.
            stopListening();
            fail("denied");
            return;
        }
        listening = true;
        watchSwitch();
    }

    @RequiresApi(Build.VERSION_CODES.S)
    private void requestFused() {
        LocationRequest request = new LocationRequest.Builder(INTERVAL_MS)
            .setQuality(LocationRequest.QUALITY_HIGH_ACCURACY)
            .setMinUpdateIntervalMillis(INTERVAL_MS)
            .setMinUpdateDistanceMeters(0f)
            .build();
        manager.requestLocationUpdates(LocationManager.FUSED_PROVIDER, request, ContextCompat.getMainExecutor(getContext()), fusedListener);
    }

    private void stopListening() {
        if (manager != null) {
            manager.removeUpdates(gpsListener);
            manager.removeUpdates(fusedListener);
        }
        unwatchSwitch();
        listening = false;
    }

    /** Stops listening and lets the watch go, saying nothing more to the app. */
    private void endWatch() {
        stopListening();
        if (watch != null) {
            watch.release(bridge);
            watch = null;
        }
    }

    /** Ends the running watch with an error the app will show. */
    private void fail(String code) {
        PluginCall call = watch;
        stopListening();
        watch = null;
        if (call != null) finish(call, code);
    }

    /** Sends the error as the call's last event and lets the call go. */
    private void finish(PluginCall call, String code) {
        JSObject ret = new JSObject();
        ret.put("type", "error");
        ret.put("code", code);
        call.setKeepAlive(false);
        call.resolve(ret);
        call.release(bridge);
    }

    private void onFix(FixArbiter.Provider provider, Location location) {
        if (watch == null) return;
        long now = SystemClock.elapsedRealtimeNanos();
        long taken = location.getElapsedRealtimeNanos();
        if (taken <= 0) taken = now;
        boolean passed = arbiter.accept(provider, taken, now);
        long ageMs = FixArbiter.ageMillis(taken, now);
        if (debuggable) Log.d(TAG, (passed ? "passed " : "dropped ") + name(provider) + " fix, age " + ageMs + " ms");
        if (!passed) return;
        JSObject fix = new JSObject();
        fix.put("type", "fix");
        fix.put("provider", name(provider));
        fix.put("lng", location.getLongitude());
        fix.put("lat", location.getLatitude());
        if (location.hasAccuracy()) fix.put("accuracyM", (double) location.getAccuracy());
        if (location.hasBearing()) fix.put("bearingDeg", (double) location.getBearing());
        if (location.hasSpeed()) fix.put("speedMps", (double) location.getSpeed());
        fix.put("timeMs", location.getTime());
        fix.put("ageMs", ageMs);
        watch.resolve(fix);
    }

    private void onSwitchMaybeChanged() {
        if (watch != null && !locationEnabled()) fail("location-off");
    }

    /** Hears the Location switch while listening. The providers' own callbacks hear it too; either is enough. */
    private void watchSwitch() {
        if (switchReceiver != null) return;
        switchReceiver = new BroadcastReceiver() {
            @Override
            public void onReceive(Context context, Intent intent) {
                onSwitchMaybeChanged();
            }
        };
        IntentFilter filter = new IntentFilter(LocationManager.MODE_CHANGED_ACTION);
        filter.addAction(LocationManager.PROVIDERS_CHANGED_ACTION);
        ContextCompat.registerReceiver(getContext(), switchReceiver, filter, ContextCompat.RECEIVER_NOT_EXPORTED);
    }

    private void unwatchSwitch() {
        if (switchReceiver == null) return;
        try {
            getContext().unregisterReceiver(switchReceiver);
        } catch (IllegalArgumentException ignored) {
            // Not registered: nothing to do.
        }
        switchReceiver = null;
    }

    private boolean locationEnabled() {
        return manager != null && LocationManagerCompat.isLocationEnabled(manager);
    }

    private boolean hasGps() {
        return manager != null && manager.getAllProviders().contains(LocationManager.GPS_PROVIDER);
    }

    private boolean hasFused() {
        return manager != null && Build.VERSION.SDK_INT >= Build.VERSION_CODES.S && manager.hasProvider(LocationManager.FUSED_PROVIDER);
    }

    private static String name(FixArbiter.Provider provider) {
        return provider == FixArbiter.Provider.GPS ? "gps" : "fused";
    }

    /** One provider's callbacks, all on the main thread. */
    private final class ProviderListener implements LocationListener {

        private final FixArbiter.Provider provider;

        ProviderListener(FixArbiter.Provider provider) {
            this.provider = provider;
        }

        @Override
        public void onLocationChanged(@NonNull Location location) {
            onFix(provider, location);
        }

        @Override
        public void onProviderDisabled(@NonNull String name) {
            onSwitchMaybeChanged();
        }

        @Override
        public void onProviderEnabled(@NonNull String name) {}

        /** Needed below Android 10, where it has no default. Never called from Android 10 on. */
        @Override
        @SuppressWarnings("deprecation")
        public void onStatusChanged(String name, int status, Bundle extras) {}
    }
}
