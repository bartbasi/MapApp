// MapApp. Copyright 2026 Play, Inc.
// Free software under the GNU GPL v3 with additional terms: see LICENSE and NOTICE.

package io.github.bartbasi.mapapp.downloads;

import android.security.NetworkSecurityPolicy;
import java.io.IOException;
import java.net.HttpURLConnection;
import java.net.MalformedURLException;
import java.net.URL;
import java.net.UnknownServiceException;
import java.util.Locale;

/**
 * Plain GET requests with the platform's HttpURLConnection, for hosted map
 * files. Redirects are followed here, not by the connection, so that the
 * address a release host redirects to (a signed address that runs out after a
 * while) can be kept and reused, and so that only http and https are ever
 * followed.
 *
 * Every request asks for the bytes as stored (Accept-Encoding: identity): a
 * compressed answer would make byte ranges meaningless. Requests carry a
 * plain app name and nothing that names the user or the phone (D21, D33).
 */
final class Http {

    static final String USER_AGENT = "MapApp (open source map app)";
    static final int CONNECT_TIMEOUT_MS = 15_000;
    static final int READ_TIMEOUT_MS = 30_000;
    private static final int MAX_REDIRECTS = 5;

    private Http() {}

    /** Whether plain http to a host is allowed in this build. */
    interface Cleartext {
        boolean permitted(String host);
    }

    /**
     * The build's network security config: plain http only to the test server
     * in a debug build, never in a release build. Where the platform class gives
     * nothing (laptop tests), http is allowed.
     */
    static final Cleartext BUILD_POLICY = host -> {
        NetworkSecurityPolicy p = NetworkSecurityPolicy.getInstance();
        return p == null || p.isCleartextTrafficPermitted(host);
    };

    /** The policy in use. Tests replace it. */
    static volatile Cleartext cleartext = BUILD_POLICY;

    /** An answered request: the open connection, its status, and the address that answered. */
    static final class Answer {
        final HttpURLConnection connection;
        final int status;
        /** The address that gave the answer, after any redirects. */
        final String url;
        final boolean redirected;

        Answer(HttpURLConnection connection, int status, String url, boolean redirected) {
            this.connection = connection;
            this.status = status;
            this.url = url;
            this.redirected = redirected;
        }

        String header(String name) {
            return connection.getHeaderField(name);
        }

        long contentLength() {
            String v = connection.getHeaderField("Content-Length");
            if (v == null) return -1;
            try {
                return Long.parseLong(v.trim());
            } catch (NumberFormatException e) {
                return -1;
            }
        }

        void close() {
            connection.disconnect();
        }
    }

    /**
     * Thrown for an address that is not http(s), a redirect to one, or plain
     * http where the build does not allow it. The area fails as "server".
     */
    static final class BadAddress extends IOException {
        BadAddress(String message) {
            super(message);
        }
    }

    /**
     * GETs {@code url}, following redirects. With {@code length > 0} asks for
     * {@code length} bytes at {@code offset} with a Range header.
     *
     * @param hook told of each connection as it opens, so another thread can cut it; may be null
     */
    static Answer get(String url, long offset, long length, ConnectionHook hook) throws IOException {
        URL current = parse(url);
        boolean redirected = false;
        for (int hop = 0; ; hop++) {
            HttpURLConnection c = (HttpURLConnection) current.openConnection();
            c.setInstanceFollowRedirects(false);
            c.setUseCaches(false);
            c.setConnectTimeout(CONNECT_TIMEOUT_MS);
            c.setReadTimeout(READ_TIMEOUT_MS);
            c.setRequestProperty("User-Agent", USER_AGENT);
            c.setRequestProperty("Accept-Encoding", "identity");
            if (length > 0) c.setRequestProperty("Range", "bytes=" + offset + "-" + (offset + length - 1));
            if (hook != null) hook.opened(c);
            int status;
            try {
                status = c.getResponseCode();
            } catch (UnknownServiceException e) {
                // The platform refused the address itself (cleartext not permitted).
                c.disconnect();
                throw new BadAddress("refused by this build: " + e.getMessage());
            } catch (IOException e) {
                c.disconnect();
                throw e;
            }
            if (isRedirect(status)) {
                String location = c.getHeaderField("Location");
                c.disconnect();
                if (location == null) throw new IOException("redirect " + status + " without a Location");
                if (hop >= MAX_REDIRECTS) throw new IOException("too many redirects");
                current = parse(new URL(current, location).toString());
                redirected = true;
                continue;
            }
            return new Answer(c, status, current.toString(), redirected);
        }
    }

    static boolean isRedirect(int status) {
        return status == 301 || status == 302 || status == 303 || status == 307 || status == 308;
    }

    private static URL parse(String url) throws IOException {
        URL u;
        try {
            u = new URL(url);
        } catch (MalformedURLException e) {
            throw new BadAddress("not an address: " + url);
        }
        String p = u.getProtocol().toLowerCase(Locale.ROOT);
        if (!p.equals("http") && !p.equals("https")) throw new BadAddress("only http and https: " + url);
        // A scheme this build does not allow fails at once, never as a connection problem to retry.
        if (p.equals("http") && !cleartext.permitted(u.getHost())) throw new BadAddress("plain http is not allowed in this build: " + url);
        return u;
    }

    /** Told of each connection a request opens. */
    interface ConnectionHook {
        void opened(HttpURLConnection connection);
    }
}
