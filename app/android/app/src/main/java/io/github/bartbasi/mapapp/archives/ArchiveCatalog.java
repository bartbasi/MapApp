// MapApp. Copyright 2026 Play, Inc.
// Free software under the GNU GPL v3 with additional terms: see LICENSE and NOTICE.

package io.github.bartbasi.mapapp.archives;

import android.content.Context;
import android.util.Log;
import io.github.bartbasi.mapapp.downloads.AreaLayout;
import java.io.IOException;
import java.util.ArrayList;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Every installed archive and open readers for them: one per county and layer
 * among those that came with the app, and one per area, county and layer among
 * downloaded areas (see {@link ArchiveIds} for the keys). If two locations had
 * the same key, the first would win.
 *
 * Only archives in this catalog can be read: a request for anything else is
 * refused by {@link ArchiveRequestHandler}.
 */
public final class ArchiveCatalog {

    private static final String TAG = "MapAppArchives";
    private static ArchiveCatalog instance;

    private final List<ArchiveLocation> locations;
    private volatile Map<String, Entry> entries = Collections.emptyMap();
    private final Map<String, ArchiveReader> readers = new ConcurrentHashMap<>();

    /** An installed archive and the location it comes from. */
    public static final class Entry {
        public final ArchiveLocation location;
        public final ArchiveLocation.Archive archive;

        Entry(ArchiveLocation location, ArchiveLocation.Archive archive) {
            this.location = location;
            this.archive = archive;
        }
    }

    ArchiveCatalog(List<ArchiveLocation> locations) {
        this.locations = locations;
    }

    /** The app-wide catalog. */
    public static synchronized ArchiveCatalog get(Context context) {
        if (instance == null) {
            List<ArchiveLocation> locations = new ArrayList<>();
            locations.add(new AreaArchives(AreaLayout.root(context)));
            locations.add(new BundledArchives(context.getApplicationContext().getAssets()));
            instance = new ArchiveCatalog(locations);
            instance.refresh();
        }
        return instance;
    }

    /** Lists the locations again. Readers of archives that are gone are closed. */
    public synchronized void refresh() {
        Map<String, Entry> next = new LinkedHashMap<>();
        for (ArchiveLocation location : locations) {
            try {
                for (ArchiveLocation.Archive a : location.list()) {
                    String key = ArchiveIds.key(a.area(), a.county(), a.layer());
                    if (!next.containsKey(key)) next.put(key, new Entry(location, a));
                }
            } catch (IOException e) {
                Log.w(TAG, "could not list archives in " + location.name(), e);
            }
        }
        for (String key : new ArrayList<>(readers.keySet())) {
            Entry old = entries.get(key);
            Entry now = next.get(key);
            if (now == null || old == null || now.location != old.location) closeReader(key);
        }
        entries = Collections.unmodifiableMap(next);
        Log.i(TAG, "installed archives: " + next.keySet());
    }

    public List<Entry> list() {
        return new ArrayList<>(entries.values());
    }

    /** An open reader for an installed archive, or null if there is no such archive. */
    public ArchiveReader reader(String key) throws IOException {
        ArchiveReader r = readers.get(key);
        if (r != null) return r;
        Entry e = entries.get(key);
        if (e == null) return null;
        synchronized (this) {
            r = readers.get(key);
            if (r == null) {
                r = e.archive.open();
                readers.put(key, r);
            }
            return r;
        }
    }

    private void closeReader(String key) {
        ArchiveReader r = readers.remove(key);
        if (r == null) return;
        try {
            r.close();
        } catch (IOException e) {
            Log.w(TAG, "could not close " + key, e);
        }
    }
}
