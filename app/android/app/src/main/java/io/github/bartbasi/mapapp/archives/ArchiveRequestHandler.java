// MapApp. Copyright 2026 Play, Inc.
// Free software under the GNU GPL v3 with additional terms: see LICENSE and NOTICE.

package io.github.bartbasi.mapapp.archives;

import android.net.Uri;
import android.util.Log;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import java.io.ByteArrayInputStream;
import java.util.HashMap;
import java.util.Map;

/**
 * Answers https://localhost/_tiles/<county-id>/<layer>.pmtiles?o=<offset>&n=<length>
 * with exactly those bytes of the archive (DECISIONS D5).
 *
 * The range is in the address on purpose, never in a Range header. If a
 * request carries a Range header, Android WebView applies the range itself to
 * the stream the app returns and sizes that stream with a 32-bit number, so
 * returning exact bytes fails past the first block and whole files fail past
 * 2 GB. With the range in the address the answer is a plain 200 with no
 * size limit.
 */
public final class ArchiveRequestHandler {

    public static final String PREFIX = "/_tiles/";
    private static final String TAG = "MapAppArchives";
    /** The largest single read. pmtiles reads directories and tiles far smaller than this. */
    private static final long MAX_READ = 32L * 1024 * 1024;

    private final ArchiveCatalog catalog;

    public ArchiveRequestHandler(ArchiveCatalog catalog) {
        this.catalog = catalog;
    }

    /** True if this request is for an archive, so this handler must answer it. */
    public static boolean handles(WebResourceRequest request) {
        String path = request.getUrl().getPath();
        return path != null && path.startsWith(PREFIX);
    }

    public WebResourceResponse handle(WebResourceRequest request) {
        if (!"GET".equals(request.getMethod())) return status(405, "Method Not Allowed");
        Uri url = request.getUrl();
        String key = ArchiveIds.keyFromPath(url.getPath());
        if (key == null) return status(404, "Not Found");

        long offset;
        long length;
        try {
            offset = Long.parseLong(url.getQueryParameter("o"));
            length = Long.parseLong(url.getQueryParameter("n"));
        } catch (RuntimeException e) {
            return status(400, "Bad Request");
        }

        try {
            ArchiveReader reader = catalog.reader(key);
            if (reader == null) return status(404, "Not Found");
            if (offset < 0 || length <= 0 || length > MAX_READ || offset >= reader.size()) {
                return status(416, "Range Not Satisfiable");
            }
            byte[] body = reader.read(offset, (int) length);
            Map<String, String> headers = new HashMap<>();
            headers.put("Cache-Control", "no-store");
            headers.put("Content-Length", String.valueOf(body.length));
            return new WebResourceResponse("application/octet-stream", null, 200, "OK", headers, new ByteArrayInputStream(body));
        } catch (Exception e) {
            Log.w(TAG, "read failed for " + key, e);
            return status(500, "Read Error");
        }
    }

    private static WebResourceResponse status(int code, String reason) {
        return new WebResourceResponse("text/plain", "utf-8", code, reason, new HashMap<>(), new ByteArrayInputStream(new byte[0]));
    }
}
