// MapApp. Copyright 2026 Play, Inc.
// Free software under the GNU GPL v3 with additional terms: see LICENSE and NOTICE.

package io.github.bartbasi.mapapp.downloads;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertNull;
import static org.junit.Assert.assertTrue;

import java.util.Arrays;
import java.util.List;
import org.junit.Test;

/** Which area downloads, and what each shows, on Wi-Fi, mobile data and no connection (S1). */
public class ScheduleTest {

    private static Schedule.Entry e(String id, String intent, boolean allowMetered) {
        return new Schedule.Entry(id, intent, allowMetered);
    }

    private static String shown(Schedule.Entry x, List<Schedule.Entry> all, boolean usable, boolean metered, String running) {
        return Schedule.shown(x, all, usable, metered, false, running, false).toString();
    }

    @Test
    public void mayFetch() {
        assertTrue(Schedule.mayFetch(false, true, false));
        assertTrue(Schedule.mayFetch(true, true, false));
        assertTrue(Schedule.mayFetch(true, true, true));
        assertFalse(Schedule.mayFetch(false, true, true));
        assertFalse(Schedule.mayFetch(true, false, false));
        assertFalse(Schedule.mayFetch(true, false, true));
    }

    @Test
    public void onWifiTheFirstActiveAreaRunsAndTheRestWait() {
        Schedule.Entry done = e("done", "complete", false);
        Schedule.Entry a = e("a", "active", false);
        Schedule.Entry b = e("b", "active", true);
        List<Schedule.Entry> all = Arrays.asList(done, a, b);
        assertEquals("a", Schedule.pick(all, true, false));
        assertEquals("downloading", shown(a, all, true, false, "a"));
        assertEquals("queued", shown(b, all, true, false, "a"));
        assertEquals("complete", shown(done, all, true, false, "a"));
    }

    @Test
    public void onMobileDataAnAreaNotAllowedWaitsForWifiAndDoesNotHoldUpAnAllowedOne() {
        Schedule.Entry a = e("a", "active", false);
        Schedule.Entry b = e("b", "active", true);
        Schedule.Entry c = e("c", "active", true);
        List<Schedule.Entry> all = Arrays.asList(a, b, c);
        assertEquals("b", Schedule.pick(all, true, true));
        assertEquals("waiting/unmetered", shown(a, all, true, true, "b"));
        assertEquals("downloading", shown(b, all, true, true, "b"));
        assertEquals("queued", shown(c, all, true, true, "b"));
    }

    @Test
    public void onMobileDataWithNoAreaAllowedNothingIsFetched() {
        Schedule.Entry a = e("a", "active", false);
        Schedule.Entry b = e("b", "active", false);
        List<Schedule.Entry> all = Arrays.asList(a, b);
        assertNull(Schedule.pick(all, true, true));
        assertEquals("waiting/unmetered", shown(a, all, true, true, null));
        assertEquals("waiting/unmetered", shown(b, all, true, true, null));
        // The user allows mobile data for b: b goes on, a still waits.
        List<Schedule.Entry> allowed = Arrays.asList(a, e("b", "active", true));
        assertEquals("b", Schedule.pick(allowed, true, true));
        // Back on Wi-Fi: a, first in line, goes on by itself.
        assertEquals("a", Schedule.pick(all, true, false));
    }

    @Test
    public void withNoConnectionTheFirstAreaWaitsForOne() {
        Schedule.Entry paused = e("p", "paused", false);
        Schedule.Entry a = e("a", "active", false);
        Schedule.Entry b = e("b", "active", true);
        List<Schedule.Entry> all = Arrays.asList(paused, a, b);
        assertNull(Schedule.pick(all, false, false));
        assertNull(Schedule.pick(all, false, true));
        assertEquals("waiting/connection", shown(a, all, false, false, null));
        assertEquals("queued", shown(b, all, false, false, null));
        assertEquals("paused", shown(paused, all, false, false, null));
    }

    @Test
    public void failingTriesAndAndroidsTimeLimitShowWaitingForAConnection() {
        Schedule.Entry a = e("a", "active", true);
        List<Schedule.Entry> all = Arrays.asList(a);
        assertEquals("waiting/connection", Schedule.shown(a, all, true, false, false, "a", true).toString());
        assertEquals("waiting/connection", Schedule.shown(a, all, true, false, true, null, false).toString());
    }

    @Test
    public void pausedFailedAndCompleteAreasAreNeverPicked() {
        List<Schedule.Entry> all = Arrays.asList(e("p", "paused", true), e("f", "failed", true), e("c", "complete", true));
        assertNull(Schedule.pick(all, true, false));
        assertEquals("failed", shown(all.get(1), all, true, false, null));
    }
}
