// MapApp. Copyright 2026 Play, Inc.
// Free software under the GNU GPL v3 with additional terms: see LICENSE and NOTICE.

package io.github.bartbasi.mapapp.downloads;

import io.github.bartbasi.mapapp.archives.ArchiveIds;
import java.io.File;
import java.io.IOException;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Comparator;
import java.util.List;
import org.json.JSONException;
import org.json.JSONObject;

/**
 * What is on disk when the downloader starts (AreaLayout), and what to keep.
 *
 * - A delete cut short (.trash-*) and heads of a job never started (.staging)
 *   are deleted.
 * - An area whose job.json reads is kept, with its state.
 * - A complete area whose job.json cannot be read is kept: its archives do not
 *   need the job. It is listed as complete with an empty record (the screens
 *   show it as unreadable, with Delete) and the size of its archives.
 * - An incomplete area whose job.json cannot be read is deleted: it cannot be
 *   finished. It was never listed by the archive plugin, which lists only
 *   complete areas, so the archive list agrees.
 *
 * Plain Java and org.json, tested on the laptop.
 */
final class AreaScan {

    private AreaScan() {}

    /** An area found on disk. */
    static final class Found {
        final String id;
        final File dir;
        /** Null when job.json cannot be read (only ever for a complete area). */
        final AreaJob job;
        /** "active", "paused", "failed" or "complete". */
        final String intent;
        final String error;
        /** For an area without a readable job: the bytes of its archives. */
        final long archiveBytes;

        Found(String id, File dir, AreaJob job, String intent, String error, long archiveBytes) {
            this.id = id;
            this.dir = dir;
            this.job = job;
            this.intent = intent;
            this.error = error;
            this.archiveBytes = archiveBytes;
        }
    }

    static final class Result {
        /** In the order the areas were started; areas without a job first. */
        final List<Found> areas = new ArrayList<>();
        /** IDs of incomplete areas deleted because their job could not be read. */
        final List<String> deleted = new ArrayList<>();
    }

    static Result scan(File root) {
        Result r = new Result();
        File[] dirs = root.listFiles();
        if (dirs == null) return r;
        Arrays.sort(dirs);
        for (File d : dirs) {
            String name = d.getName();
            if (name.startsWith(AreaLayout.TRASH_PREFIX) || name.equals(AreaLayout.STAGING)) {
                Files.deleteTree(d);
                continue;
            }
            if (!d.isDirectory() || !ArchiveIds.isId(name)) continue;
            boolean complete = AreaLayout.isComplete(d);
            AreaJob job = readJob(d, name);
            if (job != null) {
                String[] intent = readIntent(d, complete);
                r.areas.add(new Found(name, d, job, intent[0], intent[1], 0));
            } else if (complete) {
                r.areas.add(new Found(name, d, null, "complete", null, archiveBytes(d)));
            } else {
                Files.deleteTree(d);
                r.deleted.add(name);
            }
        }
        r.areas.sort(Comparator.comparingLong(f -> f.job == null ? Long.MIN_VALUE : f.job.seq));
        return r;
    }

    /** The job, or null if job.json is missing, damaged or names another area. */
    static AreaJob readJob(File dir, String id) {
        try {
            AreaJob job = AreaJob.fromJson(new JSONObject(Files.readText(new File(dir, AreaLayout.JOB))), 0);
            return job.id.equals(id) ? job : null;
        } catch (IOException | JSONException | IllegalArgumentException e) {
            return null;
        }
    }

    /** { intent, error }: complete, or what state.json says (paused, failed), or active. */
    static String[] readIntent(File dir, boolean complete) {
        if (complete) return new String[] { "complete", null };
        File state = new File(dir, AreaLayout.STATE);
        if (!state.isFile()) return new String[] { "active", null };
        try {
            JSONObject o = new JSONObject(Files.readText(state));
            String s = o.optString("status", "active");
            if (s.equals("paused")) return new String[] { "paused", null };
            if (s.equals("failed")) return new String[] { "failed", o.optString("error", "other") };
        } catch (IOException | JSONException e) {
            // Unreadable state: the area goes on downloading.
        }
        return new String[] { "active", null };
    }

    /** Bytes of the archives in &lt;county&gt;/&lt;layer&gt;.pmtiles under an area folder. */
    static long archiveBytes(File areaDir) {
        long total = 0;
        File[] counties = areaDir.listFiles();
        if (counties == null) return 0;
        for (File c : counties) {
            if (!c.isDirectory() || !ArchiveIds.isId(c.getName())) continue;
            File[] files = c.listFiles();
            if (files == null) continue;
            for (File f : files) if (f.getName().endsWith(".pmtiles")) total += f.length();
        }
        return total;
    }
}
