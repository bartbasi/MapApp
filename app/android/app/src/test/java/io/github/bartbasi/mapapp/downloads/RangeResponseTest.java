// MapApp. Copyright 2026 Play, Inc.
// Free software under the GNU GPL v3 with additional terms: see LICENSE and NOTICE.

package io.github.bartbasi.mapapp.downloads;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertNull;
import static org.junit.Assert.assertTrue;

import io.github.bartbasi.mapapp.downloads.RangeResponse.Verdict;
import org.junit.Test;

/** The checks an answer must pass before any of it is written. */
public class RangeResponseTest {

    private static Verdict judge(int status, String range, long length, String etag, String expected) {
        return RangeResponse.judge(status, range, length, etag, 1000, 500, expected);
    }

    @Test
    public void theExactRangeIsAccepted() {
        assertEquals(Verdict.OK, judge(206, "bytes 1000-1499/90000", 500, "\"a\"", null));
        assertEquals(Verdict.OK, judge(206, "bytes 1000-1499/*", -1, null, null));
        assertEquals(Verdict.OK, judge(206, "bytes 1000-1499/90000", 500, "\"a\"", "\"a\""));
    }

    @Test
    public void aWholeFileIsNeverAppended() {
        assertEquals(Verdict.NOT_PARTIAL, judge(200, null, 90000, "\"a\"", null));
        assertEquals(Verdict.NOT_PARTIAL, judge(200, "bytes 1000-1499/90000", 500, "\"a\"", null));
        assertEquals(Verdict.NOT_PARTIAL, judge(204, null, 0, null, null));
    }

    @Test
    public void otherBytesAreRefused() {
        assertEquals(Verdict.WRONG_RANGE, judge(206, "bytes 0-499/90000", 500, null, null));
        assertEquals(Verdict.WRONG_RANGE, judge(206, "bytes 1000-1498/90000", 499, null, null));
        assertEquals(Verdict.WRONG_RANGE, judge(206, "bytes 1000-1999/90000", 1000, null, null));
        assertEquals(Verdict.WRONG_RANGE, judge(206, null, 500, null, null));
        assertEquals(Verdict.WRONG_RANGE, judge(206, "bytes=1000-1499", 500, null, null));
        // Right Content-Range, wrong Content-Length.
        assertEquals(Verdict.WRONG_RANGE, judge(206, "bytes 1000-1499/90000", 600, null, null));
    }

    @Test
    public void anotherEtagMeansTheFileChanged() {
        assertEquals(Verdict.CHANGED, judge(206, "bytes 1000-1499/90000", 500, "\"b\"", "\"a\""));
        assertEquals(Verdict.CHANGED, judge(206, "bytes 1000-1499/90000", 500, null, "\"a\""));
        assertEquals(Verdict.CHANGED, judge(416, "bytes */800", -1, null, null));
    }

    @Test
    public void weakAndStrongEtagsOfTheSameValueMatch() {
        assertEquals(Verdict.OK, judge(206, "bytes 1000-1499/90000", 500, "W/\"a\"", "\"a\""));
        assertTrue(RangeResponse.sameEtag("\"a\"", " W/\"a\" "));
        assertFalse(RangeResponse.sameEtag("\"a\"", "\"A\""));
        assertTrue(RangeResponse.sameEtag(null, null));
    }

    @Test
    public void statusesMapToWhatTheDownloaderDoes() {
        assertEquals(Verdict.EXPIRED, judge(403, null, 0, null, null));
        assertEquals(Verdict.EXPIRED, judge(401, null, 0, null, null));
        assertEquals(Verdict.REFUSED, judge(404, null, 0, null, null));
        assertEquals(Verdict.REFUSED, judge(410, null, 0, null, null));
        assertEquals(Verdict.RETRY, judge(500, null, 0, null, null));
        assertEquals(Verdict.RETRY, judge(503, null, 0, null, null));
        assertEquals(Verdict.RETRY, judge(429, null, 0, null, null));
        assertEquals(Verdict.RETRY, judge(408, null, 0, null, null));
    }

    @Test
    public void contentRangeParsing() {
        RangeResponse.ContentRange r = RangeResponse.parseContentRange("bytes 0-0/1");
        assertEquals(0, r.first);
        assertEquals(0, r.last);
        assertEquals(1, r.total);
        assertEquals(-1, RangeResponse.parseContentRange("bytes 5-9/*").total);
        assertEquals(3_000_000_000L, RangeResponse.parseContentRange("bytes 2999999999-2999999999/3000000000").total);
        assertNull(RangeResponse.parseContentRange(null));
        assertNull(RangeResponse.parseContentRange("bytes 9-5/100"));
        assertNull(RangeResponse.parseContentRange("bytes 0-100/100"));
        assertNull(RangeResponse.parseContentRange("bytes */100"));
        assertNull(RangeResponse.parseContentRange("items 0-5/100"));
        assertNull(RangeResponse.parseContentRange("bytes 0-99999999999999999999/1"));
    }
}
