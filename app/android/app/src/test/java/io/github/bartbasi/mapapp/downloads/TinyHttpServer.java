// MapApp. Copyright 2026 Play, Inc.
// Free software under the GNU GPL v3 with additional terms: see LICENSE and NOTICE.

package io.github.bartbasi.mapapp.downloads;

import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.net.InetAddress;
import java.net.ServerSocket;
import java.net.Socket;
import java.nio.charset.StandardCharsets;
import java.util.LinkedHashMap;
import java.util.Locale;
import java.util.Map;

/**
 * A minimal HTTP/1.1 server for tests on the laptop, on plain sockets (Android
 * unit tests cannot see the JDK's own server). One request per connection.
 */
final class TinyHttpServer implements AutoCloseable {

    /** What a handler sees of a request. */
    static final class Request {
        final String path;
        final Map<String, String> headers;

        Request(String path, Map<String, String> headers) {
            this.path = path;
            this.headers = headers;
        }

        String header(String name) {
            return headers.get(name.toLowerCase(Locale.ROOT));
        }
    }

    /** What a handler sends back. {@code cutAfter} >= 0 sends only that many body bytes, then drops the connection. */
    static final class Response {
        int status = 200;
        final Map<String, String> headers = new LinkedHashMap<>();
        byte[] body = new byte[0];
        int bodyOffset;
        int bodyLength;
        int cutAfter = -1;

        Response status(int s) {
            status = s;
            return this;
        }

        Response header(String name, String value) {
            headers.put(name, value);
            return this;
        }

        Response body(byte[] b, int offset, int length) {
            body = b;
            bodyOffset = offset;
            bodyLength = length;
            return this;
        }
    }

    interface Handler {
        Response handle(Request request);
    }

    private final ServerSocket socket;
    private final Thread acceptor;
    private volatile boolean open = true;

    TinyHttpServer(Handler handler) throws IOException {
        socket = new ServerSocket(0, 50, InetAddress.getByName("127.0.0.1"));
        acceptor = new Thread(() -> {
            while (open) {
                try {
                    Socket s = socket.accept();
                    new Thread(() -> serve(s, handler)).start();
                } catch (IOException e) {
                    return;
                }
            }
        });
        acceptor.setDaemon(true);
        acceptor.start();
    }

    int port() {
        return socket.getLocalPort();
    }

    private static void serve(Socket s, Handler handler) {
        try (Socket conn = s) {
            BufferedReader in = new BufferedReader(new InputStreamReader(conn.getInputStream(), StandardCharsets.ISO_8859_1));
            String line = in.readLine();
            if (line == null) return;
            String[] parts = line.split(" ");
            Map<String, String> headers = new LinkedHashMap<>();
            while ((line = in.readLine()) != null && !line.isEmpty()) {
                int colon = line.indexOf(':');
                if (colon > 0) headers.put(line.substring(0, colon).trim().toLowerCase(Locale.ROOT), line.substring(colon + 1).trim());
            }
            Response r = handler.handle(new Request(parts.length > 1 ? parts[1] : "/", headers));
            StringBuilder head = new StringBuilder("HTTP/1.1 " + r.status + " X\r\n");
            boolean noBody = r.status == 204 || r.status == 304 || (r.status >= 300 && r.status < 400) || r.status == 403;
            if (!noBody || r.bodyLength > 0) head.append("Content-Length: ").append(r.bodyLength).append("\r\n");
            else head.append("Content-Length: 0\r\n");
            for (Map.Entry<String, String> h : r.headers.entrySet()) head.append(h.getKey()).append(": ").append(h.getValue()).append("\r\n");
            head.append("Connection: close\r\n\r\n");
            OutputStream out = conn.getOutputStream();
            out.write(head.toString().getBytes(StandardCharsets.ISO_8859_1));
            int send = r.cutAfter >= 0 ? Math.min(r.cutAfter, r.bodyLength) : r.bodyLength;
            out.write(r.body, r.bodyOffset, send);
            out.flush();
            // With cutAfter the socket closes here, short of Content-Length: the
            // client sees the answer end early, as when a connection is lost.
        } catch (IOException ignored) {
            // The client went away.
        }
    }

    @Override
    public void close() {
        open = false;
        try {
            socket.close();
        } catch (IOException ignored) {
            // closing anyway
        }
    }
}
