// MapApp. Copyright 2026 Play, Inc.
// Free software under the GNU GPL v3 with additional terms: see LICENSE and NOTICE.

package io.github.bartbasi.mapapp.downloads;

import java.io.IOException;

/**
 * Makes removing an area win over the worker, always. One per area.
 *
 * The worker enters before it touches the area's files and leaves after. The
 * last step that makes an area visible ("complete") runs through
 * {@link #commit}, which does nothing once the area is marked removed.
 * {@link #markRemoved} and then {@link #awaitOut} return only when the worker
 * is out, so after them the caller can delete the folder knowing no file of
 * the area can appear again: the worker never enters a removed area.
 *
 * Pure logic, tested on the laptop.
 */
final class AreaGuard {

    /** A step that writes a file. */
    interface Step {
        void run() throws IOException;
    }

    private boolean inside;
    private boolean removed;

    /** The worker starts on the area. False if it was removed: then it must not touch it. */
    synchronized boolean enter() {
        if (removed) return false;
        inside = true;
        return true;
    }

    /** The worker is done with the area's files for now. */
    synchronized void leave() {
        inside = false;
        notifyAll();
    }

    synchronized boolean isRemoved() {
        return removed;
    }

    /**
     * Runs the step unless the area was removed. A removal that comes while the
     * step runs waits for it, and then deletes what it wrote.
     *
     * @return false if the area was removed and the step did not run
     */
    synchronized boolean commit(Step step) throws IOException {
        if (removed) return false;
        step.run();
        return true;
    }

    /** From now on the worker cannot enter, and no commit runs. Does not wait. */
    synchronized void markRemoved() {
        removed = true;
    }

    /** Waits until the worker is out of the area. Call after {@link #markRemoved}. */
    synchronized void awaitOut() throws InterruptedException {
        while (inside) wait();
    }
}
