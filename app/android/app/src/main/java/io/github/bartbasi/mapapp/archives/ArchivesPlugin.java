// MapApp. Copyright 2026 Play, Inc.
// Free software under the GNU GPL v3 with additional terms: see LICENSE and NOTICE.

package io.github.bartbasi.mapapp.archives;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * Tells the web app which archives are installed. Its counterpart is
 * src/platform/android.ts. Reads do not go through here: they go through
 * {@link ArchiveRequestHandler}.
 */
@CapacitorPlugin(name = "Archives")
public class ArchivesPlugin extends Plugin {

    // Capacitor runs plugin methods off the main thread, so reading the small
    // metadata files here does not block the screen.
    @PluginMethod
    public void list(PluginCall call) {
        ArchiveCatalog catalog = ArchiveCatalog.get(getContext());
        JSArray rows = new JSArray();
        for (ArchiveCatalog.Entry e : catalog.list()) {
            try {
                JSObject row = new JSObject();
                row.put("county", e.archive.county());
                row.put("layer", e.archive.layer());
                row.put("location", e.location.name());
                if (e.archive.area() != null) row.put("area", e.archive.area());
                row.put("meta", e.archive.readMeta());
                rows.put(row);
            } catch (Exception ex) {
                // An archive whose metadata cannot be read is left out, not fatal.
            }
        }
        JSObject result = new JSObject();
        result.put("archives", rows);
        call.resolve(result);
    }
}
