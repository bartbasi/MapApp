// MapApp. Copyright 2026 Play, Inc.
// Free software under the GNU GPL v3 with additional terms: see LICENSE and NOTICE.

package io.github.bartbasi.mapapp.downloads;

import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;

/** Small file helpers: atomic replace, whole reads, recursive delete. Plain Java. */
final class Files {

    private Files() {}

    static byte[] readAll(File file) throws IOException {
        try (InputStream in = new FileInputStream(file)) {
            return readAll(in, Long.MAX_VALUE);
        }
    }

    static String readText(File file) throws IOException {
        return new String(readAll(file), StandardCharsets.UTF_8);
    }

    /** Reads a stream to its end, failing if it holds more than {@code max} bytes. */
    static byte[] readAll(InputStream in, long max) throws IOException {
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        byte[] buffer = new byte[16384];
        long total = 0;
        int n;
        while ((n = in.read(buffer)) > 0) {
            total += n;
            if (total > max) throw new IOException("more than " + max + " bytes");
            out.write(buffer, 0, n);
        }
        return out.toByteArray();
    }

    /**
     * Replaces {@code target} with {@code data} in one step: written and synced
     * to a temporary file beside it, then renamed over it. A reader sees the old
     * file or the new one, never a part.
     */
    static void writeAtomically(File target, byte[] data) throws IOException {
        File tmp = new File(target.getParentFile(), "." + target.getName() + ".tmp");
        try (FileOutputStream out = new FileOutputStream(tmp)) {
            out.write(data);
            out.getFD().sync();
        }
        // On Android (Linux) a rename replaces the target in one step. Only on
        // Windows, where the laptop tests run, does it refuse an existing target;
        // there the old file is deleted first.
        if (!tmp.renameTo(target) && !(target.delete() && tmp.renameTo(target))) {
            tmp.delete();
            throw new IOException("could not rename into " + target);
        }
    }

    static void writeTextAtomically(File target, String text) throws IOException {
        writeAtomically(target, text.getBytes(StandardCharsets.UTF_8));
    }

    /** Deletes a file or a folder with everything in it. True if nothing is left. */
    static boolean deleteTree(File f) {
        if (f.isDirectory()) {
            File[] children = f.listFiles();
            if (children != null) for (File c : children) deleteTree(c);
        }
        return f.delete() || !f.exists();
    }

    static void mkdirs(File dir) throws IOException {
        if (!dir.isDirectory() && !dir.mkdirs() && !dir.isDirectory()) throw new IOException("could not make " + dir);
    }
}
