// MapApp. Copyright 2026 Play, Inc.
// Free software under the GNU GPL v3 with additional terms: see LICENSE and NOTICE.

package io.github.bartbasi.mapapp.location;

/**
 * Decides which fixes reach the app when two providers are heard at once:
 * the phone's GPS and, where the phone has it, the platform's own fused
 * provider (DECISIONS D31).
 *
 * The rules:
 * - A GPS fix is always passed on.
 * - A fused fix is passed on only while no GPS fix younger than
 *   {@link #GPS_FRESH_NANOS} has been heard. So the fused provider gives a
 *   first fix indoors and in town, and fills a gap when the sky is lost,
 *   but is never preferred over a working GPS.
 * - A fix that is not newer than the last one passed on is dropped, from
 *   either provider, so the marker never steps back in time.
 *
 * All times are Android's elapsed-realtime clock in nanoseconds (the fix's
 * own {@code getElapsedRealtimeNanos()} and {@code SystemClock.elapsedRealtimeNanos()}),
 * which does not jump when the wall clock is set. Pure Java, so it is tested
 * on the build machine (FixArbiterTest).
 */
final class FixArbiter {

    /** A GPS fix younger than this keeps the fused provider quiet. */
    static final long GPS_FRESH_NANOS = 5_000_000_000L;

    enum Provider { GPS, FUSED }

    private boolean heardGps;
    private long lastGpsNanos;
    private boolean delivered;
    private long lastDeliveredNanos;

    /**
     * True when this fix should be passed on to the app.
     *
     * @param provider where the fix came from
     * @param fixNanos when the fix was taken, by the elapsed-realtime clock
     * @param nowNanos now, by the same clock
     */
    boolean accept(Provider provider, long fixNanos, long nowNanos) {
        if (provider == Provider.GPS) {
            // Heard even when dropped below as out of order: the GPS is working.
            if (!heardGps || fixNanos > lastGpsNanos) lastGpsNanos = fixNanos;
            heardGps = true;
        } else if (gpsIsFresh(nowNanos)) {
            return false;
        }
        if (delivered && fixNanos <= lastDeliveredNanos) return false;
        delivered = true;
        lastDeliveredNanos = fixNanos;
        return true;
    }

    /** True while a GPS fix younger than GPS_FRESH_NANOS has been heard. */
    boolean gpsIsFresh(long nowNanos) {
        return heardGps && nowNanos - lastGpsNanos < GPS_FRESH_NANOS;
    }

    /** Forgets everything, for a new watch. */
    void reset() {
        heardGps = false;
        delivered = false;
        lastGpsNanos = 0;
        lastDeliveredNanos = 0;
    }

    /** How old a fix is at delivery, in milliseconds, never below zero. */
    static long ageMillis(long fixNanos, long nowNanos) {
        return Math.max(0L, (nowNanos - fixNanos) / 1_000_000L);
    }
}
