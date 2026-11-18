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
 * Everything that must outlive the process is on disk (AreaLayout): the job
 * (with whether it may use mobile data), whether the user paused it or it
 * failed, and each file's bytes and checkpoint. So after the app is killed,
 * opening it again lists every area as it was and goes on from the checkpoints.
 * An area the user paused stays paused.
 *
 * Which area runs, and what each shows, is {@link Schedule}'s rule: no
 * connection, the first area waits for a connection; a connection charged by
 * use, an area not allowed it waits for "unmetered" and an allowed one behind
 * it goes ahead. A change of network that forbids the running area cuts its
 * open request at once.
 *
 * Removing an area always wins over the worker ({@link AreaGuard}). The CPU
 * wake lock is held only while bytes move ({@link WakeLease}).
 */
public final class DownloadEngine {

    private static final String TAG = "MapAppDownloads";
    private static final long EMIT_INTERVAL_MS = 1000;
    /** Tries without a byte before an area shows as waiting. */
    private static final int FAILURES_BEFORE_WAITING = 3;
    private static final long MAX_BACKOFF_MS = 60_000;

    private static DownloadEngine instance;

    /** An area as the web app sees it (AreaState). */
    public static final class Snapshot {
        public final String id;
        public final String record;
        public final String status;
        public final String error;
        /** With status "waiting": "connection" or "unmetered". Otherwise null. */
        public final String waitingFor;
        public final boolean allowMetered;
        public final long bytesDone;
        public final long bytesTotal;
        /** The "name" in the record, for the notification only. May be empty. */
        public final String name;

        Snapshot(String id, String record, String status, String error, String waitingFor, boolean allowMetered, long bytesDone, long bytesTotal, String name) {
            this.id = id;
            this.record = record;
            this.status = status;
            this.error = error;
            this.waitingFor = waitingFor;
            this.allowMetered = allowMetered;
            this.bytesDone = bytesDone;
            this.bytesTotal = bytesTotal;
            this.name = name;
        }

        /** What a change event is sent for, besides progress. */
        String key() {
            return status + "|" + waitingFor + "|" + allowMetered + "|" + error;
        }
    }

    public interface Listener {
        void changed(Snapshot area);
    }

    /** The foreground service: told the area to show, and when there is no work. */
    interface ServiceHook {
        void idle();

        void progress(Snapshot area);
    }

    /** What is stored and known about one area. Guarded by {@link #lock}. */
    private static final class Area {
        final String id;
        final File dir;
        /** Null for a complete area whose job.json cannot be read. */
        AreaJob job;
        /** "active", "paused", "failed" or "complete". "active" covers queued, downloading and waiting. */
        String intent;
        String error;
        boolean allowMetered;
        final long[] kept;
        final long total;
        /** The worker's tries fail while the network is up (server not reached). */
        boolean waiting;
        long lastEmit;
        String lastKey;
        final AreaGuard guard = new AreaGuard();

        Area(String id, File dir, AreaJob job, long unreadableBytes) {
            this.id = id;
            this.dir = dir;
            this.job = job;
            if (job != null) {
                kept = new long[job.files.size()];
                total = job.totalBytes();
                allowMetered = job.allowMetered;
            } else {
                kept = new long[] { unreadableBytes };
                total = unreadableBytes;
            }
        }

        long seq() {
            return job == null ? Long.MIN_VALUE : job.seq;
        }

        String record() {
            return job == null ? "" : job.record;
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
    private final WakeLease wake;
    private volatile ServiceHook service;

    private Thread worker;
    private String activeId;
    private boolean stopActive;
    /** Android stopped the service (its time limit): nothing runs until the app is opened. */
    private boolean suspended;
    private HttpURLConnection activeConnection;
    private long nextSeq;
    /** Counts the web app's calls, so a wait ends when the user acts. */
    private int pokes;
    /** Counts network changes, so a wait ends when a network comes or changes. */
    private int networkChanges;

    private DownloadEngine(Context context) {
        this.context = context;
        this.root = AreaLayout.root(context);
        this.network = NetworkWatch.get(context);
        PowerManager pm = (PowerManager) context.getSystemService(Context.POWER_SERVICE);
        PowerManager.WakeLock wl = pm.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "MapApp:download");
        wl.setReferenceCounted(false);
        wake = new WakeLease(new WakeLease.Lock() {
            @Override
            public void acquire(long timeoutMs) {
                wl.acquire(timeoutMs);
                Log.i(TAG, "wake lock taken for " + timeoutMs / 1000 + " s");
            }

            @Override
            public void release() {
                wl.release();
                Log.i(TAG, "wake lock let go");
            }
        }, System::currentTimeMillis);
        network.addListener(this::networkChanged);
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
        AreaScan.Result scan = AreaScan.scan(root);
        long maxSeq = 0;
        synchronized (lock) {
            for (AreaScan.Found f : scan.areas) {
                Area a = new Area(f.id, f.dir, f.job, f.archiveBytes);
                a.intent = f.intent;
                a.error = f.error;
                if (f.job != null) {
                    for (int i = 0; i < f.job.files.size(); i++) a.kept[i] = FileDownloader.bytesKept(f.dir, i, f.job.files.get(i));
                    maxSeq = Math.max(maxSeq, f.job.seq);
                } else {
                    Log.w(TAG, "area " + f.id + " is complete but its job cannot be read; kept, with an empty record");
                }
                areas.put(f.id, a);
            }
            nextSeq = maxSeq + 1;
        }
        for (String id : scan.deleted) Log.w(TAG, "area " + id + " was incomplete and its job cannot be read; deleted");
        // Only complete areas are listed as archives, so these deletions change
        // nothing there; refreshing makes sure the list is read after the scan.
        if (!scan.deleted.isEmpty()) ArchiveCatalog.get(context).refresh();
        Log.i(TAG, "loaded " + scan.areas.size() + " areas from " + root);
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
            Log.w(TAG, "could not save the state of " + a.id, e);
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
        AreaJob job = AreaJob.fromJson(jobJson, seq).withSeq(seq);
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
            Area a = new Area(job.id, dir, job, 0);
            a.intent = "active";
            areas.put(job.id, a);
            pokes++;
            lock.notifyAll();
            Log.i(TAG, "area " + job.id + " stored: " + job.files.size() + " files, " + job.totalBytes() + " bytes, mobile data " + (job.allowMetered ? "allowed" : "not allowed"));
        }
        emitNow(job.id);
        emitChanges();
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
            pokes++;
            lock.notifyAll();
        }
        emitChanges();
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
        emitChanges();
        ensureRunning();
    }

    /**
     * Changes and stores whether an area may use a connection charged by use.
     * Allowing it lets an area that waits for "unmetered" go on at once.
     * Withdrawing it while the area downloads over such a connection cuts the
     * open request and makes it wait.
     */
    public void setAllowMetered(String id, boolean allow) {
        synchronized (lock) {
            Area a = need(id);
            if (a.allowMetered != allow) {
                a.allowMetered = allow;
                if (a.job != null) {
                    a.job = a.job.withAllowMetered(allow);
                    try {
                        Files.writeTextAtomically(new File(a.dir, AreaLayout.JOB), a.job.toJson().toString());
                    } catch (IOException | JSONException e) {
                        Log.w(TAG, "could not store the mobile data choice of " + id, e);
                    }
                }
                Log.i(TAG, "area " + id + ": mobile data " + (allow ? "allowed" : "not allowed"));
            }
            NetworkWatch.State net = network.state();
            if (id.equals(activeId) && !Schedule.mayFetch(a.allowMetered, net.usable, net.metered)) cutActive();
            pokes++;
            lock.notifyAll();
        }
        emitChanges();
        ensureRunning();
    }

    /** True while some area should be downloading or waits to. */
    boolean hasWork() {
        synchronized (lock) {
            return !suspended && firstActive() != null;
        }
    }

    /**
     * Deletes an area in any state with every file it has. When this returns,
     * no file of the area exists and none can appear: the worker is out of the
     * area and will never enter it again (AreaGuard).
     */
    public void remove(String id) throws InterruptedException {
        if (!ArchiveIds.isId(id)) throw new IllegalArgumentException("bad area ID");
        Area a;
        synchronized (lock) {
            a = areas.remove(id);
            if (a != null) a.guard.markRemoved();
            if (id.equals(activeId)) cutActive();
            pokes++;
            lock.notifyAll();
        }
        // Outside the engine's lock: the worker needs it to get out.
        if (a != null) a.guard.awaitOut();
        Files.deleteTree(stagingFor(id));
        File dir = a != null ? a.dir : new File(root, id);
        if (dir.exists()) {
            // One rename takes the area off every list at once; the slow delete follows.
            File trash = new File(root, AreaLayout.TRASH_PREFIX + id + "-" + System.nanoTime());
            File gone = dir.renameTo(trash) ? trash : dir;
            ArchiveCatalog.get(context).refresh();
            Files.deleteTree(gone);
        }
        Log.i(TAG, "area " + id + " removed");
        emitChanges();
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
        boolean wakeUp;
        synchronized (lock) {
            wakeUp = suspended;
            suspended = false;
            if (wakeUp) {
                pokes++;
                lock.notifyAll();
            }
        }
        if (wakeUp) Log.i(TAG, "app visible again: going on after Android's time limit");
        emitChanges();
        ensureRunning();
    }

    /** Android's time limit for the service ran out: stop now, go on when the app is opened. */
    void suspend() {
        synchronized (lock) {
            suspended = true;
            cutActive();
            lock.notifyAll();
        }
        emitChanges();
    }

    // ------------------------------------------------------------ the network

    private void networkChanged(NetworkWatch.State state) {
        synchronized (lock) {
            networkChanges++;
            // A network the running area may not use (none, or metered when it
            // was not allowed): cut the open request now, not after 4 MB or a
            // read timeout. The worker then shows what the area waits for.
            Area a = activeId == null ? null : areas.get(activeId);
            if (a != null && !Schedule.mayFetch(a.allowMetered, state.usable, state.metered)) cutActive();
            lock.notifyAll();
        }
        emitChanges();
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

    private List<Schedule.Entry> entries() {
        List<Schedule.Entry> out = new ArrayList<>(areas.size());
        for (Area a : areas.values()) out.add(new Schedule.Entry(a.id, a.intent, a.allowMetered));
        return out;
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
        try {
            while (true) {
                Area a;
                synchronized (lock) {
                    if (suspended || firstActive() == null) {
                        activeId = null;
                        worker = null;
                        lock.notifyAll();
                        break;
                    }
                    NetworkWatch.State net = network.state();
                    String pick = Schedule.pick(entries(), net.usable, net.metered);
                    a = pick == null ? null : areas.get(pick);
                    activeId = pick;
                    stopActive = false;
                    if (a != null) {
                        if (!a.id.equals(lastId)) failures = 0;
                        lastId = a.id;
                    }
                    lock.notifyAll();
                }
                if (a == null) {
                    // Nothing may fetch on this network: wait for it to change or for the user.
                    wake.drop();
                    emitChanges();
                    waitFor(MAX_BACKOFF_MS);
                    continue;
                }
                emitChanges();
                if (!a.guard.enter()) continue;
                wake.hold();
                long delay = 0;
                try {
                    runArea(a);
                    failures = 0;
                } catch (DownloadProblem p) {
                    switch (p.kind) {
                        case STOPPED:
                            break;
                        case FAILED:
                            Log.w(TAG, "area " + a.id + " failed (" + p.error + "): " + p.getMessage());
                            synchronized (lock) {
                                if (areas.get(a.id) == a && a.intent.equals("active")) {
                                    a.intent = "failed";
                                    a.error = p.error;
                                    a.waiting = false;
                                    writeIntent(a);
                                }
                            }
                            break;
                        case TRANSIENT:
                            failures = p.madeProgress ? 1 : failures + 1;
                            delay = Math.min(MAX_BACKOFF_MS, 1000L << Math.min(6, failures - 1));
                            Log.i(TAG, "area " + a.id + ": " + p.getMessage() + "; try " + failures + ", again in " + delay + " ms");
                            synchronized (lock) {
                                if (failures >= FAILURES_BEFORE_WAITING) a.waiting = true;
                            }
                            break;
                    }
                } finally {
                    a.guard.leave();
                    wake.drop();
                }
                emitChanges();
                if (delay > 0) waitFor(delay);
            }
        } finally {
            wake.drop();
        }
        ServiceHook s = service;
        if (s != null) s.idle();
    }

    /**
     * Sleeps up to {@code ms}, or until Android reports any change of network,
     * the web app calls, or the running area is to stop.
     */
    private void waitFor(long ms) {
        synchronized (lock) {
            long until = System.currentTimeMillis() + ms;
            int pokesBefore = pokes;
            int networkBefore = networkChanges;
            while (pokes == pokesBefore && networkChanges == networkBefore && !stopActive && !suspended) {
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
                    // Bytes are moving: keep the CPU awake.
                    wake.hold();
                    if (statusChanged) emitChanges();
                    else emitSoon(a);
                }

                @Override
                public boolean stopRequested() {
                    synchronized (lock) {
                        return stopActive || suspended || a.guard.isRemoved();
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
        // Every file is in place. One more file makes the area visible to the
        // map, unless the area was removed meanwhile: then remove wins.
        try {
            boolean written = a.guard.commit(() -> Files.writeAtomically(new File(a.dir, AreaLayout.COMPLETE), new byte[0]));
            if (!written) throw DownloadProblem.stopped();
        } catch (IOException e) {
            throw DownloadProblem.failed(FileDownloader.isNoSpace(e) ? "no-space" : "other", "could not mark the area complete: " + e);
        }
        synchronized (lock) {
            a.intent = "complete";
            a.waiting = false;
            writeIntent(a);
        }
        for (int i = 0; i < files.size(); i++) AreaLayout.head(a.dir, i).delete();
        Log.i(TAG, "area " + a.id + " complete, " + a.done() + " bytes");
        ArchiveCatalog.get(context).refresh();
    }

    // ------------------------------------------------------------ events

    private Area need(String id) {
        Area a = areas.get(id);
        if (a == null) throw new IllegalArgumentException("no area " + id);
        return a;
    }

    private Snapshot snapshot(Area a) {
        NetworkWatch.State net = network.state();
        Schedule.Shown shown = Schedule.shown(
            new Schedule.Entry(a.id, a.intent, a.allowMetered),
            entries(),
            net.usable,
            net.metered,
            suspended,
            activeId,
            a.waiting
        );
        String name = "";
        try {
            name = new JSONObject(a.record()).optString("name", "");
        } catch (JSONException ignored) {
            // The record is the web app's; the notification does without a name.
        }
        String error = a.intent.equals("failed") ? a.error : null;
        return new Snapshot(a.id, a.record(), shown.status, error, shown.waitingFor, a.allowMetered, a.done(), a.total, name);
    }

    private void emitSoon(Area a) {
        long now = System.currentTimeMillis();
        synchronized (lock) {
            if (now - a.lastEmit < EMIT_INTERVAL_MS) return;
        }
        emitNow(a.id);
    }

    /** Sends one area's state now. */
    private void emitNow(String id) {
        Snapshot s;
        synchronized (lock) {
            Area a = areas.get(id);
            if (a == null) return;
            a.lastEmit = System.currentTimeMillis();
            s = snapshot(a);
            a.lastKey = s.key();
        }
        send(s);
        updateService();
    }

    /** Sends the state of every area whose status, waitingFor, allowMetered or error changed. */
    private void emitChanges() {
        List<Snapshot> changed = new ArrayList<>();
        synchronized (lock) {
            for (Area a : areas.values()) {
                Snapshot s = snapshot(a);
                if (s.key().equals(a.lastKey)) continue;
                a.lastKey = s.key();
                a.lastEmit = System.currentTimeMillis();
                changed.add(s);
            }
        }
        for (Snapshot s : changed) send(s);
        updateService();
    }

    private void send(Snapshot s) {
        for (Listener l : listeners) {
            try {
                l.changed(s);
            } catch (RuntimeException e) {
                Log.w(TAG, "listener failed", e);
            }
        }
    }

    /** The notification shows the running area, or else the first that waits or is queued. */
    private void updateService() {
        ServiceHook hook = service;
        if (hook == null) return;
        Snapshot headline = null;
        synchronized (lock) {
            Area a = activeId == null ? null : areas.get(activeId);
            if (a == null) a = firstActive();
            if (a != null) headline = snapshot(a);
        }
        if (headline != null) hook.progress(headline);
    }
}
