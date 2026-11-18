// MapApp. Copyright 2026 Play, Inc.
// Free software under the GNU GPL v3 with additional terms: see LICENSE and NOTICE.

package io.github.bartbasi.mapapp.downloads;

import android.Manifest;
import android.os.Build;
import android.util.Base64;
import android.util.Log;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;
import io.github.bartbasi.mapapp.archives.ArchiveIds;
import java.io.File;
import java.io.IOException;
import java.io.InputStream;
import java.io.RandomAccessFile;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/**
 * The downloader and small reads of hosted files, for the web app. Its
 * counterpart is src/platform/android.ts (RemoteFiles and DownloadJobs of
 * src/downloads/contract.ts).
 *
 * A job's heads can be hundreds of KB, so they are not part of the start
 * call: the web app sends each head first with writeHead, in pieces, and they
 * are stored as files until start picks them up.
 *
 * Events: "change" with an AreaState on every change of status and about once
 * a second while downloading.
 */
@CapacitorPlugin(
    name = "Downloads",
    permissions = { @Permission(strings = { Manifest.permission.POST_NOTIFICATIONS }, alias = DownloadsPlugin.NOTIFICATIONS) }
)
public class DownloadsPlugin extends Plugin {

    static final String NOTIFICATIONS = "notifications";
    private static final String TAG = "MapAppDownloads";
    /** The largest piece of a head in one writeHead call, before base64. */
    private static final int MAX_HEAD_PIECE = 4 * 1024 * 1024;
    /** The largest read(): planning reads directories, a few hundred KB at most. */
    private static final long MAX_READ = 16L * 1024 * 1024;
    /** The largest text(): the catalog. */
    private static final long MAX_TEXT = 4L * 1024 * 1024;

    private DownloadEngine engine;
    private NetworkWatch network;
    /** Reads and file work off Capacitor's plugin thread, which other plugins share. */
    private final ExecutorService io = Executors.newFixedThreadPool(3);
    private final DownloadEngine.Listener listener = area -> notifyListeners("change", toJs(area));

    @Override
    public void load() {
        engine = DownloadEngine.get(getContext());
        network = NetworkWatch.get(getContext());
        engine.addListener(listener);
        // Areas that were downloading when the app was last closed or killed go on now.
        io.execute(engine::appVisible);
    }

    @Override
    protected void handleOnResume() {
        if (engine != null) io.execute(engine::appVisible);
    }

    @Override
    protected void handleOnDestroy() {
        if (engine != null) engine.removeListener(listener);
        io.shutdown();
    }

    // ------------------------------------------------------------ jobs

    /** { id, index, offset, data (base64) }: appends a piece of file index's head. */
    @PluginMethod
    public void writeHead(PluginCall call) {
        String id = call.getString("id");
        Long indexArg = wholeNumber(call, "index");
        Integer index = indexArg == null || indexArg > 999 ? null : indexArg.intValue();
        Long offset = wholeNumber(call, "offset");
        String data = call.getString("data");
        if (!ArchiveIds.isId(id) || index == null || index < 0 || index > 999 || offset == null || offset < 0 || data == null) {
            call.reject("bad head piece", "bad-request");
            return;
        }
        io.execute(() -> {
            try {
                byte[] bytes = Base64.decode(data, Base64.DEFAULT);
                if (bytes.length > MAX_HEAD_PIECE) throw new IOException("head piece too large");
                File dir = engine.stagingFor(id);
                Files.mkdirs(dir);
                File head = AreaLayout.head(dir, index);
                try (RandomAccessFile raf = new RandomAccessFile(head, "rw")) {
                    // Pieces come in order; a repeated piece overwrites from its offset.
                    if (offset > raf.length()) throw new IOException("head piece at " + offset + " leaves a gap after " + raf.length());
                    raf.setLength(offset);
                    raf.seek(offset);
                    raf.write(bytes);
                }
                call.resolve();
            } catch (IOException | IllegalArgumentException e) {
                call.reject(e.getMessage(), "bad-request");
            }
        });
    }

    /**
     * { id, record, allowMetered, files: [{ county, layer, url, etag?, headBytes,
     * ranges: [offset, length, ...], bytes, sha256?, meta }] }. allowMetered is
     * stored with the job; anything but true counts as false. On Android 13 and later asks once for
     * permission to show the progress notification; the download runs either way.
     */
    @PluginMethod
    public void start(PluginCall call) {
        if (Build.VERSION.SDK_INT >= 33 && getPermissionState(NOTIFICATIONS) == PermissionState.PROMPT) {
            requestPermissionForAlias(NOTIFICATIONS, call, "notificationsAnswered");
            return;
        }
        startNow(call);
    }

    @PermissionCallback
    private void notificationsAnswered(PluginCall call) {
        Log.i(TAG, "notification permission: " + getPermissionState(NOTIFICATIONS));
        startNow(call);
    }

    private void startNow(PluginCall call) {
        io.execute(() -> {
            try {
                engine.start(call.getData());
                call.resolve();
            } catch (Exception e) {
                Log.w(TAG, "start refused", e);
                call.reject(e.getMessage(), "bad-request");
            }
        });
    }

    @PluginMethod
    public void pause(PluginCall call) {
        withId(call, id -> engine.pause(id));
    }

    @PluginMethod
    public void resume(PluginCall call) {
        withId(call, id -> engine.resume(id));
    }

    @PluginMethod
    public void remove(PluginCall call) {
        withId(call, id -> engine.remove(id));
    }

    /** { id, allow }: whether the area may use a connection charged by use (contract.ts setAllowMetered). */
    @PluginMethod
    public void setAllowMetered(PluginCall call) {
        Object allow = call.getData().opt("allow");
        if (!(allow instanceof Boolean)) {
            call.reject("allow must be true or false", "bad-request");
            return;
        }
        withId(call, id -> engine.setAllowMetered(id, (Boolean) allow));
    }

    @PluginMethod
    public void list(PluginCall call) {
        JSArray rows = new JSArray();
        for (DownloadEngine.Snapshot s : engine.list()) rows.put(toJs(s));
        JSObject ret = new JSObject();
        ret.put("areas", rows);
        call.resolve(ret);
    }

    @PluginMethod
    public void freeBytes(PluginCall call) {
        io.execute(() -> {
            JSObject ret = new JSObject();
            try {
                ret.put("bytes", engine.freeBytes());
            } catch (RuntimeException e) {
                Log.w(TAG, "free space unknown", e);
            }
            call.resolve(ret);
        });
    }

    private interface IdAction {
        void run(String id) throws Exception;
    }

    private void withId(PluginCall call, IdAction action) {
        String id = call.getString("id");
        if (!ArchiveIds.isId(id)) {
            call.reject("bad area ID", "bad-request");
            return;
        }
        io.execute(() -> {
            try {
                action.run(id);
                call.resolve();
            } catch (IllegalArgumentException e) {
                call.reject(e.getMessage(), "unknown-area");
            } catch (Exception e) {
                call.reject(e.getMessage(), "other");
            }
        });
    }

    /**
     * A whole number argument. Capacitor's own getLong gives null for numbers
     * that arrive as Integer, which is every small one.
     */
    private static Long wholeNumber(PluginCall call, String name) {
        Object v = call.getData().opt(name);
        if (v instanceof Integer || v instanceof Long) return ((Number) v).longValue();
        if (v instanceof Number) {
            double d = ((Number) v).doubleValue();
            if (d == Math.rint(d) && Math.abs(d) <= RangePlan.MAX_SAFE) return (long) d;
        }
        return null;
    }

    static JSObject toJs(DownloadEngine.Snapshot s) {
        JSObject o = new JSObject();
        o.put("id", s.id);
        o.put("record", s.record);
        o.put("status", s.status);
        if (s.error != null) o.put("error", s.error);
        if (s.waitingFor != null) o.put("waitingFor", s.waitingFor);
        o.put("allowMetered", s.allowMetered);
        o.put("bytesDone", s.bytesDone);
        o.put("bytesTotal", s.bytesTotal);
        return o;
    }

    // ------------------------------------------------------------ small reads of hosted files

    /** { url }: the whole file as text. Rejects unless the answer is 200. */
    @PluginMethod
    public void text(PluginCall call) {
        String url = call.getString("url");
        if (!AreaJob.isHttp(url)) {
            call.reject("only http and https addresses", "bad-request");
            return;
        }
        io.execute(() -> {
            if (!network.state().usable) {
                call.reject("no connection", "offline");
                return;
            }
            Http.Answer a = null;
            try {
                a = Http.get(url, 0, 0, null);
                if (a.status != 200) {
                    call.reject("the server answered " + a.status, "status");
                    return;
                }
                byte[] body;
                try (InputStream in = a.connection.getInputStream()) {
                    body = Files.readAll(in, MAX_TEXT);
                }
                JSObject ret = new JSObject();
                ret.put("text", new String(body, StandardCharsets.UTF_8));
                call.resolve(ret);
            } catch (IOException e) {
                call.reject("could not read " + url + ": " + e.getMessage(), "network");
            } finally {
                if (a != null) a.close();
            }
        });
    }

    /** { url, offset, length }: exactly those bytes, as base64, with the ETag and the file's size. */
    @PluginMethod
    public void read(PluginCall call) {
        String url = call.getString("url");
        Long offset = wholeNumber(call, "offset");
        Long length = wholeNumber(call, "length");
        if (!AreaJob.isHttp(url) || offset == null || length == null || offset < 0 || length <= 0 || length > MAX_READ) {
            call.reject("bad read", "bad-request");
            return;
        }
        io.execute(() -> {
            if (!network.state().usable) {
                call.reject("no connection", "offline");
                return;
            }
            Http.Answer a = null;
            try {
                a = Http.get(url, offset, length, null);
                String etag = a.header("ETag");
                String contentRange = a.header("Content-Range");
                RangeResponse.Verdict v = RangeResponse.judge(a.status, contentRange, a.contentLength(), etag, offset, length, null);
                if (v != RangeResponse.Verdict.OK) {
                    call.reject("the server answered " + a.status + " (" + v + ")", "status");
                    return;
                }
                byte[] body;
                try (InputStream in = a.connection.getInputStream()) {
                    body = Files.readAll(in, length);
                }
                if (body.length != length) {
                    call.reject("short answer: " + body.length + " of " + length + " bytes", "network");
                    return;
                }
                JSObject ret = new JSObject();
                ret.put("data", Base64.encodeToString(body, Base64.NO_WRAP));
                if (etag != null) ret.put("etag", etag);
                RangeResponse.ContentRange cr = RangeResponse.parseContentRange(contentRange);
                if (cr != null && cr.total >= 0) ret.put("totalBytes", cr.total);
                call.resolve(ret);
            } catch (IOException e) {
                call.reject("could not read " + url + ": " + e.getMessage(), "network");
            } finally {
                if (a != null) a.close();
            }
        });
    }
}
