// MapApp. Copyright 2026 Play, Inc.
// Free software under the GNU GPL v3 with additional terms: see LICENSE and NOTICE.

package io.github.bartbasi.mapapp.downloads;

/**
 * The layout of one file a job produces: the head, then each byte range of the
 * hosted file in order (src/downloads/assemble.ts is the reference). Maps a
 * position in the new file to the hosted bytes that belong there, which is
 * how a download goes on from any byte.
 *
 * Pure logic, no Android classes, so it is tested on the laptop.
 */
final class RangePlan {

    /** The next read of the hosted file: {@code length} bytes at {@code hostedOffset}. */
    static final class Request {
        final long hostedOffset;
        final long length;

        Request(long hostedOffset, long length) {
            this.hostedOffset = hostedOffset;
            this.length = length;
        }

        /** The last byte, as a Range header and Content-Range count it. */
        long lastByte() {
            return hostedOffset + length - 1;
        }

        @Override
        public String toString() {
            return "bytes " + hostedOffset + "-" + lastByte();
        }
    }

    final long headBytes;
    private final long[] offsets;
    private final long[] lengths;
    /** starts[i]: where range i begins in the new file. */
    private final long[] starts;
    final long totalBytes;

    /**
     * @param ranges offset, length, offset, length, ... of the hosted file.
     * @throws IllegalArgumentException for a negative offset, an empty range or a size past 2^53.
     */
    RangePlan(long headBytes, long[] ranges) {
        if (headBytes < 0) throw new IllegalArgumentException("negative head");
        if (ranges.length % 2 != 0) throw new IllegalArgumentException("ranges must be offset and length pairs");
        int n = ranges.length / 2;
        offsets = new long[n];
        lengths = new long[n];
        starts = new long[n];
        long at = headBytes;
        for (int i = 0; i < n; i++) {
            long offset = ranges[2 * i];
            long length = ranges[2 * i + 1];
            if (offset < 0 || length <= 0) throw new IllegalArgumentException("bad range " + offset + "+" + length);
            if (offset > MAX_SAFE - length || at > MAX_SAFE - length) throw new IllegalArgumentException("range too large");
            offsets[i] = offset;
            lengths[i] = length;
            starts[i] = at;
            at += length;
        }
        this.headBytes = headBytes;
        this.totalBytes = at;
    }

    /** The largest whole number JavaScript holds exactly. */
    static final long MAX_SAFE = (1L << 53) - 1;

    int rangeCount() {
        return offsets.length;
    }

    /**
     * The range that holds new-file position {@code position}, or -1 when the
     * position is in the head, or {@link #rangeCount()} at the end of the file.
     */
    int rangeAt(long position) {
        if (position < 0 || position > totalBytes) throw new IllegalArgumentException("position " + position + " outside 0.." + totalBytes);
        if (position < headBytes) return -1;
        if (position == totalBytes) return offsets.length;
        // Binary search for the last range starting at or before the position.
        int lo = 0;
        int hi = offsets.length - 1;
        while (lo < hi) {
            int mid = (lo + hi + 1) >>> 1;
            if (starts[mid] <= position) lo = mid;
            else hi = mid - 1;
        }
        return lo;
    }

    /**
     * What to fetch next to continue the file from {@code position}: the rest
     * of the range that holds it, at most {@code maxLength} bytes. Null when the
     * position is in the head (the head is copied, not fetched) or at the end.
     */
    Request next(long position, long maxLength) {
        if (maxLength <= 0) throw new IllegalArgumentException("maxLength must be positive");
        int i = rangeAt(position);
        if (i < 0 || i >= offsets.length) return null;
        long within = position - starts[i];
        long left = lengths[i] - within;
        return new Request(offsets[i] + within, Math.min(left, maxLength));
    }
}
