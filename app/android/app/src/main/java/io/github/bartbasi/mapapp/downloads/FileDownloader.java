// MapApp. Copyright 2026 Play, Inc.
// Free software under the GNU GPL v3 with additional terms: see LICENSE and NOTICE.

package io.github.bartbasi.mapapp.downloads;

import android.system.ErrnoException;
import android.system.OsConstants;
import android.util.Log;
import java.io.File;
import java.io.FileInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.RandomAccessFile;
import java.net.HttpURLConnection;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;

/**
 * Writes one file of an area: the head, then each byte range of the hosted
 * file in order, in requests of at most {@link #REQUEST_BYTES}. It knows
 * nothing about map tiles.
 *
 * Goes on from any byte: a checkpoint is written after the bytes before it are
 * synced, at least every {@link #CHECKPOINT_BYTES} or {@link #CHECKPOINT_MS},
 * and on a restart the file is cut back to it (see {@link Checkpoint}). When a
 * connection breaks mid-answer, the bytes that did arrive are kept.
 *
 * When the file is complete its size and checksum are checked, its meta.json
 * is written, and it is renamed into &lt;county&gt;/&lt;layer&gt;.pmtiles.
 */
final class FileDownloader {

    private static final String TAG = "MapAppDownloads";
    /** The largest single request. Smaller requests lose less when a signed address runs out. */
    static final long REQUEST_BYTES = 4L * 1024 * 1024;
    static final long CHECKPOINT_BYTES = 1024L * 1024;
    static final long CHECKPOINT_MS = 1000;
    private static final int BUFFER = 64 * 1024;

    /** What the downloader is told and asked while it works. */
    interface Control {
        /** Bytes of this file written so far. Called often; must be cheap. */
        void progress(long position);

        boolean stopRequested();

        /** The connection now open, so that stopping can cut it. Null when none. */
        void connection(HttpURLConnection connection);
    }

    private final File areaDir;
    private final int index;
    private final AreaJob.FileSpec spec;
    private final Control control;
    /** The address the original one last redirected to, reused until it stops working. */
    private String signedUrl;
    /** {@link #REQUEST_BYTES}; smaller in tests. */
    long requestBytes = REQUEST_BYTES;

    FileDownloader(File areaDir, int index, AreaJob.FileSpec spec, Control control) {
        this.areaDir = areaDir;
        this.index = index;
        this.spec = spec;
        this.control = control;
    }

    /** True if this file is already in place from an earlier run. */
    static boolean isDone(File areaDir, AreaJob.FileSpec spec) {
        File archive = AreaLayout.archive(areaDir, spec.county, spec.layer);
        return archive.isFile() && archive.length() == spec.bytes() && AreaLayout.meta(areaDir, spec.county, spec.layer).isFile();
    }

    /** Bytes of this file that a restart would keep. */
    static long bytesKept(File areaDir, int index, AreaJob.FileSpec spec) {
        if (isDone(areaDir, spec)) return spec.bytes();
        File part = AreaLayout.part(areaDir, index);
        return Checkpoint.resumeAt(Checkpoint.read(AreaLayout.checkpoint(areaDir, index)), part.isFile() ? part.length() : 0, spec.bytes());
    }

    void run() throws DownloadProblem {
        if (isDone(areaDir, spec)) return;
        File part = AreaLayout.part(areaDir, index);
        File ckpt = AreaLayout.checkpoint(areaDir, index);
        RangePlan plan = spec.plan;
        long pos;
        try (RandomAccessFile out = Checkpoint.openForResume(part, ckpt, plan.totalBytes)) {
            pos = out.length();
            Log.i(TAG, "file " + index + " (" + spec.county + "/" + spec.layer + "): going on from byte " + pos + " of " + plan.totalBytes);
            control.progress(pos);
            if (pos < plan.headBytes) {
                pos = copyHead(out, pos);
                sync(out, ckpt, pos);
            }
            while (pos < plan.totalBytes) {
                if (control.stopRequested()) throw DownloadProblem.stopped();
                checkSpace(plan.totalBytes - pos);
                RangePlan.Request request = plan.next(pos, requestBytes);
                pos = fetch(request, out, ckpt, pos);
            }
            sync(out, ckpt, pos);
        } catch (IOException e) {
            throw writeProblem(e);
        }
        finish(part, ckpt);
    }

    private long copyHead(RandomAccessFile out, long pos) throws IOException, DownloadProblem {
        File head = AreaLayout.head(areaDir, index);
        if (!head.isFile() || head.length() != spec.plan.headBytes) {
            throw DownloadProblem.failed("other", "head file of " + spec.county + "/" + spec.layer + " is missing or the wrong size");
        }
        try (InputStream in = new FileInputStream(head)) {
            long skipped = 0;
            while (skipped < pos) {
                long s = in.skip(pos - skipped);
                if (s <= 0) throw new IOException("head ended early");
                skipped += s;
            }
            byte[] buffer = new byte[BUFFER];
            int n;
            while ((n = in.read(buffer)) > 0) {
                out.write(buffer, 0, n);
                pos += n;
            }
        }
        control.progress(pos);
        return pos;
    }

    /** One request: the next piece of a range, written as it arrives. Returns the new position. */
    private long fetch(RangePlan.Request request, RandomAccessFile out, File ckpt, long pos) throws IOException, DownloadProblem {
        Http.Answer answer;
        while (true) {
            boolean usedSigned = signedUrl != null;
            String url = usedSigned ? signedUrl : spec.url;
            try {
                answer = Http.get(url, request.hostedOffset, request.length, control::connection);
            } catch (Http.BadAddress e) {
                throw DownloadProblem.failed("server", e.getMessage());
            } catch (IOException e) {
                control.connection(null);
                if (control.stopRequested()) throw DownloadProblem.stopped();
                throw DownloadProblem.transientProblem("request failed: " + e, false, e);
            }
            RangeResponse.Verdict verdict = RangeResponse.judge(
                answer.status,
                answer.header("Content-Range"),
                answer.contentLength(),
                answer.header("ETag"),
                request.hostedOffset,
                request.length,
                spec.etag
            );
            if (usedSigned && RangeResponse.renewFromOriginal(answer.status)) {
                // The signed address may have run out, whatever 4xx it gives:
                // ask the original address once for a fresh one. Its answer decides.
                Log.i(TAG, "signed address answered " + answer.status + "; asking the original address again");
                answer.close();
                signedUrl = null;
                continue;
            }
            if (verdict != RangeResponse.Verdict.OK) {
                answer.close();
                control.connection(null);
                Log.w(TAG, "answer " + answer.status + " for " + request + ": " + verdict);
                switch (verdict) {
                    case CHANGED:
                        throw DownloadProblem.failed("changed", "the hosted file changed (" + answer.status + ")");
                    case RETRY:
                        throw DownloadProblem.transientProblem("server busy: " + answer.status, false, null);
                    default:
                        throw DownloadProblem.failed("server", "the server answered " + answer.status + " (" + verdict + ")");
                }
            }
            if (answer.redirected) signedUrl = answer.url;
            break;
        }

        long got = 0;
        long syncedAt = pos;
        long syncedTime = System.nanoTime();
        byte[] buffer = new byte[BUFFER];
        InputStream in;
        try {
            in = answer.connection.getInputStream();
        } catch (IOException e) {
            answer.close();
            control.connection(null);
            if (control.stopRequested()) throw DownloadProblem.stopped();
            throw DownloadProblem.transientProblem("no answer body: " + e, false, e);
        }
        try {
            while (got < request.length) {
                int n;
                try {
                    n = in.read(buffer, 0, (int) Math.min(buffer.length, request.length - got));
                } catch (IOException e) {
                    sync(out, ckpt, pos);
                    if (control.stopRequested()) throw DownloadProblem.stopped();
                    throw DownloadProblem.transientProblem("connection broke after " + got + " of " + request.length + " bytes: " + e, got > 0, e);
                }
                if (n < 0) {
                    sync(out, ckpt, pos);
                    throw DownloadProblem.transientProblem("answer ended after " + got + " of " + request.length + " bytes", got > 0, null);
                }
                out.write(buffer, 0, n);
                got += n;
                pos += n;
                control.progress(pos);
                long now = System.nanoTime();
                if (pos - syncedAt >= CHECKPOINT_BYTES || now - syncedTime >= CHECKPOINT_MS * 1_000_000L) {
                    sync(out, ckpt, pos);
                    syncedAt = pos;
                    syncedTime = now;
                }
                if (control.stopRequested()) {
                    sync(out, ckpt, pos);
                    throw DownloadProblem.stopped();
                }
            }
        } finally {
            try {
                in.close();
            } catch (IOException ignored) {
                // The bytes that matter are already written and synced.
            }
            answer.close();
            control.connection(null);
        }
        sync(out, ckpt, pos);
        return pos;
    }

    /** Makes every byte so far durable, then records the checkpoint. */
    private static void sync(RandomAccessFile out, File ckpt, long pos) throws IOException {
        out.getFD().sync();
        Checkpoint.write(ckpt, pos);
    }

    private void checkSpace(long needed) throws DownloadProblem {
        long free = areaDir.getUsableSpace();
        if (free > 0 && free < needed) {
            throw DownloadProblem.failed("no-space", "needs " + needed + " bytes, " + free + " free");
        }
    }

    private void finish(File part, File ckpt) throws DownloadProblem {
        try {
            long size = part.length();
            if (size != spec.bytes()) {
                discard(part, ckpt);
                throw DownloadProblem.failed("corrupt", "finished file is " + size + " bytes, the job says " + spec.bytes());
            }
            if (spec.sha256 != null) {
                String actual = sha256(part);
                if (!actual.equals(spec.sha256)) {
                    discard(part, ckpt);
                    throw DownloadProblem.failed("corrupt", "checksum " + actual + " is not " + spec.sha256);
                }
            }
            File archive = AreaLayout.archive(areaDir, spec.county, spec.layer);
            Files.mkdirs(archive.getParentFile());
            Files.writeTextAtomically(AreaLayout.meta(areaDir, spec.county, spec.layer), spec.meta);
            if (!part.renameTo(archive)) throw new IOException("could not rename " + part + " into place");
            ckpt.delete();
            AreaLayout.head(areaDir, index).delete();
            Log.i(TAG, "file " + index + " (" + spec.county + "/" + spec.layer + ") complete, " + size + " bytes");
        } catch (IOException e) {
            throw writeProblem(e);
        }
    }

    /** A file that failed its checks starts again from nothing when the area is resumed. */
    private static void discard(File part, File ckpt) {
        ckpt.delete();
        part.delete();
    }

    private static String sha256(File file) throws IOException {
        MessageDigest md;
        try {
            md = MessageDigest.getInstance("SHA-256");
        } catch (NoSuchAlgorithmException e) {
            throw new IOException(e);
        }
        try (InputStream in = new FileInputStream(file)) {
            byte[] buffer = new byte[BUFFER];
            int n;
            while ((n = in.read(buffer)) > 0) md.update(buffer, 0, n);
        }
        StringBuilder sb = new StringBuilder();
        for (byte b : md.digest()) sb.append(String.format("%02x", b));
        return sb.toString();
    }

    /** A storage error: out of space, or something else that will not mend itself. */
    private static DownloadProblem writeProblem(IOException e) {
        Log.w(TAG, "storage error", e);
        return isNoSpace(e) ? DownloadProblem.failed("no-space", e.getMessage()) : DownloadProblem.failed("other", "storage error: " + e.getMessage());
    }

    static boolean isNoSpace(Throwable e) {
        for (Throwable t = e; t != null; t = t.getCause()) {
            if (t instanceof ErrnoException && ((ErrnoException) t).errno == OsConstants.ENOSPC) return true;
            String m = t.getMessage();
            if (m != null && (m.contains("ENOSPC") || m.contains("No space left"))) return true;
        }
        return false;
    }
}
