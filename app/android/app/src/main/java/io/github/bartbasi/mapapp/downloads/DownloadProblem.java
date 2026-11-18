// MapApp. Copyright 2026 Play, Inc.
// Free software under the GNU GPL v3 with additional terms: see LICENSE and NOTICE.

package io.github.bartbasi.mapapp.downloads;

/** Why a file stopped before it was complete. */
final class DownloadProblem extends Exception {

    enum Kind {
        /** No connection, a cut connection, a busy server: try again later. */
        TRANSIENT,
        /** Will not mend itself. {@link #error} says why, in the words of contract.ts (AreaError). */
        FAILED,
        /** Paused, removed or told to stop by Android. */
        STOPPED,
    }

    final Kind kind;
    /** "changed", "no-space", "server", "corrupt" or "other" when FAILED. */
    final String error;
    /** True if some bytes were written before the problem, so a retry starts fresh. */
    final boolean madeProgress;

    private DownloadProblem(Kind kind, String error, String message, boolean madeProgress, Throwable cause) {
        super(message, cause);
        this.kind = kind;
        this.error = error;
        this.madeProgress = madeProgress;
    }

    static DownloadProblem transientProblem(String message, boolean madeProgress, Throwable cause) {
        return new DownloadProblem(Kind.TRANSIENT, null, message, madeProgress, cause);
    }

    static DownloadProblem failed(String error, String message) {
        return new DownloadProblem(Kind.FAILED, error, message, false, null);
    }

    static DownloadProblem stopped() {
        return new DownloadProblem(Kind.STOPPED, null, "stopped", false, null);
    }
}
