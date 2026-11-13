// MapApp. Copyright 2026 Play, Inc.
// Free software under the GNU GPL v3 with additional terms: see LICENSE and NOTICE.

package io.github.bartbasi.mapapp.archives;

import java.io.IOException;
import java.util.List;

/**
 * One place where archives are kept. Step 1 has one: archives bundled inside
 * the APK ({@link BundledArchives}). Step 2 adds a second, archives downloaded
 * into app storage, which {@link ArchiveCatalog} checks first, so a downloaded
 * archive takes precedence over a bundled one of the same county and layer.
 */
public interface ArchiveLocation {

    /** A short name shown to the web app, such as "bundled" or "downloaded". */
    String name();

    /** Every complete archive here: a pmtiles file with its meta.json beside it. */
    List<Archive> list() throws IOException;

    /** One archive in a location. */
    interface Archive {
        String county();

        String layer();

        /** The text of the archive's meta.json file. */
        String readMeta() throws IOException;

        /** Opens the archive for byte-range reads. */
        ArchiveReader open() throws IOException;
    }
}
