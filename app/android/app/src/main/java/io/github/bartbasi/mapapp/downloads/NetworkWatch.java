// MapApp. Copyright 2026 Play, Inc.
// Free software under the GNU GPL v3 with additional terms: see LICENSE and NOTICE.

package io.github.bartbasi.mapapp.downloads;

import android.content.Context;
import android.net.ConnectivityManager;
import android.net.Network;
import android.net.NetworkCapabilities;
import android.os.Build;
import android.util.Log;
import java.util.concurrent.CopyOnWriteArrayList;

/**
 * The true network state, from Android and not from the WebView (D12).
 *
 * Online means the default network has internet and Android has checked that
 * it reaches the internet (validated), not just that something is connected.
 * Metered means the network is charged by use: mobile data, or any network
 * the phone marks so.
 *
 * {@link #usable()} is looser: any default network that claims internet. The
 * downloader tries on such a network even before it is validated, so a slow
 * check does not hold it up; failures then send it to "waiting".
 */
public final class NetworkWatch {

    private static final String TAG = "MapAppNetwork";
    private static NetworkWatch instance;

    /** A state as the web app sees it. */
    public static final class State {
        public final boolean online;
        public final boolean metered;
        /** A default network that claims internet, validated or not. */
        final boolean usable;

        State(boolean online, boolean metered, boolean usable) {
            this.online = online;
            this.metered = metered;
            this.usable = usable;
        }

        boolean same(State o) {
            return o != null && o.online == online && o.metered == metered && o.usable == usable;
        }
    }

    public interface Listener {
        void changed(State state);
    }

    private final ConnectivityManager cm;
    private final CopyOnWriteArrayList<Listener> listeners = new CopyOnWriteArrayList<>();
    private volatile State state;

    private NetworkWatch(Context context) {
        cm = (ConnectivityManager) context.getSystemService(Context.CONNECTIVITY_SERVICE);
        state = read(cm.getNetworkCapabilities(cm.getActiveNetwork()));
        cm.registerDefaultNetworkCallback(new ConnectivityManager.NetworkCallback() {
            @Override
            public void onCapabilitiesChanged(Network network, NetworkCapabilities caps) {
                update(read(caps));
            }

            @Override
            public void onLost(Network network) {
                // The default network is gone. Asking for the active network here
                // can still return the one being torn down (seen in airplane mode),
                // so the state is offline until Android names a new default,
                // which it does with onCapabilitiesChanged.
                update(read(null));
            }

            @Override
            public void onUnavailable() {
                update(read(null));
            }
        });
    }

    public static synchronized NetworkWatch get(Context context) {
        if (instance == null) instance = new NetworkWatch(context.getApplicationContext());
        return instance;
    }

    public State state() {
        return state;
    }

    public void addListener(Listener l) {
        listeners.add(l);
    }

    public void removeListener(Listener l) {
        listeners.remove(l);
    }

    private void update(State next) {
        State prev = state;
        state = next;
        if (next.same(prev)) return;
        Log.i(TAG, "network: online=" + next.online + " metered=" + next.metered + " usable=" + next.usable);
        for (Listener l : listeners) l.changed(next);
    }

    static State read(NetworkCapabilities caps) {
        if (caps == null) return new State(false, false, false);
        boolean internet = caps.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET);
        boolean validated = caps.hasCapability(NetworkCapabilities.NET_CAPABILITY_VALIDATED);
        boolean unmetered = caps.hasCapability(NetworkCapabilities.NET_CAPABILITY_NOT_METERED);
        if (Build.VERSION.SDK_INT >= 30 && caps.hasCapability(NetworkCapabilities.NET_CAPABILITY_TEMPORARILY_NOT_METERED)) unmetered = true;
        return new State(internet && validated, internet && !unmetered, internet);
    }
}
