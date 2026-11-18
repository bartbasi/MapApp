// MapApp. Copyright 2026 Play, Inc.
// Free software under the GNU GPL v3 with additional terms: see LICENSE and NOTICE.

package io.github.bartbasi.mapapp.downloads;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertNull;
import static org.junit.Assert.fail;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;
import org.junit.Test;

/** The checks a job passes before it is stored, and job.json round trips. */
public class AreaJobTest {

    private static JSONObject file(String county, String layer) throws JSONException {
        JSONObject f = new JSONObject();
        f.put("county", county);
        f.put("layer", layer);
        f.put("url", "https://example.org/x.pmtiles");
        f.put("headBytes", 127);
        f.put("ranges", new JSONArray(new long[] { 1000, 10, 5000, 20 }));
        f.put("bytes", 157);
        f.put("meta", "{\"layer\":\"" + layer + "\"}");
        return f;
    }

    private static JSONObject job(JSONObject... files) throws JSONException {
        JSONObject o = new JSONObject();
        o.put("id", "area-1");
        o.put("record", "{\"name\":\"North 40\"}");
        JSONArray fa = new JSONArray();
        for (JSONObject f : files) fa.put(f);
        o.put("files", fa);
        return o;
    }

    @Test
    public void roundTrip() throws JSONException {
        JSONObject f = file("il-macon", "aerial");
        f.put("etag", "\"abc\"");
        f.put("sha256", "AB" + zeros(62));
        AreaJob job = AreaJob.fromJson(job(f, file("il-macon", "basemap")), 42);
        assertEquals(42, job.seq);
        assertEquals(314, job.totalBytes());
        AreaJob again = AreaJob.fromJson(job.toJson(), 0);
        assertEquals("area-1", again.id);
        assertEquals("{\"name\":\"North 40\"}", again.record);
        assertEquals(42, again.seq);
        assertEquals("\"abc\"", again.files.get(0).etag);
        assertEquals("ab" + zeros(62), again.files.get(0).sha256);
        assertNull(again.files.get(1).etag);
        assertEquals(127, again.files.get(1).plan.headBytes);
        assertEquals(157, again.files.get(1).bytes());
    }

    @Test
    public void bigNumbersSurvive() throws JSONException {
        JSONObject f = file("il-macon", "aerial");
        f.put("headBytes", 0);
        f.put("ranges", new JSONArray(new long[] { 0, 3_000_000_000L }));
        f.put("bytes", 3_000_000_000L);
        AreaJob job = AreaJob.fromJson(job(f), 1);
        assertEquals(3_000_000_000L, AreaJob.fromJson(job.toJson(), 0).totalBytes());
    }

    @Test
    public void refusals() throws JSONException {
        JSONObject sizes = file("il-macon", "aerial");
        sizes.put("bytes", 158);
        expectRefused(job(sizes));

        JSONObject ftp = file("il-macon", "aerial");
        ftp.put("url", "ftp://example.org/x");
        expectRefused(job(ftp));

        JSONObject fileUrl = file("il-macon", "aerial");
        fileUrl.put("url", "file:///data/data/x");
        expectRefused(job(fileUrl));

        expectRefused(job(file("../x", "aerial")));
        expectRefused(job(file("il-macon", "Aerial")));
        expectRefused(job(file("il-macon", "aerial"), file("il-macon", "aerial")));
        expectRefused(job());

        JSONObject meta = file("il-macon", "aerial");
        meta.put("meta", "not json");
        expectRefused(job(meta));

        JSONObject sha = file("il-macon", "aerial");
        sha.put("sha256", "xyz");
        expectRefused(job(sha));

        JSONObject frac = file("il-macon", "aerial");
        frac.put("ranges", new JSONArray(new double[] { 1000.5, 10, 5000, 20 }));
        expectRefused(job(frac));

        JSONObject badId = job(file("il-macon", "aerial"));
        badId.put("id", ".trash-1");
        expectRefused(badId);
    }

    private static String zeros(int n) {
        StringBuilder sb = new StringBuilder();
        for (int i = 0; i < n; i++) sb.append('0');
        return sb.toString();
    }

    private static void expectRefused(JSONObject o) {
        try {
            AreaJob.fromJson(o, 1);
            fail("expected a refusal: " + o);
        } catch (IllegalArgumentException | JSONException expected) {
            // as it should be
        }
    }
}
