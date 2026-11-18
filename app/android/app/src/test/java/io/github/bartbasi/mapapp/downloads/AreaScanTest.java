// MapApp. Copyright 2026 Play, Inc.
// Free software under the GNU GPL v3 with additional terms: see LICENSE and NOTICE.

package io.github.bartbasi.mapapp.downloads;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertNotNull;
import static org.junit.Assert.assertNull;
import static org.junit.Assert.assertTrue;

import java.io.File;
import java.io.IOException;
import java.util.HashMap;
import java.util.Map;
import org.json.JSONArray;
import org.json.JSONObject;
import org.junit.Rule;
import org.junit.Test;
import org.junit.rules.TemporaryFolder;

/** What the downloader keeps at start: a complete area stays even if its job is damaged (review item 6). */
public class AreaScanTest {

    @Rule
    public TemporaryFolder tmp = new TemporaryFolder();

    private static String job(String id, long seq, Boolean allowMetered) throws Exception {
        JSONObject f = new JSONObject();
        f.put("county", "il-macon");
        f.put("layer", "basemap");
        f.put("url", "https://example.org/x.pmtiles");
        f.put("headBytes", 0);
        f.put("ranges", new JSONArray(new long[] { 0, 100 }));
        f.put("bytes", 100);
        f.put("meta", "{}");
        JSONObject o = new JSONObject();
        o.put("id", id);
        o.put("record", "{\"name\":\"" + id + "\"}");
        o.put("seq", seq);
        if (allowMetered != null) o.put("allowMetered", allowMetered);
        o.put("files", new JSONArray().put(f));
        return o.toString();
    }

    private File area(String id, String jobText, boolean complete, long archiveBytes) throws IOException {
        File dir = new File(tmp.getRoot(), id);
        Files.mkdirs(dir);
        if (jobText != null) Files.writeTextAtomically(new File(dir, AreaLayout.JOB), jobText);
        if (archiveBytes > 0) {
            File archive = AreaLayout.archive(dir, "il-macon", "basemap");
            Files.mkdirs(archive.getParentFile());
            Files.writeAtomically(archive, new byte[(int) archiveBytes]);
            Files.writeTextAtomically(AreaLayout.meta(dir, "il-macon", "basemap"), "{}");
        }
        if (complete) Files.writeAtomically(new File(dir, AreaLayout.COMPLETE), new byte[0]);
        return dir;
    }

    @Test
    public void keepsCompleteAreasDeletesOnlyIncompleteOnesWithoutAJob() throws Exception {
        area("good-done", job("good-done", 3, true), true, 100);
        File damagedDone = area("damaged-done", "{ this is not json", true, 4321);
        File missingDone = area("missing-done", null, true, 77);
        File damagedHalf = area("damaged-half", "{\"id\":", false, 0);
        File wrongId = area("wrong-id", job("someone-else", 5, false), false, 0);
        File paused = area("paused", job("paused", 2, false), false, 0);
        Files.writeTextAtomically(new File(paused, AreaLayout.STATE), "{\"status\":\"paused\"}");
        File failed = area("failed", job("failed", 4, null), false, 0);
        Files.writeTextAtomically(new File(failed, AreaLayout.STATE), "{\"status\":\"failed\",\"error\":\"changed\"}");
        area("active", job("active", 1, null), false, 0);
        File trash = new File(tmp.getRoot(), AreaLayout.TRASH_PREFIX + "x-1");
        Files.mkdirs(trash);
        File staging = new File(tmp.getRoot(), AreaLayout.STAGING + "/y");
        Files.mkdirs(staging);

        AreaScan.Result r = AreaScan.scan(tmp.getRoot());

        Map<String, AreaScan.Found> byId = new HashMap<>();
        for (AreaScan.Found f : r.areas) byId.put(f.id, f);
        assertEquals(byId.keySet().toString(), 6, r.areas.size());

        assertEquals("complete", byId.get("good-done").intent);
        assertNotNull(byId.get("good-done").job);

        // Complete with a damaged or missing job: kept, no job, the size of its archives.
        assertNull(byId.get("damaged-done").job);
        assertEquals("complete", byId.get("damaged-done").intent);
        assertEquals(4321, byId.get("damaged-done").archiveBytes);
        assertTrue(damagedDone.isDirectory());
        assertNull(byId.get("missing-done").job);
        assertTrue(missingDone.isDirectory());

        // Incomplete without a readable job: deleted.
        assertFalse(damagedHalf.exists());
        assertFalse(wrongId.exists());
        assertTrue(r.deleted.contains("damaged-half"));
        assertTrue(r.deleted.contains("wrong-id"));
        assertEquals(2, r.deleted.size());

        assertEquals("paused", byId.get("paused").intent);
        assertEquals("failed", byId.get("failed").intent);
        assertEquals("changed", byId.get("failed").error);
        assertEquals("active", byId.get("active").intent);

        assertFalse(trash.exists());
        assertFalse(staging.getParentFile().exists());

        // Areas without a job first, then in the order they were started.
        assertNull(r.areas.get(0).job);
        assertNull(r.areas.get(1).job);
        assertEquals("active", r.areas.get(2).id);
        assertEquals("paused", r.areas.get(3).id);
        assertEquals("good-done", r.areas.get(4).id);
        assertEquals("failed", r.areas.get(5).id);
    }

    @Test
    public void aJobStoredBeforeMobileDataWasAskedCountsAsNotAllowed() throws Exception {
        area("old", job("old", 1, null), false, 0);
        area("yes", job("yes", 2, true), false, 0);
        area("no", job("no", 3, false), false, 0);
        AreaScan.Result r = AreaScan.scan(tmp.getRoot());
        assertFalse(r.areas.get(0).job.allowMetered);
        assertTrue(r.areas.get(1).job.allowMetered);
        assertFalse(r.areas.get(2).job.allowMetered);
    }

    @Test
    public void anEmptyOrMissingRootIsNothing() {
        assertEquals(0, AreaScan.scan(new File(tmp.getRoot(), "none")).areas.size());
        assertEquals(0, AreaScan.scan(tmp.getRoot()).areas.size());
    }
}
