// MapApp. Copyright 2026 Play, Inc.
// Free software under the GNU GPL v3 with additional terms: see LICENSE and NOTICE.

package io.github.bartbasi.mapapp.downloads;

import java.io.File;
import java.io.IOException;
import java.io.RandomAccessFile;
import java.nio.charset.StandardCharsets;

/**
 * How far a file being written can be trusted. The checkpoint is written only
 * after the bytes before it are synced to storage, so on any restart the file
 * is cut back to the checkpoint and the download goes on from there. Bytes
 * after the checkpoint may be half written and are thrown away.
 *
 * The checkpoint is a small text file replaced in one rename, so it is never
 * seen half written either.
 */
final class Checkpoint {

    private Checkpoint() {}

    /**
     * Where to go on from. Bytes before the checkpoint were synced before it was
     * written, so every byte below both the checkpoint and the file's length is
     * good. With no checkpoint (-1) nothing is trusted.
     */
    static long resumeAt(long checkpoint, long partLength, long totalBytes) {
        if (checkpoint < 0 || partLength <= 0) return 0;
        return Math.min(Math.min(checkpoint, partLength), totalBytes);
    }

    /** The saved checkpoint, or -1 when there is none or it cannot be read. */
    static long read(File file) {
        if (!file.isFile()) return -1;
        try {
            String text = new String(Files.readAll(file), StandardCharsets.US_ASCII).trim();
            long v = Long.parseLong(text);
            return v >= 0 ? v : -1;
        } catch (IOException | NumberFormatException e) {
            return -1;
        }
    }

    static void write(File file, long position) throws IOException {
        Files.writeAtomically(file, Long.toString(position).getBytes(StandardCharsets.US_ASCII));
    }

    /**
     * Opens the part file for appending at the point to go on from. The file is
     * cut back to that point first, so stale bytes after the checkpoint can never
     * end up in the finished archive.
     *
     * @return the open file, positioned at the end; its length is the resume point
     */
    static RandomAccessFile openForResume(File part, File checkpoint, long totalBytes) throws IOException {
        long at = resumeAt(read(checkpoint), part.isFile() ? part.length() : 0, totalBytes);
        RandomAccessFile raf = new RandomAccessFile(part, "rw");
        try {
            raf.setLength(at);
            raf.seek(at);
            return raf;
        } catch (IOException e) {
            raf.close();
            throw e;
        }
    }
}
