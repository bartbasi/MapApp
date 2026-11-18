// MapApp. Copyright 2026 Play, Inc.
// Free software under the GNU GPL v3 with additional terms: see LICENSE and NOTICE.

package io.github.bartbasi.mapapp.downloads;

import android.content.Context;
import android.os.PowerManager;
import android.util.Log;
import io.github.bartbasi.mapapp.archives.ArchiveCatalog;
import io.github.bartbasi.mapapp.archives.ArchiveIds;
import java.io.File;
import java.io.IOException;
import java.net.HttpURLConnection;
import java.util.ArrayList;
import java.util.Collections;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.CopyOnWriteArrayList;
import org.json.JSONException;
import org.json.JSONObject;

/**
 * The downloader behind the DownloadJobs part of src/downloads/contract.ts.
 * One per process. One area downloads at a time, on one worker thread, in the
 * order the areas were started; the others are queued.
 *
 * Everything that must outlive the process is on disk (AreaLayout): the job,
 * whether the user paused it or it failed, and each file's bytes and
 * checkpoint. So after the app is killed, opening it again lists every area as
 * it was and goes on from the checkpoints. An area the user paused stays paused.
 *
 * Lost connection: the area is "waiting" and goes on by itself when Android
 * reports a network again, with growing pauses between tries while the server
 * cannot be reached.
 */
public final class DownloadEngine {

    private static final String TAG = "MapAppDownloads";
    private static final long EMIT_INTERVAL_MS = 1000;
    /** Tries without a byte before an area shows as waiting. */
    private static final int FAILURES_BEFORE_WAITING = 3;
    private static final long MAX_BACKOFF_MS = 60_000;
    private static final long WAKE_LOCK_MS = 30 * 60 * 1000L;

    private static DownloadEngine instance;

    /** An area as the web app sees it (AreaState). */
    public static final class Snapshot {
        public final String id;
        public final String record;
        public final String status;
        public final String error;
        public final long bytesDone;
        public final long bytesTotal;
        /** The "name" in the record, for the notification only. May be empty. */
        public final String name;

        Snapshot(String id, String record, String status, String error, long bytesDone, long bytesTotal, String name) {
            this.id = id;
            this.record = record;
            this.status = status;
            this.error = error;
            this.bytesDone = bytesDone;
            this.bytesTotal = bytesTotal;
            this.name = name;
        }
    }

    public interface Listener {
        void changed(Snapshot area);
    }

    /** Told when there is work, so a foreground service runs, and when there is none. */
    interface ServiceHook {
        void busy();

        void idle();

        void progress(Snapshot area);
    }

    /** What is stored and known about one area. Guarded by {@link #lock}. */
    private static final class Area {
        final AreaJob job;
        final File dir;
        /** "active", "paused", "failed" or "complete". "active" covers queued, downloading and waiting. */
        String intent;
        String error;
        final long[] kept;
        boolean waiting;
        long lastEmit;

        Area(AreaJob job, File dir) {
            this.job = job;
            this.dir = dir;
            this.kept = new long[job.files.size()];
        }

        long done() {
            long d = 0;
            for (long k : kept) d += k;
            return d;
        }
    }

    private final Context context;
    private final File root;
    private final NetworkWatch network;
    private final Object lock = new Object();
    private final Map<String, Area> areas = new LinkedHashMap<>();
    private final CopyOnWriteArrayList<Listener> listeners = new CopyOnWriteArrayList<>();
    private final PowerManager.WakeLock wakeLock;
    private volatile ServiceHook service;

    private Thread worker;
    private String activeId;
    private boolean stopActive;
    /** Android stopped the service (its time limit): nothing runs until the app is opened. */
    private boolean suspended;
    private HttpURLConnection activeConnection;
    private long nextSeq;
    /** Counts user actions, so a wait between tries ends when the user asks to go on. */
    private int pokes;
    /** Counts network changes, so a wait between tries ends when a network comes or changes. */
    private int networkChanges;

    private DownloadEngine(Context context) {
        this.context = context;
        this.root = AreaLayout.root(context);
        this.network = NetworkWatch.get(context);
        PowerManager pm = (PowerManager) context.getSystemService(Context.POWER_SERVICE);
        wakeLock = pm.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "MapApp:download");
        wakeLock.setReferenceCounted(false);
        network.addListener(state -> {
            synchronized (lock) {
                networkChanges++;
                // No network: cut the open connection now rather than wait for a
                // read to time out. The worker then shows the area as waiting.
                if (!state.usable && activeConnection != null) cutActive();
                lock.notifyAll();
            }
        });
        load();
    }

    public static synchronized DownloadEngine get(Context context) {
        if (instance == null) instance = new DownloadEngine(context.getApplicationContext());
        return instance;
    }

    public File root() {
        return root;
    }

    public void addListener(Listener l) {
        listeners.add(l);
    }

    public void removeListener(Listener l) {
        listeners.remove(l);
    }

    void setService(ServiceHook hook) {
        service = hook;
    }

    // ------------------------------------------------------------ loading from disk

    private void load() {
        try {
            Files.mkdirs(root);
        } catch (IOException e) {
            Log.e(TAG, "cannot make " + root, e);
            return;
        }
        File[] dirs = root.listFiles();
        if (dirs == null) return;
        List<Area> found = new ArrayList<>();
        long maxSeq = 0;
        for (File d : dirs) {
            String name = d.getName();
            if (name.startsWith(AreaLayout.TRASH_PREFIX) || name.equals(AreaLayout.STAGING)) {
                // A delete that was cut short, or heads of a job that never started.
                Files.deleteTree(d);
                continue;
            }
            if (!d.isDirectory() || !ArchiveIds.isId(name)) continue;
            try {
                AreaJob job = AreaJob.fromJson(new JSONObject(Files.readText(new File(d, AreaLayout.JOB))), 0);
                if (!job.id.equals(name)) throw new JSONException("job names " + job.id);
                Area a = new Area(job, d);
                readIntent(a);
                for (int i = 0; i < job.files.size(); i++) a.kept[i] = FileDownloader.bytesKept(d, i, job.files.get(i));
                found.add(a);
                maxSeq = Math.max(maxSeq, job.seq);
            } catch (IOException | JSONException | IllegalArgumentException e) {
                // job.json is written before the area folder appears, so this is damage, not a half start.
                Log.w(TAG, "area " + name + " cannot be read; removed", e);
                Files.deleteTree(d);
            }
        }
        Collections.sort(found, Comparator.comparingLong(a -> a.job.seq));
        synchronized (lock) {
            for (Area a : found) areas.put(a.job.id, a);
            nextSeq = maxSeq + 1;
        }
        Log.i(TAG, "loaded " + found.size() + " areas from " + root);
    }

    private static void readIntent(Area a) {
        if (AreaLayout.isComplete(a.dir)) {
            a.intent = "complete";
            return;
        }
        a.intent = "active";
        File state = new File(a.dir, AreaLayout.STATE);
        if (!state.isFile()) return;
        try {
            JSONObject o = new JSONObject(Files.readText(state));
            String s = o.optString("status", "active");
            if (s.equals("paused") || s.equals("failed")) {
                a.intent = s;
                a.error = s.equals("failed") ? o.optString("error", "other") : null;
            }
        } catch (IOException | JSONException e) {
            Log.w(TAG, "state of " + a.job.id + " unreadable; treated as active", e);
        }
    }

    private static void writeIntent(Area a) {
        File state = new File(a.dir, AreaLayout.STATE);
        try {
            if (a.intent.equals("active") || a.intent.equals("complete")) {
                state.delete();
                return;
            }
            JSONObject o = new JSONObject();
            o.put("status", a.intent);
            if (a.error != null) o.put("error", a.error);
            Files.writeTextAtomically(state, o.toString());
        } catch (IOException | JSONException e) {
            Log.w(TAG, "could not save the state of " + a.job.id, e);
        }
    }

    // ------------------------------------------------------------ the web app's calls

    /** The folder where heads are put before {@link #start}. */
    File stagingFor(String id) {
        return AreaLayout.staging(root, id);
    }

    /**
     * Stores a job and starts or queues it. The heads must already be in the
     * staging folder. The area folder appears in one rename, with its job inside.
     */
    public void start(JSONObject jobJson) throws JSONException, IOException {
        long seq;
        synchronized (lock) {
            seq = Math.max(nextSeq, System.currentTimeMillis());
            nextSeq = seq + 1;
        }
        AreaJob job = AreaJob.fromJson(jobJson, seq);
        job = new AreaJob(job.id, job.record, seq, job.files);
        File staging = stagingFor(job.id);
        Files.mkdirs(staging);
        for (int i = 0; i < job.files.size(); i++) {
            long want = job.files.get(i).plan.headBytes;
            File head = AreaLayout.head(staging, i);
            long have = head.isFile() ? head.length() : 0;
            if (have != want) throw new IllegalArgumentException("file " + i + ": " + have + " head bytes received, the job says " + want);
            if (want == 0) head.delete();
        }
        File dir = new File(root, job.id);
        synchronized (lock) {
            if (areas.containsKey(job.id) || dir.exists()) throw new IllegalArgumentException("an area " + job.id + " already exists");
            Files.writeTextAtomically(new File(staging, AreaLayout.JOB), job.toJson().toString());
            if (!staging.renameTo(dir)) throw new IOException("could not move the job into place");
            Area a = new Area(job, dir);
            a.intent = "active";
            areas.put(job.id, a);
            Log.i(TAG, "area " + job.id + " stored: " + job.files.size() + " files, " + job.totalBytes() + " bytes");
        }
        emitNow(job.id);
        ensureRunning();
    }

    public void pause(String id) {
        synchronized (lock) {
            Area a = need(id);
            if (!a.intent.equals("active")) return;
            a.intent = "paused";
            a.waiting = false;
            writeIntent(a);
            if (id.equals(activeId)) cutActive();
            lock.notifyAll();
        }
        emitNow(id);
    }

    public void resume(String id) {
        synchronized (lock) {
            Area a = need(id);
            if (a.intent.equals("paused") || a.intent.equals("failed")) {
                a.intent = "active";
                a.error = null;
                writeIntent(a);
            }
            suspended = false;
            pokes++;
            lock.notifyAll();
        }
        emitNow(id);
        ensureRunning();
    }

    /** True while some area should be downloading. */
    boolean hasWork() {
        synchronized (lock) {
            return !suspended && firstActive() != null;
        }
    }

    /** Deletes an area in any state with every file it has. Waits until the worker has let go of it. */
    public void remove(String id) throws InterruptedException {
        if (!ArchiveIds.isId(id)) throw new IllegalArgumentException("bad area ID");
        Area a;
        synchronized (lock) {
            a = areas.remove(id);
            if (id.equals(activeId)) {
                cutActive();
                lock.notifyAll();
                long until = System.currentTimeMillis() + 15_000;
                while (id.equals(activeId) && System.currentTimeMillis() < until) lock.wait(500);
            }
        }
        Files.deleteTree(stagingFor(id));
        File dir = a != null ? a.dir : new File(root, id);
        if (dir.exists()) {
            // One rename takes the area off every list at once; the slow delete follows.
            File trash = new File(root, AreaLayout.TRASH_PREFIX + id + "-" + System.nanoTime());
            File gone = dir.renameTo(trash) ? trash : dir;
            if (a != null && a.intent.equals("complete")) ArchiveCatalog.get(context).refresh();
            Files.deleteTree(gone);
        }
        Log.i(TAG, "area " + id + " removed");
    }

    public List<Snapshot> list() {
        List<Snapshot> out = new ArrayList<>();
        synchronized (lock) {
            for (Area a : areas.values()) out.add(snapshot(a));
        }
        return out;
    }

    public long freeBytes() {
        try {
            Files.mkdirs(root);
        } catch (IOException ignored) {
            // Measured on the parent then.
        }
        File where = root.isDirectory() ? root : root.getParentFile();
        return new android.os.StatFs(where.getPath()).getAvailableBytes();
    }

    /** The app came to the screen: go on with anything Android stopped. */
    public void appVisible() {
        boolean wake;
        synchronized (lock) {
            wake = suspended;
            suspended = false;
        }
        if (wake) Log.i(TAG, "app visible again: going on after Android's time limit");
        ensureRunning();
    }

    /** Android's time limit for the service ran out: stop now, go on when the app is opened. */
    void suspend() {
        synchronized (lock) {
            suspended = true;
            cutActive();
            lock.notifyAll();
        }
    }

    // ------------------------------------------------------------ the worker

    /** Starts the foreground service and the worker if there is something to do. */
    public void ensureRunning() {
        boolean work;
        synchronized (lock) {
            work = !suspended && firstActive() != null;
            if (work && worker == null) {
                worker = new Thread(this::work, "MapApp-download");
                worker.start();
            }
        }
        if (work) DownloadService.start(context);
    }

    private Area firstActive() {
        for (Area a : areas.values()) if (a.intent.equals("active")) return a;
        return null;
    }

    private void cutActive() {
        stopActive = true;
        HttpURLConnection c = activeConnection;
        if (c != null) {
            // Disconnecting from another thread makes the worker's read fail at once.
            new Thread(c::disconnect, "MapApp-cut").start();
        }
    }

    private void work() {
        int failures = 0;
        String lastId = null;
        while (true) {
            Area a;
            synchronized (lock) {
                a = suspended ? null : firstActive();
                if (a == null) {
                    activeId = null;
                    worker = null;
                    lock.notifyAll();
                    break;
                }
                activeId = a.job.id;
                stopActive = false;
                lock.notifyAll();
                if (!a.job.id.equals(lastId)) failures = 0;
                lastId = a.job.id;
                if (!network.state().usable) {
                    a.waiting = true;
                }
            }
            if (!network.state().usable) {
                emitNow(a.job.id);
                waitFor(MAX_BACKOFF_MS, a);
                continue;
            }
            emitNow(a.job.id);
            wakeLock.acquire(WAKE_LOCK_MS);
            try {
                runArea(a);
                failures = 0;
            } catch (DownloadProblem p) {
                switch (p.kind) {
                    case STOPPED:
                        break;
                    case FAILED:
                        Log.w(TAG, "area " + a.job.id + " failed (" + p.error + "): " + p.getMessage());
                        synchronized (lock) {
                            if (areas.get(a.job.id) == a && a.intent.equals("active")) {
                                a.intent = "failed";
                                a.error = p.error;
                                a.waiting = false;
                                writeIntent(a);
                            }
                        }
                        emitNow(a.job.id);
                        break;
                    case TRANSIENT:
                        failures = p.madeProgress ? 1 : failures + 1;
                        long delay = Math.min(MAX_BACKOFF_MS, 1000L << Math.min(6, failures - 1));
                        Log.i(TAG, "area " + a.job.id + ": " + p.getMessage() + "; try " + failures + ", again in " + delay + " ms");
                        boolean show;
                        synchronized (lock) {
                            show = !a.waiting && (failures >= FAILURES_BEFORE_WAITING || !network.state().usable);
                            if (show) a.waiting = true;
                        }
                        if (show) emitNow(a.job.id);
                        wakeLock.release();
                        waitFor(delay, a);
                        break;
                }
            } finally {
                wakeLock.release();
            }
        }
        ServiceHook s = service;
        if (s != null) s.idle();
    }

    /**
     * Sleeps up to {@code ms}, or until Android reports any change of network,
     * the user acts, or the area is no longer the one to download.
     */
    private void waitFor(long ms, Area a) {
        synchronized (lock) {
            long until = System.currentTimeMillis() + ms;
            int pokesBefore = pokes;
            int networkBefore = networkChanges;
            while (pokes == pokesBefore && networkChanges == networkBefore && !stopActive && !suspended && areas.get(a.job.id) == a && a.intent.equals("active")) {
                long left = until - System.currentTimeMillis();
                if (left <= 0) break;
                try {
                    lock.wait(left);
                } catch (InterruptedException e) {
                    Thread.currentThread().interrupt();
                    return;
                }
            }
        }
    }

    private void runArea(Area a) throws DownloadProblem {
        List<AreaJob.FileSpec> files = a.job.files;
        for (int i = 0; i < files.size(); i++) {
            final int index = i;
            AreaJob.FileSpec spec = files.get(i);
            if (FileDownloader.isDone(a.dir, spec)) {
                a.kept[i] = spec.bytes();
                continue;
            }
            new FileDownloader(a.dir, i, spec, new FileDownloader.Control() {
                @Override
                public void progress(long position) {
                    boolean statusChanged;
                    synchronized (lock) {
                        statusChanged = a.waiting && position > a.kept[index];
                        a.kept[index] = position;
                        if (statusChanged) a.waiting = false;
                    }
                    if (statusChanged) emitNow(a.job.id);
                    else emitSoon(a);
                }

                @Override
                public boolean stopRequested() {
                    synchronized (lock) {
                        return stopActive || suspended;
                    }
                }

                @Override
                public void connection(HttpURLConnection c) {
                    synchronized (lock) {
                        activeConnection = c;
                        if (c != null && stopActive) cutActive();
                    }
                }
            }).run();
            a.kept[i] = spec.bytes();
        }
        // Every file is in place. One more file makes the area visible to the map.
        try {
            Files.writeAtomically(new File(a.dir, AreaLayout.COMPLETE), new byte[0]);
        } catch (IOException e) {
            throw DownloadProblem.failed(FileDownloader.isNoSpace(e) ? "no-space" : "other", "could not mark the area complete: " + e);
        }
        synchronized (lock) {
            a.intent = "complete";
            a.waiting = false;
            writeIntent(a);
        }
        for (int i = 0; i < files.size(); i++) AreaLayout.head(a.dir, i).delete();
        Log.i(TAG, "area " + a.job.id + " complete, " + a.done() + " bytes");
        ArchiveCatalog.get(context).refresh();
        emitNow(a.job.id);
    }

    // ------------------------------------------------------------ events

    private Area need(String id) {
        Area a = areas.get(id);
        if (a == null) throw new IllegalArgumentException("no area " + id);
        return a;
    }

    private Snapshot snapshot(Area a) {
        String status;
        switch (a.intent) {
            case "complete":
            case "paused":
            case "failed":
                status = a.intent;
                break;
            default:
                if (suspended) status = "waiting";
                else if (a.job.id.equals(activeId)) status = a.waiting ? "waiting" : "downloading";
                else status = "queued";
        }
        String name = "";
        try {
            name = new JSONObject(a.job.record).optString("name", "");
        } catch (JSONException ignored) {
            // The record is the web app's; the notification does without a name.
        }
        return new Snapshot(a.job.id, a.job.record, status, a.intent.equals("failed") ? a.error : null, a.done(), a.job.totalBytes(), name);
    }

    private void emitSoon(Area a) {
        long now = System.currentTimeMillis();
        synchronized (lock) {
            if (now - a.lastEmit < EMIT_INTERVAL_MS) return;
        }
        emitNow(a.job.id);
    }

    private void emitNow(String id) {
        Snapshot s;
        synchronized (lock) {
            Area a = areas.get(id);
            if (a == null) return;
            a.lastEmit = System.currentTimeMillis();
            s = snapshot(a);
        }
        for (Listener l : listeners) {
            try {
                l.changed(s);
            } catch (RuntimeException e) {
                Log.w(TAG, "listener failed", e);
            }
        }
        ServiceHook hook = service;
        if (hook != null) hook.progress(s);
    }
}
