// MapApp. Copyright 2026 Play, Inc.
// Free software under the GNU GPL v3 with additional terms: see LICENSE and NOTICE.

package io.github.bartbasi.mapapp.downloads;

import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * The checks every answer to a byte-range request must pass before one byte
 * of it is written: status 206, a Content-Range naming exactly the bytes asked
 * for, a matching Content-Length, and the expected ETag when the job has one.
 * A 200 carries the whole file and is never appended.
 *
 * Pure logic, tested on the laptop.
 */
final class RangeResponse {

    /** What an answer means for the download. */
    enum Verdict {
        /** The right bytes: write them. */
        OK,
        /** 200 or another success that is not the asked range. The server does not serve ranges. */
        NOT_PARTIAL,
        /** A 206 for other bytes than were asked, or no usable Content-Range. */
        WRONG_RANGE,
        /** The file is not the one the plan was made from (ETag differs, or the file is shorter: 416). */
        CHANGED,
        /** The signed address ran out (401, 403). Ask the original address again. */
        EXPIRED,
        /** The file is gone or the server refuses (404, 410, other 4xx). */
        REFUSED,
        /** Worth trying again later (5xx, 408, 429). */
        RETRY,
    }

    private static final Pattern CONTENT_RANGE = Pattern.compile("^\\s*bytes\\s+(\\d+)-(\\d+)/(\\d+|\\*)\\s*$");

    private RangeResponse() {}

    /** A parsed Content-Range: first and last byte and the file's size (-1 when "*"). */
    static final class ContentRange {
        final long first;
        final long last;
        final long total;

        ContentRange(long first, long last, long total) {
            this.first = first;
            this.last = last;
            this.total = total;
        }
    }

    /** Parses "bytes first-last/total", or null if the header is absent or malformed. */
    static ContentRange parseContentRange(String header) {
        if (header == null) return null;
        Matcher m = CONTENT_RANGE.matcher(header);
        if (!m.matches()) return null;
        try {
            long first = Long.parseLong(m.group(1));
            long last = Long.parseLong(m.group(2));
            long total = "*".equals(m.group(3)) ? -1 : Long.parseLong(m.group(3));
            if (last < first || (total >= 0 && last >= total)) return null;
            return new ContentRange(first, last, total);
        } catch (NumberFormatException e) {
            return null;
        }
    }

    /** ETags compared without the weak prefix "W/". */
    static boolean sameEtag(String expected, String actual) {
        if (expected == null) return true;
        if (actual == null) return false;
        return strip(expected).equals(strip(actual));
    }

    private static String strip(String etag) {
        String t = etag.trim();
        return t.startsWith("W/") ? t.substring(2) : t;
    }

    /**
     * Judges an answer to a request for {@code length} bytes at {@code offset}.
     *
     * @param contentLength the Content-Length header, or -1 when absent
     * @param expectedEtag the job's ETag, or null for none
     */
    static Verdict judge(int status, String contentRange, long contentLength, String etag, long offset, long length, String expectedEtag) {
        if (status == 401 || status == 403) return Verdict.EXPIRED;
        if (status == 416) return Verdict.CHANGED;
        if (status == 408 || status == 429 || status >= 500) return Verdict.RETRY;
        if (status >= 400) return Verdict.REFUSED;
        if (status != 206) return Verdict.NOT_PARTIAL;
        if (!sameEtag(expectedEtag, etag)) return Verdict.CHANGED;
        ContentRange r = parseContentRange(contentRange);
        if (r == null || r.first != offset || r.last != offset + length - 1) return Verdict.WRONG_RANGE;
        if (contentLength >= 0 && contentLength != length) return Verdict.WRONG_RANGE;
        return Verdict.OK;
    }
}
