// MapApp. Copyright 2026 Play, Inc.
// Free software under the GNU GPL v3 with additional terms: see LICENSE and NOTICE.

package io.github.bartbasi.mapapp.archives;

import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * The rules for archive names, the same as the web app's
 * src/platform/archive-meta.ts. County IDs and layer names are lower case
 * letters, digits and hyphens, so a path can never hold "..", a slash or
 * anything else that could reach outside the archive folders.
 */
final class ArchiveIds {

    private static final String ID = "[a-z0-9][a-z0-9-]{0,63}";
    private static final Pattern ID_PATTERN = Pattern.compile(ID);
    private static final Pattern PATH = Pattern.compile("^/_tiles/(" + ID + ")/(" + ID + ")\\.pmtiles$");

    private ArchiveIds() {}

    static boolean isId(String s) {
        return s != null && ID_PATTERN.matcher(s).matches();
    }

    static String key(String county, String layer) {
        return county + "/" + layer;
    }

    /** "county/layer" for a valid request path, or null. */
    static String keyFromPath(String path) {
        if (path == null) return null;
        Matcher m = PATH.matcher(path);
        return m.matches() ? key(m.group(1), m.group(2)) : null;
    }
}
