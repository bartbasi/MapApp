// MapApp. Copyright 2026 Play, Inc.
// Free software under the GNU GPL v3 with additional terms: see LICENSE and NOTICE.

package io.github.bartbasi.mapapp.downloads;

/**
 * The CPU wake lock, held only while bytes are moving (S4).
 *
 * The lock is taken with a short timeout and renewed while bytes arrive, so an
 * unbroken download of any length keeps it, and a path that forgets to let go
 * loses it within {@link #LEASE_MS} anyway. It is let go at once when the
 * download waits, is paused or ends.
 *
 * Pure logic over a small lock interface, tested on the laptop.
 */
final class WakeLease {

    /** How long one taking of the lock lasts if it is not renewed. */
    static final long LEASE_MS = 2 * 60 * 1000L;
    /** Renew when the lease is this old and bytes are still moving. */
    static final long RENEW_AFTER_MS = 30 * 1000L;

    /** The platform lock: PowerManager.WakeLock, not reference counted. */
    interface Lock {
        void acquire(long timeoutMs);

        void release();
    }

    /** A clock in milliseconds, so tests can move time. */
    interface Clock {
        long now();
    }

    private final Lock lock;
    private final Clock clock;
    private final long leaseMs;
    private final long renewAfterMs;
    private boolean held;
    private long takenAt;

    WakeLease(Lock lock, Clock clock) {
        this(lock, clock, LEASE_MS, RENEW_AFTER_MS);
    }

    WakeLease(Lock lock, Clock clock, long leaseMs, long renewAfterMs) {
        if (renewAfterMs >= leaseMs) throw new IllegalArgumentException("renew before the lease runs out");
        this.lock = lock;
        this.clock = clock;
        this.leaseMs = leaseMs;
        this.renewAfterMs = renewAfterMs;
    }

    /** Bytes are moving: take the lock, or renew it if the lease is getting old. */
    synchronized void hold() {
        long now = clock.now();
        if (held && now - takenAt < renewAfterMs) return;
        lock.acquire(leaseMs);
        held = true;
        takenAt = now;
    }

    /** No bytes are moving: let go now. Safe to call when not held. */
    synchronized void drop() {
        if (!held) return;
        held = false;
        lock.release();
    }

    /** True while this lease believes it holds the lock (it may also have run out by its timeout). */
    synchronized boolean held() {
        return held && clock.now() - takenAt < leaseMs;
    }
}
