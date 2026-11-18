// MapApp. Copyright 2026 Play, Inc.
// Free software under the GNU GPL v3 with additional terms: see LICENSE and NOTICE.

package io.github.bartbasi.mapapp.downloads;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * The true network state for the web app (D12): online (validated internet)
 * and metered. Its counterpart is the Network part of src/platform/android.ts.
 * Event "change" with { online, metered } whenever either changes.
 */
@CapacitorPlugin(name = "NetworkState")
public class NetworkStatePlugin extends Plugin {

    private NetworkWatch watch;
    private final NetworkWatch.Listener listener = state -> notifyListeners("change", toJs(state));

    @Override
    public void load() {
        watch = NetworkWatch.get(getContext());
        watch.addListener(listener);
    }

    @Override
    protected void handleOnDestroy() {
        if (watch != null) watch.removeListener(listener);
    }

    @PluginMethod
    public void get(PluginCall call) {
        call.resolve(toJs(watch.state()));
    }

    private static JSObject toJs(NetworkWatch.State s) {
        JSObject o = new JSObject();
        o.put("online", s.online);
        o.put("metered", s.metered);
        return o;
    }
}
