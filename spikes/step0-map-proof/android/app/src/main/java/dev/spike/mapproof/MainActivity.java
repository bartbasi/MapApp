package dev.spike.mapproof;

import android.os.Bundle;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebView;
import com.getcapacitor.Bridge;
import com.getcapacitor.BridgeActivity;
import com.getcapacitor.BridgeWebViewClient;
import java.io.ByteArrayInputStream;
import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.io.RandomAccessFile;
import java.util.HashMap;
import java.util.Map;

// Throwaway Step 0 test. Not product code.
//
// Answers https://localhost/_tiles/<file>?o=<offset>&n=<length> with exactly
// those bytes of a file in app storage.
//
// The range is in the URL on purpose. If a request carries a Range header,
// Android WebView applies that range itself to the stream the app returns: it
// skips to the start offset and sizes the stream with InputStream.available(),
// which is an int. Returning the exact bytes for a Range request therefore
// fails for any offset above zero, and returning the whole file fails past
// 2 GB. Capacitor's own file server has the same limit.
public class MainActivity extends BridgeActivity {

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        copyBundledArchive("champaign_z15.pmtiles");
        bridge.setWebViewClient(new TileClient(bridge, getFilesDir()));
    }

    // The test archive ships inside the APK so the test runs on a phone with
    // no setup. It is copied to app storage once, where it can be read by offset.
    private void copyBundledArchive(String name) {
        File target = new File(getFilesDir(), name);
        if (target.isFile() && target.length() > 0) return;
        File partial = new File(getFilesDir(), name + ".part");
        try (InputStream in = getAssets().open(name); OutputStream out = new FileOutputStream(partial)) {
            byte[] buffer = new byte[1 << 16];
            int n;
            while ((n = in.read(buffer)) > 0) out.write(buffer, 0, n);
        } catch (Exception e) {
            partial.delete();
            return;
        }
        partial.renameTo(target);
    }

    static class TileClient extends BridgeWebViewClient {

        private static final String PREFIX = "/_tiles/";
        private final File dir;

        TileClient(Bridge bridge, File dir) {
            super(bridge);
            this.dir = dir;
        }

        @Override
        public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
            String path = request.getUrl().getPath();
            if (path == null || !path.startsWith(PREFIX)) {
                return super.shouldInterceptRequest(view, request);
            }
            String name = path.substring(PREFIX.length());
            if (name.contains("/") || name.contains("..")) {
                return status(403, "Forbidden");
            }
            File file = new File(dir, name);
            if (!file.isFile()) {
                return status(404, "Not Found");
            }
            long offset;
            long length;
            try {
                offset = Long.parseLong(request.getUrl().getQueryParameter("o"));
                length = Long.parseLong(request.getUrl().getQueryParameter("n"));
            } catch (RuntimeException e) {
                return status(400, "Bad Request");
            }
            try (RandomAccessFile raf = new RandomAccessFile(file, "r")) {
                long size = raf.length();
                if (offset < 0 || length <= 0 || offset >= size || length > 64L * 1024 * 1024) {
                    return status(416, "Range Not Satisfiable");
                }
                byte[] body = new byte[(int) Math.min(length, size - offset)];
                raf.seek(offset);
                raf.readFully(body);
                Map<String, String> headers = new HashMap<>();
                headers.put("Cache-Control", "no-store");
                return new WebResourceResponse("application/octet-stream", null, 200, "OK", headers, new ByteArrayInputStream(body));
            } catch (Exception e) {
                return status(500, "Read Error");
            }
        }

        private static WebResourceResponse status(int code, String reason) {
            return new WebResourceResponse("text/plain", "utf-8", code, reason, new HashMap<>(), new ByteArrayInputStream(new byte[0]));
        }
    }
}
