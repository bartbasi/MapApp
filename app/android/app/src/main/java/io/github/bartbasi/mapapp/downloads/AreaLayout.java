// MapApp. Copyright 2026 Play, Inc.
// Free software under the GNU GPL v3 with additional terms: see LICENSE and NOTICE.

package io.github.bartbasi.mapapp.downloads;

import android.content.Context;
import java.io.File;

/**
 * Where downloaded areas live, in app-private storage that is never backed up:
 *
 * <pre>
 * areas/
 *   .staging/&lt;id&gt;/&lt;n&gt;.head    heads sent by the web app before the job starts
 *   .trash-&lt;id&gt;-&lt;n&gt;/           an area being deleted
 *   &lt;id&gt;/
 *     job.json                  the job, written before the area folder appears
 *     state.json                absent while the area should download; else paused or failed
 *     &lt;n&gt;.head &lt;n&gt;.part &lt;n&gt;.ckpt   file n while it is written (head, bytes so far, checkpoint)
 *     &lt;county&gt;/&lt;layer&gt;.pmtiles    a finished file, renamed into place,
 *     &lt;county&gt;/&lt;layer&gt;.meta.json  with its metadata beside it
 *     complete                  written last: only now does the map see the area
 * </pre>
 *
 * Area IDs are lower case letters, digits and hyphens, so they never start with
 * a dot and never collide with the staging and trash folders.
 */
public final class AreaLayout {

    static final String JOB = "job.json";
    static final String STATE = "state.json";
    public static final String COMPLETE = "complete";
    static final String STAGING = ".staging";
    static final String TRASH_PREFIX = ".trash-";

    private AreaLayout() {}

    /** The folder all areas live in. */
    public static File root(Context context) {
        return new File(context.getApplicationContext().getNoBackupFilesDir(), "areas");
    }

    static File staging(File root, String id) {
        return new File(new File(root, STAGING), id);
    }

    static File head(File areaDir, int index) {
        return new File(areaDir, index + ".head");
    }

    static File part(File areaDir, int index) {
        return new File(areaDir, index + ".part");
    }

    static File checkpoint(File areaDir, int index) {
        return new File(areaDir, index + ".ckpt");
    }

    public static File archive(File areaDir, String county, String layer) {
        return new File(new File(areaDir, county), layer + ".pmtiles");
    }

    public static File meta(File areaDir, String county, String layer) {
        return new File(new File(areaDir, county), layer + ".meta.json");
    }

    /** True once every file of the area is in place. */
    public static boolean isComplete(File areaDir) {
        return new File(areaDir, COMPLETE).isFile();
    }
}
