// MapApp. Copyright 2026 Play, Inc.
// Free software under the GNU GPL v3 with additional terms: see LICENSE and NOTICE.

package io.github.bartbasi.mapapp.downloads;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertTrue;

import org.junit.Test;

/** The wake lock is renewed while bytes move and let go when they stop (S4). */
public class WakeLeaseTest {

    /** A wake lock that runs out after its timeout, as Android's does. */
    private static final class FakeLock implements WakeLease.Lock {
        long now;
        long until = -1;
        int acquires;
        int releases;

        @Override
        public void acquire(long timeoutMs) {
            acquires++;
            until = now + timeoutMs;
        }

        @Override
        public void release() {
            releases++;
            until = -1;
        }

        boolean held() {
            return now < until;
        }
    }

    @Test
    public void anUnbrokenDownloadOfAnyLengthKeepsTheLock() {
        FakeLock lock = new FakeLock();
        WakeLease lease = new WakeLease(lock, () -> lock.now);
        // Bytes arrive every 100 ms for 3 hours.
        for (lock.now = 0; lock.now < 3 * 3600_000L; lock.now += 100) {
            lease.hold();
            assertTrue("held at " + lock.now, lock.held());
        }
        // Renewed about every 30 s, not on every chunk.
        assertEquals(3 * 3600 / 30, lock.acquires, 1);
        assertEquals(0, lock.releases);
    }

    @Test
    public void droppedAtOnceAndTakenAgainWhenBytesMoveAgain() {
        FakeLock lock = new FakeLock();
        WakeLease lease = new WakeLease(lock, () -> lock.now);
        lease.hold();
        assertTrue(lease.held());
        lease.drop();
        assertFalse(lock.held());
        assertFalse(lease.held());
        lease.drop();
        assertEquals("a second drop does nothing", 1, lock.releases);
        lock.now += 1000;
        lease.hold();
        assertTrue(lock.held());
        assertEquals(2, lock.acquires);
    }

    @Test
    public void aForgottenLeaseRunsOutByItself() {
        FakeLock lock = new FakeLock();
        WakeLease lease = new WakeLease(lock, () -> lock.now);
        lease.hold();
        lock.now += WakeLease.LEASE_MS;
        assertFalse(lock.held());
        assertFalse(lease.held());
    }

    @Test
    public void aShortPeriodForTests() {
        FakeLock lock = new FakeLock();
        WakeLease lease = new WakeLease(lock, () -> lock.now, 1000, 200);
        for (lock.now = 0; lock.now < 10_000; lock.now += 50) lease.hold();
        assertEquals(50, lock.acquires);
    }

    @Test(expected = IllegalArgumentException.class)
    public void renewalMustComeBeforeTheLeaseRunsOut() {
        new WakeLease(new FakeLock(), () -> 0, 1000, 1000);
    }
}
