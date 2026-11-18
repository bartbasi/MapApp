// MapApp. Copyright 2026 Play, Inc.
// Free software under the GNU GPL v3 with additional terms: see LICENSE and NOTICE.

package io.github.bartbasi.mapapp.downloads;

import io.github.bartbasi.mapapp.archives.ArchiveIds;
import java.util.ArrayList;
import java.util.Collections;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

/**
 * One area to download, as src/downloads/contract.ts describes it (AreaJob,
 * FileJob), checked and in the form stored as job.json. The head bytes are not
 * in here: they are files of their own (AreaLayout).
 */
final class AreaJob {

    static final class FileSpec {
        final String county;
        final String layer;
        final String url;
        /** Null when the job gives none. */
        final String etag;
        final RangePlan plan;
        final long[] ranges;
        /** Lower case hex, or null. */
        final String sha256;
        final String meta;

        FileSpec(String county, String layer, String url, String etag, long headBytes, long[] ranges, long bytes, String sha256, String meta) {
            if (!ArchiveIds.isId(county) || !ArchiveIds.isId(layer)) throw new IllegalArgumentException("bad county or layer: " + county + "/" + layer);
            if (!isHttp(url)) throw new IllegalArgumentException("only http and https addresses: " + url);
            this.plan = new RangePlan(headBytes, ranges);
            if (plan.totalBytes != bytes) {
                throw new IllegalArgumentException(county + "/" + layer + ": head and ranges make " + plan.totalBytes + " bytes, the job says " + bytes);
            }
            if (sha256 != null && !sha256.matches("^[0-9a-fA-F]{64}$")) throw new IllegalArgumentException("bad sha256");
            try {
                new JSONObject(meta);
            } catch (JSONException | NullPointerException e) {
                throw new IllegalArgumentException(county + "/" + layer + ": meta is not a JSON object");
            }
            this.county = county;
            this.layer = layer;
            this.url = url;
            this.etag = etag == null || etag.isEmpty() ? null : etag;
            this.ranges = ranges.clone();
            this.sha256 = sha256 == null ? null : sha256.toLowerCase(Locale.ROOT);
            this.meta = meta;
        }

        long bytes() {
            return plan.totalBytes;
        }
    }

    final String id;
    final String record;
    /** Order of starting: the queue runs areas in this order. */
    final long seq;
    final List<FileSpec> files;
    /**
     * May this area fetch over a connection charged by use (contract.ts
     * AreaJob.allowMetered)? A job stored before the field existed has none,
     * which counts as false.
     */
    final boolean allowMetered;

    AreaJob(String id, String record, long seq, List<FileSpec> files, boolean allowMetered) {
        if (!ArchiveIds.isId(id)) throw new IllegalArgumentException("bad area ID: " + id);
        if (record == null) throw new IllegalArgumentException("no record");
        if (files.isEmpty()) throw new IllegalArgumentException("an area needs at least one file");
        Set<String> seen = new HashSet<>();
        for (FileSpec f : files) {
            if (!seen.add(f.county + "/" + f.layer)) throw new IllegalArgumentException("two files for " + f.county + "/" + f.layer);
        }
        this.id = id;
        this.record = record;
        this.seq = seq;
        this.files = Collections.unmodifiableList(new ArrayList<>(files));
        this.allowMetered = allowMetered;
    }

    /** The same job with another seq. */
    AreaJob withSeq(long newSeq) {
        return new AreaJob(id, record, newSeq, files, allowMetered);
    }

    /** The same job with another choice about metered connections. */
    AreaJob withAllowMetered(boolean allow) {
        return new AreaJob(id, record, seq, files, allow);
    }

    long totalBytes() {
        long t = 0;
        for (FileSpec f : files) t += f.bytes();
        return t;
    }

    static boolean isHttp(String url) {
        if (url == null) return false;
        String u = url.toLowerCase(Locale.ROOT);
        return u.startsWith("https://") || u.startsWith("http://");
    }

    /**
     * Reads a job as the web app sends it or as job.json holds it:
     * { id, record, seq?, allowMetered?, files: [{ county, layer, url, etag?,
     * headBytes, ranges: [offset, length, ...], bytes, sha256?, meta }] }.
     * allowMetered is true only when given as the JSON value true.
     */
    static AreaJob fromJson(JSONObject o, long seqIfAbsent) throws JSONException {
        JSONArray fa = o.getJSONArray("files");
        List<FileSpec> files = new ArrayList<>();
        for (int i = 0; i < fa.length(); i++) {
            JSONObject f = fa.getJSONObject(i);
            JSONArray ra = f.getJSONArray("ranges");
            long[] ranges = new long[ra.length()];
            for (int k = 0; k < ranges.length; k++) ranges[k] = exactLong(ra, k);
            files.add(new FileSpec(
                f.getString("county"),
                f.getString("layer"),
                f.getString("url"),
                f.has("etag") && !f.isNull("etag") ? f.getString("etag") : null,
                f.getLong("headBytes"),
                ranges,
                f.getLong("bytes"),
                f.has("sha256") && !f.isNull("sha256") ? f.getString("sha256") : null,
                f.getString("meta")
            ));
        }
        boolean allowMetered = Boolean.TRUE.equals(o.opt("allowMetered"));
        return new AreaJob(o.getString("id"), o.getString("record"), o.optLong("seq", seqIfAbsent), files, allowMetered);
    }

    /** A whole number from the array; a fraction or a number past 2^53 is refused. */
    private static long exactLong(JSONArray a, int i) throws JSONException {
        Object v = a.get(i);
        if (v instanceof Integer || v instanceof Long) return ((Number) v).longValue();
        if (v instanceof Number) {
            double d = ((Number) v).doubleValue();
            if (d == Math.rint(d) && Math.abs(d) <= RangePlan.MAX_SAFE) return (long) d;
        }
        throw new JSONException("range value " + v + " is not a whole number");
    }

    JSONObject toJson() throws JSONException {
        JSONObject o = new JSONObject();
        o.put("v", 1);
        o.put("id", id);
        o.put("record", record);
        o.put("seq", seq);
        o.put("allowMetered", allowMetered);
        JSONArray fa = new JSONArray();
        for (FileSpec f : files) {
            JSONObject j = new JSONObject();
            j.put("county", f.county);
            j.put("layer", f.layer);
            j.put("url", f.url);
            if (f.etag != null) j.put("etag", f.etag);
            j.put("headBytes", f.plan.headBytes);
            JSONArray ra = new JSONArray();
            for (long r : f.ranges) ra.put(r);
            j.put("ranges", ra);
            j.put("bytes", f.bytes());
            if (f.sha256 != null) j.put("sha256", f.sha256);
            j.put("meta", f.meta);
            fa.put(j);
        }
        o.put("files", fa);
        return o;
    }
}
