// MapApp. Copyright 2026 Play, Inc.
// Free software under the GNU GPL v3 with additional terms: see LICENSE and NOTICE.

package io.github.bartbasi.mapapp.downloads;

import java.util.List;

/**
 * Which area downloads now, and what each area shows, given the network.
 *
 * Mobile data (S1, contract.ts AreaJob.allowMetered): over a connection charged
 * by use, an area that was not allowed it fetches nothing. It shows "waiting"
 * for "unmetered" and goes on by itself when the connection stops being
 * metered or the user allows mobile data. It does not hold up an allowed area
 * behind it. "Metered" is the same test NetworkWatch reports to the web app.
 *
 * Pure logic, tested on the laptop.
 */
final class Schedule {

    static final String CONNECTION = "connection";
    static final String UNMETERED = "unmetered";

    private Schedule() {}

    /** What the scheduler needs to know of an area. */
    static final class Entry {
        final String id;
        /** "active", "paused", "failed" or "complete". */
        final String intent;
        final boolean allowMetered;

        Entry(String id, String intent, boolean allowMetered) {
            this.id = id;
            this.intent = intent;
            this.allowMetered = allowMetered;
        }

        boolean active() {
            return "active".equals(intent);
        }
    }

    /** An area's status and, when waiting, what for. */
    static final class Shown {
        final String status;
        /** "connection", "unmetered", or null when not waiting. */
        final String waitingFor;

        Shown(String status, String waitingFor) {
            this.status = status;
            this.waitingFor = waitingFor;
        }

        @Override
        public String toString() {
            return waitingFor == null ? status : status + "/" + waitingFor;
        }
    }

    /** May an area fetch anything over the network as it is now? */
    static boolean mayFetch(boolean allowMetered, boolean usable, boolean metered) {
        return usable && (!metered || allowMetered);
    }

    /** The area to download now: the first active one that may fetch on this network, or null. */
    static String pick(List<Entry> ordered, boolean usable, boolean metered) {
        for (Entry e : ordered) {
            if (e.active() && mayFetch(e.allowMetered, usable, metered)) return e.id;
        }
        return null;
    }

    /**
     * What an area shows.
     *
     * @param runningId the area the worker is on, or null
     * @param runningWaiting true while the worker's tries fail (server not reached)
     * @param suspended Android stopped the service for its daily limit
     */
    static Shown shown(Entry e, List<Entry> ordered, boolean usable, boolean metered, boolean suspended, String runningId, boolean runningWaiting) {
        if (!e.active()) return new Shown(e.intent, null);
        if (suspended) return new Shown("waiting", CONNECTION);
        if (!usable) {
            // With no connection the first area in line waits for one; the others wait their turn.
            for (Entry o : ordered) {
                if (o.active()) return o.id.equals(e.id) ? new Shown("waiting", CONNECTION) : new Shown("queued", null);
            }
        }
        if (metered && !e.allowMetered) return new Shown("waiting", UNMETERED);
        if (e.id.equals(runningId)) return runningWaiting ? new Shown("waiting", CONNECTION) : new Shown("downloading", null);
        return new Shown("queued", null);
    }
}
