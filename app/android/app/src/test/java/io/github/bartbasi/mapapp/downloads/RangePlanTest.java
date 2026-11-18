// MapApp. Copyright 2026 Play, Inc.
// Free software under the GNU GPL v3 with additional terms: see LICENSE and NOTICE.

package io.github.bartbasi.mapapp.downloads;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertNull;
import static org.junit.Assert.fail;

import org.junit.Test;

/** Where a position in the new file comes from in the hosted file, which is how a download goes on. */
public class RangePlanTest {

    // Head 100 bytes; then hosted 1000..1049 (50), 5000..5009 (10), 9000..9299 (300). Total 460.
    private final RangePlan plan = new RangePlan(100, new long[] { 1000, 50, 5000, 10, 9000, 300 });

    @Test
    public void totalIsHeadPlusRanges() {
        assertEquals(460, plan.totalBytes);
        assertEquals(3, plan.rangeCount());
    }

    @Test
    public void positionsInTheHeadAreNotFetched() {
        assertEquals(-1, plan.rangeAt(0));
        assertEquals(-1, plan.rangeAt(99));
        assertNull(plan.next(0, 4096));
        assertNull(plan.next(99, 4096));
    }

    @Test
    public void rangeBoundaries() {
        assertEquals(0, plan.rangeAt(100));
        assertEquals(0, plan.rangeAt(149));
        assertEquals(1, plan.rangeAt(150));
        assertEquals(1, plan.rangeAt(159));
        assertEquals(2, plan.rangeAt(160));
        assertEquals(2, plan.rangeAt(459));
        assertEquals(3, plan.rangeAt(460));
    }

    @Test
    public void goesOnFromTheStartOfEachRange() {
        assertRequest(plan.next(100, 4096), 1000, 50);
        assertRequest(plan.next(150, 4096), 5000, 10);
        assertRequest(plan.next(160, 4096), 9000, 300);
    }

    @Test
    public void goesOnFromTheMiddleOfARange() {
        assertRequest(plan.next(123, 4096), 1023, 27);
        assertRequest(plan.next(155, 4096), 5005, 5);
        assertRequest(plan.next(459, 4096), 9299, 1);
    }

    @Test
    public void longRangesAreSplitIntoRequests() {
        assertRequest(plan.next(160, 128), 9000, 128);
        assertRequest(plan.next(288, 128), 9128, 128);
        assertRequest(plan.next(416, 128), 9256, 44);
    }

    @Test
    public void nothingIsLeftAtTheEnd() {
        assertNull(plan.next(460, 4096));
    }

    @Test
    public void walkingTheRequestsCoversEveryByteOnce() {
        long pos = plan.headBytes;
        long fetched = 0;
        int requests = 0;
        RangePlan.Request r;
        while ((r = plan.next(pos, 7)) != null) {
            pos += r.length;
            fetched += r.length;
            requests++;
        }
        assertEquals(460, pos);
        assertEquals(360, fetched);
        // 50 -> 8 requests, 10 -> 2, 300 -> 43.
        assertEquals(8 + 2 + 43, requests);
    }

    @Test
    public void aWholeFileIsOneRange() {
        RangePlan whole = new RangePlan(0, new long[] { 0, 3_000_000_000L });
        assertEquals(3_000_000_000L, whole.totalBytes);
        assertRequest(whole.next(0, FileDownloader.REQUEST_BYTES), 0, FileDownloader.REQUEST_BYTES);
        assertRequest(whole.next(2_999_999_000L, FileDownloader.REQUEST_BYTES), 2_999_999_000L, 1000);
    }

    @Test
    public void anEmptyPlanIsJustTheHead() {
        RangePlan head = new RangePlan(127, new long[0]);
        assertEquals(127, head.totalBytes);
        assertNull(head.next(0, 10));
        assertNull(head.next(127, 10));
    }

    @Test
    public void refusesBadRangesAndPositions() {
        expectBad(() -> new RangePlan(-1, new long[0]));
        expectBad(() -> new RangePlan(0, new long[] { 0 }));
        expectBad(() -> new RangePlan(0, new long[] { -5, 10 }));
        expectBad(() -> new RangePlan(0, new long[] { 5, 0 }));
        expectBad(() -> new RangePlan(0, new long[] { RangePlan.MAX_SAFE, 10 }));
        expectBad(() -> plan.rangeAt(-1));
        expectBad(() -> plan.rangeAt(461));
        expectBad(() -> plan.next(100, 0));
    }

    private static void assertRequest(RangePlan.Request r, long offset, long length) {
        assertEquals("offset", offset, r.hostedOffset);
        assertEquals("length", length, r.length);
        assertEquals(offset + length - 1, r.lastByte());
    }

    private static void expectBad(Runnable r) {
        try {
            r.run();
            fail("expected IllegalArgumentException");
        } catch (IllegalArgumentException expected) {
            // as it should be
        }
    }
}
