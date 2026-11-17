// MapApp. Copyright 2026 Play, Inc.
// Free software under the GNU GPL v3 with additional terms: see LICENSE and NOTICE.

package io.github.bartbasi.mapapp.location;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertTrue;

import io.github.bartbasi.mapapp.location.FixArbiter.Provider;
import org.junit.Test;

/** Which fixes reach the app when the GPS and the fused provider are both heard. */
public class FixArbiterTest {

    private static final long S = 1_000_000_000L;

    @Test
    public void gpsFixesAlwaysPass() {
        FixArbiter a = new FixArbiter();
        assertTrue(a.accept(Provider.GPS, 10 * S, 10 * S));
        assertTrue(a.accept(Provider.GPS, 11 * S, 11 * S));
        assertTrue(a.accept(Provider.GPS, 12 * S, 12 * S + S / 2));
    }

    @Test
    public void fusedGivesTheFirstFixWhenNoGpsHasBeenHeard() {
        FixArbiter a = new FixArbiter();
        assertTrue(a.accept(Provider.FUSED, 10 * S, 10 * S));
        assertTrue(a.accept(Provider.FUSED, 11 * S, 11 * S));
    }

    @Test
    public void fusedIsQuietWhileGpsIsFresh() {
        FixArbiter a = new FixArbiter();
        assertTrue(a.accept(Provider.GPS, 10 * S, 10 * S));
        assertFalse(a.accept(Provider.FUSED, 11 * S, 11 * S));
        // 4.9 s after the GPS fix: still fresh.
        assertFalse(a.accept(Provider.FUSED, 14 * S, 14 * S + 9 * S / 10));
        // Exactly 5 s: no longer younger than 5 s.
        assertTrue(a.accept(Provider.FUSED, 15 * S, 15 * S));
    }

    @Test
    public void gpsTakesOverAgainAtOnce() {
        FixArbiter a = new FixArbiter();
        assertTrue(a.accept(Provider.FUSED, 10 * S, 10 * S));
        assertTrue(a.accept(Provider.GPS, 11 * S, 11 * S));
        assertFalse(a.accept(Provider.FUSED, 12 * S, 12 * S));
    }

    @Test
    public void freshnessCountsFromWhenTheGpsFixWasTakenNotWhenItArrived() {
        FixArbiter a = new FixArbiter();
        // A GPS fix taken at 10 s that arrives late, at 14 s.
        assertTrue(a.accept(Provider.GPS, 10 * S, 14 * S));
        // At 15.5 s it is 5.5 s old, so the fused fix may pass.
        assertTrue(a.accept(Provider.FUSED, 15 * S, 15 * S + S / 2));
    }

    @Test
    public void neverStepsBackInTime() {
        FixArbiter a = new FixArbiter();
        assertTrue(a.accept(Provider.FUSED, 20 * S, 20 * S));
        // A GPS fix taken before the fix already shown is dropped...
        assertFalse(a.accept(Provider.GPS, 19 * S, 20 * S));
        // ...but still counts as a working GPS, so fused stays quiet.
        assertFalse(a.accept(Provider.FUSED, 21 * S, 21 * S));
        // The same fix twice passes once.
        assertTrue(a.accept(Provider.GPS, 22 * S, 22 * S));
        assertFalse(a.accept(Provider.GPS, 22 * S, 22 * S));
    }

    @Test
    public void resetForgetsTheGps() {
        FixArbiter a = new FixArbiter();
        assertTrue(a.accept(Provider.GPS, 10 * S, 10 * S));
        a.reset();
        assertTrue(a.accept(Provider.FUSED, 5 * S, 11 * S));
    }

    @Test
    public void ageIsFromTheFixNotFromArrival() {
        assertEquals(0L, FixArbiter.ageMillis(10 * S, 10 * S));
        assertEquals(1500L, FixArbiter.ageMillis(10 * S, 11 * S + S / 2));
        // A fix stamped a little ahead of the clock is not given a negative age.
        assertEquals(0L, FixArbiter.ageMillis(11 * S, 10 * S));
    }
}
