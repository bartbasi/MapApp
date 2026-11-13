// MapApp. Copyright 2026 Play, Inc.
// Free software under the GNU GPL v3 with additional terms: see LICENSE and NOTICE.

package io.github.bartbasi.mapapp.archives;

import android.content.res.AssetFileDescriptor;
import java.io.Closeable;
import java.io.IOException;
import java.nio.ByteBuffer;
import java.nio.channels.FileChannel;

/**
 * Reads an archive as a window of a file channel: bytes {@code start} to
 * {@code start + size} of the underlying file.
 *
 * For an archive bundled in the APK the underlying file is the APK itself, and
 * the window is where the uncompressed asset sits inside it, so the archive is
 * read in place and never copied. A downloaded archive (Step 2) is a whole
 * file, a window starting at 0.
 *
 * Positional channel reads do not move a shared file position, so concurrent
 * tile requests do not interfere.
 */
final class ChannelArchiveReader implements ArchiveReader {

    private final FileChannel channel;
    private final long start;
    private final long size;
    private final Closeable owner;

    ChannelArchiveReader(FileChannel channel, long start, long size, Closeable owner) {
        this.channel = channel;
        this.start = start;
        this.size = size;
        this.owner = owner;
    }

    /** An uncompressed asset, read in place inside the APK. */
    static ChannelArchiveReader forAsset(AssetFileDescriptor afd) throws IOException {
        if (afd.getLength() == AssetFileDescriptor.UNKNOWN_LENGTH) {
            afd.close();
            throw new IOException("asset length unknown");
        }
        AssetFileDescriptor.AutoCloseInputStream stream = new AssetFileDescriptor.AutoCloseInputStream(afd);
        return new ChannelArchiveReader(stream.getChannel(), afd.getStartOffset(), afd.getLength(), stream);
    }

    @Override
    public long size() {
        return size;
    }

    @Override
    public byte[] read(long offset, int length) throws IOException {
        if (offset < 0 || length < 0 || offset > size) throw new IOException("read outside the archive");
        int n = (int) Math.min(length, size - offset);
        ByteBuffer buffer = ByteBuffer.allocate(n);
        long position = start + offset;
        while (buffer.hasRemaining()) {
            int got = channel.read(buffer, position + buffer.position());
            if (got < 0) throw new IOException("archive ended early");
        }
        return buffer.array();
    }

    @Override
    public void close() throws IOException {
        owner.close();
    }
}
