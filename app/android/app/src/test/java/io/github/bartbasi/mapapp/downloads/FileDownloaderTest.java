// MapApp. Copyright 2026 Play, Inc.
// Free software under the GNU GPL v3 with additional terms: see LICENSE and NOTICE.

package io.github.bartbasi.mapapp.downloads;

import static org.junit.Assert.assertArrayEquals;
import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertTrue;
import static org.junit.Assert.fail;

import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.net.HttpURLConnection;
import java.security.MessageDigest;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Random;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import org.junit.After;
import org.junit.Before;
import org.junit.Rule;
import org.junit.Test;
import org.junit.rules.TemporaryFolder;

/**
 * One file written from a head and byte ranges, against a small HTTP server on
 * the laptop that behaves like a release host: a redirect to a signed address
 * that runs out, cut connections, a server that ignores ranges, a file that
 * changes. Every finished file must equal the reference: the head, then each
 * range in order (src/downloads/assemble.ts).
 */
public class FileDownloaderTest {

    @Rule
    public TemporaryFolder tmp = new TemporaryFolder();

    private static final byte[] HOSTED = new byte[300_000];
    private static final byte[] HEAD = new byte[4_321];

    static {
        new Random(7).nextBytes(HOSTED);
        new Random(8).nextBytes(HEAD);
    }

    private static final long[] RANGES = { 1_000, 50_000, 60_000, 7, 100_000, 150_000, 299_000, 1_000 };

    private TinyHttpServer server;
    private String base;
    private final List<String> log = Collections.synchronizedList(new ArrayList<>());
    private volatile String etag = "\"v1\"";
    private volatile boolean ignoreRange;
    /** Cut the answer after this many bytes, for the next {@link #cuts} answers. */
    private volatile int cutAfter = -1;
    private final AtomicInteger cuts = new AtomicInteger();
    /** A signed address works for this many requests. */
    private volatile int signedUses = Integer.MAX_VALUE;
    /** What a signed address answers once it has run out. */
    private volatile int expiredStatus = 403;
    /** What the original address answers instead of redirecting, when not 0. */
    private volatile int originalStatus = 0;
    private final AtomicInteger tokens = new AtomicInteger();
    private final java.util.Map<Integer, AtomicInteger> tokenUses = new java.util.concurrent.ConcurrentHashMap<>();

    @Before
    public void startServer() throws IOException {
        server = new TinyHttpServer(this::handle);
        base = "http://127.0.0.1:" + server.port();
    }

    @After
    public void stopServer() {
        server.close();
    }

    private TinyHttpServer.Response handle(TinyHttpServer.Request req) {
        String path = req.path;
        String range = req.header("Range");
        TinyHttpServer.Response r = new TinyHttpServer.Response();
        if (path.equals("/dl/hosted.pmtiles")) {
            if (originalStatus != 0) {
                log.add(originalStatus + " original " + range);
                return r.status(originalStatus);
            }
            int t = tokens.incrementAndGet();
            tokenUses.put(t, new AtomicInteger());
            log.add("302 " + range);
            return r.status(302).header("Location", "/signed/" + t + "/hosted.pmtiles");
        }
        Matcher signed = Pattern.compile("^/signed/([0-9]+)/hosted[.]pmtiles$").matcher(path);
        if (signed.matches()) {
            AtomicInteger uses = tokenUses.get(Integer.parseInt(signed.group(1)));
            if (uses == null || uses.incrementAndGet() > signedUses) {
                log.add(expiredStatus + " " + range);
                return r.status(expiredStatus);
            }
        } else if (!path.equals("/hosted.pmtiles")) {
            return r.status(404);
        }
        r.header("ETag", etag);
        Matcher m = range == null ? null : Pattern.compile("^bytes=([0-9]+)-([0-9]+)$").matcher(range);
        if (ignoreRange || m == null || !m.matches()) {
            log.add("200 " + range);
            return r.status(200).body(HOSTED, 0, HOSTED.length);
        }
        int first = Integer.parseInt(m.group(1));
        int last = Math.min(Integer.parseInt(m.group(2)), HOSTED.length - 1);
        int len = last - first + 1;
        r.status(206).header("Content-Range", "bytes " + first + "-" + last + "/" + HOSTED.length).body(HOSTED, first, len);
        if (cutAfter >= 0 && cutAfter < len && cuts.getAndDecrement() > 0) {
            log.add("206 " + range + " CUT");
            r.cutAfter = cutAfter;
            return r;
        }
        log.add("206 " + range);
        return r;
    }

    private byte[] reference() {
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        out.write(HEAD, 0, HEAD.length);
        for (int i = 0; i < RANGES.length; i += 2) out.write(HOSTED, (int) RANGES[i], (int) RANGES[i + 1]);
        return out.toByteArray();
    }

    private long refBytes() {
        long t = HEAD.length;
        for (int i = 1; i < RANGES.length; i += 2) t += RANGES[i];
        return t;
    }

    private File areaWithHead() throws IOException {
        File dir = tmp.newFolder("area");
        try (FileOutputStream out = new FileOutputStream(AreaLayout.head(dir, 0))) {
            out.write(HEAD);
        }
        return dir;
    }

    private AreaJob.FileSpec spec(String url, String jobEtag, String sha256) {
        return new AreaJob.FileSpec("il-macon", "aerial", url, jobEtag, HEAD.length, RANGES, refBytes(), sha256, "{\"layer\":\"aerial\"}");
    }

    /** A control that stops the download once the file has {@code stopAt} bytes. */
    private static final class TestControl implements FileDownloader.Control {
        final long stopAt;
        long last;

        TestControl(long stopAt) {
            this.stopAt = stopAt;
        }

        @Override
        public void progress(long position) {
            last = position;
        }

        @Override
        public boolean stopRequested() {
            return last >= stopAt;
        }

        @Override
        public void connection(HttpURLConnection connection) {}
    }

    private FileDownloader downloader(File dir, AreaJob.FileSpec spec, long stopAt) {
        FileDownloader d = new FileDownloader(dir, 0, spec, new TestControl(stopAt));
        d.requestBytes = 32_000;
        return d;
    }

    private void assertFinished(File dir) throws IOException {
        File archive = AreaLayout.archive(dir, "il-macon", "aerial");
        assertTrue("archive in place", archive.isFile());
        assertArrayEquals(reference(), Files.readAll(archive));
        assertEquals("{\"layer\":\"aerial\"}", Files.readText(AreaLayout.meta(dir, "il-macon", "aerial")));
        assertFalse(AreaLayout.part(dir, 0).exists());
        assertFalse(AreaLayout.checkpoint(dir, 0).exists());
        assertFalse(AreaLayout.head(dir, 0).exists());
    }

    @Test
    public void anExtractFinishesByteForByte() throws Exception {
        File dir = areaWithHead();
        downloader(dir, spec(base + "/dl/hosted.pmtiles", "\"v1\"", null), Long.MAX_VALUE).run();
        assertFinished(dir);
        // The redirect is followed once and the signed address reused.
        assertEquals(1, tokens.get());
    }

    @Test
    public void stoppedAtAnyByteItGoesOnFromTheCheckpoint() throws Exception {
        File dir = areaWithHead();
        AreaJob.FileSpec spec = spec(base + "/hosted.pmtiles", null, null);
        long[] stops = { 10, HEAD.length + 3, 70_123, 140_000, 200_001 };
        for (long stop : stops) {
            try {
                downloader(dir, spec, stop).run();
                fail("should have stopped at " + stop);
            } catch (DownloadProblem p) {
                assertEquals(DownloadProblem.Kind.STOPPED, p.kind);
            }
            long ckpt = Checkpoint.read(AreaLayout.checkpoint(dir, 0));
            assertTrue("checkpoint " + ckpt + " at or past " + Math.min(stop, HEAD.length), ckpt >= Math.min(stop, HEAD.length));
            // A kill can leave bytes after the checkpoint: they must not survive.
            try (FileOutputStream out = new FileOutputStream(AreaLayout.part(dir, 0), true)) {
                out.write(new byte[] { 1, 2, 3, 4, 5 });
            }
        }
        log.clear();
        downloader(dir, spec, Long.MAX_VALUE).run();
        assertFinished(dir);
        // The last run did not start over: its first request is past byte 199,000 of the hosted file.
        Matcher m = Pattern.compile("bytes=(\\d+)-").matcher(log.get(0));
        assertTrue(log.get(0), m.find());
        assertTrue(log.get(0), Long.parseLong(m.group(1)) > 199_000);
    }

    @Test
    public void cutConnectionsKeepWhatArrived() throws Exception {
        File dir = areaWithHead();
        AreaJob.FileSpec spec = spec(base + "/dl/hosted.pmtiles", "\"v1\"", null);
        cutAfter = 5_000;
        cuts.set(12);
        int transient_ = 0;
        while (true) {
            try {
                downloader(dir, spec, Long.MAX_VALUE).run();
                break;
            } catch (DownloadProblem p) {
                assertEquals(p.getMessage(), DownloadProblem.Kind.TRANSIENT, p.kind);
                assertTrue(p.madeProgress);
                transient_++;
                assertTrue("too many tries", transient_ < 50);
            }
        }
        assertEquals(12, transient_);
        assertFinished(dir);
    }

    @Test
    public void anExpiredSignedAddressIsRenewed() throws Exception {
        File dir = areaWithHead();
        signedUses = 2;
        downloader(dir, spec(base + "/dl/hosted.pmtiles", "\"v1\"", null), Long.MAX_VALUE).run();
        assertFinished(dir);
        assertTrue("renewed " + tokens.get() + " times", tokens.get() > 3);
        long expired = log.stream().filter(l -> l.startsWith("403 ")).count();
        assertEquals("every renewal followed a 403", tokens.get() - 1, expired);
    }

    @Test
    public void aSignedAddressAnswering404Or400WhenItRunsOutIsRenewed() throws Exception {
        for (int status : new int[] { 404, 400, 410 }) {
            File dir = tmp.newFolder("expired-" + status);
            try (java.io.FileOutputStream out = new java.io.FileOutputStream(AreaLayout.head(dir, 0))) {
                out.write(HEAD);
            }
            log.clear();
            tokens.set(0);
            signedUses = 2;
            expiredStatus = status;
            downloader(dir, spec(base + "/dl/hosted.pmtiles", "\"v1\"", null), Long.MAX_VALUE).run();
            assertFinished(dir);
            long expired = log.stream().filter(l -> l.startsWith(status + " ")).count();
            assertTrue(status + ": renewed " + expired + " times", expired > 2);
            assertEquals(status + ": every expiry was followed by a fresh redirect", tokens.get() - 1, expired);
        }
    }

    @Test
    public void theOriginalAddressDecides() throws Exception {
        File dir = areaWithHead();
        signedUses = 1;
        expiredStatus = 404;
        AreaJob.FileSpec s = spec(base + "/dl/hosted.pmtiles", "\"v1\"", null);
        FileDownloader d = downloader(dir, s, Long.MAX_VALUE);
        // The first request works through a fresh signed address; the next finds it run out,
        // goes back to the original, which now answers 404 itself: a server error, not a loop.
        originalStatusAfterFirst(d);
    }

    private void originalStatusAfterFirst(FileDownloader d) {
        Thread flip = new Thread(() -> {
            while (tokens.get() < 1) Thread.yield();
            originalStatus = 404;
        });
        flip.start();
        try {
            d.run();
            fail("the original address's 404 must fail the file");
        } catch (DownloadProblem p) {
            assertEquals(DownloadProblem.Kind.FAILED, p.kind);
            assertEquals("server", p.error);
        }
        assertTrue(log.toString(), log.stream().anyMatch(l -> l.startsWith("404 original")));
        assertEquals(log.toString(), 1, log.stream().filter(l -> l.startsWith("404 original")).count());
    }

    @Test
    public void plainHttpRefusedByTheBuildFailsAtOnceWithoutARequest() throws Exception {
        File dir = areaWithHead();
        Http.cleartext = host -> false;
        try {
            downloader(dir, spec(base + "/hosted.pmtiles", null, null), Long.MAX_VALUE).run();
            fail("must fail");
        } catch (DownloadProblem p) {
            assertEquals(DownloadProblem.Kind.FAILED, p.kind);
            assertEquals("server", p.error);
        } finally {
            Http.cleartext = Http.BUILD_POLICY;
        }
        assertEquals("no request was made", 0, log.size());
    }

    @Test
    public void httpsIsNeverRefusedByTheCleartextRule() {
        Http.cleartext = host -> false;
        try {
            Http.get("https://127.0.0.1:1/x", 0, 10, null);
            fail("https to a closed port should not succeed");
        } catch (Http.BadAddress e) {
            fail("https was refused as a bad address: " + e.getMessage());
        } catch (java.io.IOException expected) {
            // a connection error, as it should be
        } finally {
            Http.cleartext = Http.BUILD_POLICY;
        }
    }

    @Test
    public void aServerThatIgnoresRangesIsNeverAppended() throws Exception {
        File dir = areaWithHead();
        ignoreRange = true;
        try {
            downloader(dir, spec(base + "/hosted.pmtiles", null, null), Long.MAX_VALUE).run();
            fail("a 200 must fail");
        } catch (DownloadProblem p) {
            assertEquals(DownloadProblem.Kind.FAILED, p.kind);
            assertEquals("server", p.error);
        }
        assertEquals(HEAD.length, AreaLayout.part(dir, 0).length());
    }

    @Test
    public void anotherEtagFailsWithChanged() throws Exception {
        File dir = areaWithHead();
        AreaJob.FileSpec spec = spec(base + "/hosted.pmtiles", "\"v1\"", null);
        try {
            downloader(dir, spec, 90_000).run();
            fail();
        } catch (DownloadProblem p) {
            assertEquals(DownloadProblem.Kind.STOPPED, p.kind);
        }
        etag = "\"v2\"";
        try {
            downloader(dir, spec, Long.MAX_VALUE).run();
            fail("a new ETag must fail");
        } catch (DownloadProblem p) {
            assertEquals(DownloadProblem.Kind.FAILED, p.kind);
            assertEquals("changed", p.error);
        }
    }

    @Test
    public void aWholeFileIsCheckedAgainstItsChecksum() throws Exception {
        File dir = tmp.newFolder("whole");
        String sha = hex(MessageDigest.getInstance("SHA-256").digest(HOSTED));
        AreaJob.FileSpec whole = new AreaJob.FileSpec("il-macon", "basemap", base + "/dl/hosted.pmtiles", null, 0, new long[] { 0, HOSTED.length }, HOSTED.length, sha, "{}");
        FileDownloader d = new FileDownloader(dir, 0, whole, new TestControl(Long.MAX_VALUE));
        d.requestBytes = 64_000;
        d.run();
        assertArrayEquals(HOSTED, Files.readAll(AreaLayout.archive(dir, "il-macon", "basemap")));

        File bad = tmp.newFolder("bad");
        AreaJob.FileSpec wrong = new AreaJob.FileSpec("il-macon", "basemap", base + "/hosted.pmtiles", null, 0, new long[] { 0, HOSTED.length }, HOSTED.length, sha.replace('a', 'b').replace('0', '1'), "{}");
        try {
            new FileDownloader(bad, 0, wrong, new TestControl(Long.MAX_VALUE)).run();
            fail("a wrong checksum must fail");
        } catch (DownloadProblem p) {
            assertEquals("corrupt", p.error);
        }
        assertFalse(AreaLayout.archive(bad, "il-macon", "basemap").exists());
        assertFalse("a corrupt file starts again from nothing", AreaLayout.part(bad, 0).exists());
    }

    @Test
    public void aMissingFileFailsWithServer() throws Exception {
        File dir = areaWithHead();
        try {
            downloader(dir, spec(base + "/gone.pmtiles", null, null), Long.MAX_VALUE).run();
            fail();
        } catch (DownloadProblem p) {
            assertEquals("server", p.error);
        }
    }

    @Test
    public void anUnreachableServerIsTransient() throws Exception {
        File dir = areaWithHead();
        server.close();
        try {
            downloader(dir, spec(base + "/hosted.pmtiles", null, null), Long.MAX_VALUE).run();
            fail();
        } catch (DownloadProblem p) {
            assertEquals(DownloadProblem.Kind.TRANSIENT, p.kind);
        }
        // The head is written and kept.
        assertEquals(HEAD.length, Checkpoint.read(AreaLayout.checkpoint(dir, 0)));
    }

    private static String hex(byte[] b) {
        StringBuilder sb = new StringBuilder();
        for (byte x : b) sb.append(String.format("%02x", x));
        return sb.toString();
    }
}
