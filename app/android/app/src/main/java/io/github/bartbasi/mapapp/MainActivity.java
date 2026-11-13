// MapApp. Copyright 2026 Play, Inc.
// Free software under the GNU GPL v3 with additional terms: see LICENSE and NOTICE.

package io.github.bartbasi.mapapp;

import android.os.Bundle;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebView;
import com.getcapacitor.Bridge;
import com.getcapacitor.BridgeActivity;
import com.getcapacitor.BridgeWebViewClient;
import io.github.bartbasi.mapapp.archives.ArchiveCatalog;
import io.github.bartbasi.mapapp.archives.ArchiveRequestHandler;
import io.github.bartbasi.mapapp.archives.ArchivesPlugin;

public class MainActivity extends BridgeActivity {

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        registerPlugin(ArchivesPlugin.class);
        super.onCreate(savedInstanceState);
        ArchiveRequestHandler archives = new ArchiveRequestHandler(ArchiveCatalog.get(this));
        bridge.setWebViewClient(new MapAppWebViewClient(bridge, archives));
    }

    /** Capacitor's own client, plus the archive reads under /_tiles/. */
    static final class MapAppWebViewClient extends BridgeWebViewClient {

        private final ArchiveRequestHandler archives;

        MapAppWebViewClient(Bridge bridge, ArchiveRequestHandler archives) {
            super(bridge);
            this.archives = archives;
        }

        @Override
        public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
            if (ArchiveRequestHandler.handles(request)) return archives.handle(request);
            return super.shouldInterceptRequest(view, request);
        }
    }
}
