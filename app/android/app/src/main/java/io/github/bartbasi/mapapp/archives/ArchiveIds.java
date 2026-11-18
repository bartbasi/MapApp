// MapApp. Copyright 2026 Play, Inc.
// Free software under the GNU GPL v3 with additional terms: see LICENSE and NOTICE.

package io.github.bartbasi.mapapp.archives;

import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * The rules for archive names, the same as the web app's
 * src/platform/archive-meta.ts. County IDs, layer names and area IDs are lower
 * case letters, digits and hyphens, so a path can never hold "..", a slash or
 * anything else that could reach outside the archive folders.
 *
 * Two request paths exist:
 * <pre>
 *   /_tiles/&lt;county&gt;/&lt;layer&gt;.pmtiles               an archive that came with the app
 *   /_tiles/_area/&lt;area&gt;/&lt;county&gt;/&lt;layer&gt;.pmtiles  an archive of a downloaded area
 * </pre>
 * "_area" starts with an underscore, which no county ID can, so the two never collide.
 */
public final class ArchiveIds {

    private static final String ID = "[a-z0-9][a-z0-9-]{0,63}";
    private static final Pattern ID_PATTERN = Pattern.compile(ID);
    private static final Pattern PATH = Pattern.compile("^/_tiles/(" + ID + ")/(" + ID + ")\\.pmtiles$");
    private static final Pattern AREA_PATH = Pattern.compile("^/_tiles/_area/(" + ID + ")/(" + ID + ")/(" + ID + ")\\.pmtiles$");

    private ArchiveIds() {}

    public static boolean isId(String s) {
        return s != null && ID_PATTERN.matcher(s).matches();
    }

    /** The catalog key of an archive; {@code area} is null for one that came with the app. */
    static String key(String area, String county, String layer) {
        return area == null ? county + "/" + layer : "_area/" + area + "/" + county + "/" + layer;
    }

    /** The catalog key for a valid request path, or null. */
    static String keyFromPath(String path) {
        if (path == null) return null;
        Matcher m = PATH.matcher(path);
        if (m.matches()) return key(null, m.group(1), m.group(2));
        m = AREA_PATH.matcher(path);
        return m.matches() ? key(m.group(1), m.group(2), m.group(3)) : null;
    }
}
