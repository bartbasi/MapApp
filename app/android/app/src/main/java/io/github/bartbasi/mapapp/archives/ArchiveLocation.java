// MapApp. Copyright 2026 Play, Inc.
// Free software under the GNU GPL v3 with additional terms: see LICENSE and NOTICE.

package io.github.bartbasi.mapapp.archives;

import java.io.IOException;
import java.util.List;

/**
 * One place where archives are kept: archives bundled inside the APK
 * ({@link BundledArchives}) and the archives of downloaded areas
 * ({@link AreaArchives}). An area's archives are told apart by the area's ID,
 * so several areas can each hold the same county and layer, beside a bundled one.
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

        /** The downloaded area the archive belongs to, or null for one that came with the app. */
        default String area() {
            return null;
        }

        /** The text of the archive's meta.json file. */
        String readMeta() throws IOException;

        /** Opens the archive for byte-range reads. */
        ArchiveReader open() throws IOException;
    }
}
