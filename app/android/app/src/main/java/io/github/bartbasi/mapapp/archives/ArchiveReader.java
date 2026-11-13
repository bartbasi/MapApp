// MapApp. Copyright 2026 Play, Inc.
// Free software under the GNU GPL v3 with additional terms: see LICENSE and NOTICE.

package io.github.bartbasi.mapapp.archives;

import java.io.Closeable;
import java.io.IOException;

/** Byte-range reads from one archive. Safe to call from several threads at once. */
public interface ArchiveReader extends Closeable {

    /** The archive's size in bytes. */
    long size();

    /**
     * Reads up to {@code length} bytes starting at {@code offset}. Returns
     * fewer bytes only when the archive ends first.
     */
    byte[] read(long offset, int length) throws IOException;
}
