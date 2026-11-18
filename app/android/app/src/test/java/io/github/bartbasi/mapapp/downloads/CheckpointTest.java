// MapApp. Copyright 2026 Play, Inc.
// Free software under the GNU GPL v3 with additional terms: see LICENSE and NOTICE.

package io.github.bartbasi.mapapp.downloads;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertTrue;

import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.RandomAccessFile;
import java.nio.charset.StandardCharsets;
import org.junit.Rule;
import org.junit.Test;
import org.junit.rules.TemporaryFolder;

/** Going on from a checkpoint after the app was killed at any byte. */
public class CheckpointTest {

    @Rule
    public TemporaryFolder tmp = new TemporaryFolder();

    @Test
    public void resumePointIsTheSmallerOfCheckpointAndFile() {
        // Killed after more bytes reached the file than the checkpoint vouches for.
        assertEquals(1000, Checkpoint.resumeAt(1000, 1500, 5000));
        // A checkpoint past the file's end (storage lost the tail): trust only what is there.
        assertEquals(800, Checkpoint.resumeAt(1000, 800, 5000));
        assertEquals(1000, Checkpoint.resumeAt(1000, 1000, 5000));
        // Never past the end of the file being made.
        assertEquals(5000, Checkpoint.resumeAt(9000, 9000, 5000));
    }

    @Test
    public void withoutACheckpointNothingIsTrusted() {
        assertEquals(0, Checkpoint.resumeAt(-1, 1500, 5000));
        assertEquals(0, Checkpoint.resumeAt(1000, 0, 5000));
    }

    @Test
    public void checkpointRoundTripAndBadFiles() throws IOException {
        File c = tmp.newFile("0.ckpt");
        Checkpoint.write(c, 123456789012L);
        assertEquals(123456789012L, Checkpoint.read(c));
        assertFalse(new File(c.getParentFile(), ".0.ckpt.tmp").exists());
        write(c, "garbage");
        assertEquals(-1, Checkpoint.read(c));
        write(c, "-5");
        assertEquals(-1, Checkpoint.read(c));
        write(c, "");
        assertEquals(-1, Checkpoint.read(c));
        assertEquals(-1, Checkpoint.read(new File(tmp.getRoot(), "missing")));
    }

    @Test
    public void bytesAfterTheCheckpointAreCutOff() throws IOException {
        File part = tmp.newFile("0.part");
        File ckpt = new File(tmp.getRoot(), "0.ckpt");
        write(part, "0123456789ABCDEF");
        Checkpoint.write(ckpt, 10);
        try (RandomAccessFile raf = Checkpoint.openForResume(part, ckpt, 100)) {
            assertEquals(10, raf.length());
            assertEquals(10, raf.getFilePointer());
            raf.write("xy".getBytes(StandardCharsets.US_ASCII));
        }
        assertEquals("0123456789xy", new String(Files.readAll(part), StandardCharsets.US_ASCII));
    }

    @Test
    public void noCheckpointStartsTheFileAgain() throws IOException {
        File part = tmp.newFile("1.part");
        write(part, "stale bytes");
        try (RandomAccessFile raf = Checkpoint.openForResume(part, new File(tmp.getRoot(), "1.ckpt"), 100)) {
            assertEquals(0, raf.length());
        }
        // And a missing part file is made.
        File fresh = new File(tmp.getRoot(), "2.part");
        try (RandomAccessFile raf = Checkpoint.openForResume(fresh, new File(tmp.getRoot(), "2.ckpt"), 100)) {
            assertEquals(0, raf.length());
        }
        assertTrue(fresh.isFile());
    }

    private static void write(File f, String text) throws IOException {
        try (FileOutputStream out = new FileOutputStream(f)) {
            out.write(text.getBytes(StandardCharsets.US_ASCII));
        }
    }
}
