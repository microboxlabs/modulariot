package com.microboxlabs.miot.integrations.email;

import com.sun.net.httpserver.HttpServer;
import java.io.IOException;
import java.io.OutputStream;
import java.net.InetSocketAddress;
import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/** A local stand-in for the Resend API: answers each path with a fixed status and body, and records the request. */
public final class FakeResend implements AutoCloseable {

    public record Reply(int status, String body) {
    }

    public record Seen(String method, String path, Map<String, String> headers, String body) {
    }

    private final HttpServer server;
    private final Map<String, Reply> replies = new ConcurrentHashMap<>();
    private volatile Seen last;

    public FakeResend() throws IOException {
        server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        server.createContext("/", exchange -> {
            String body = new String(exchange.getRequestBody().readAllBytes(), StandardCharsets.UTF_8);
            Map<String, String> headers = new ConcurrentHashMap<>();
            exchange.getRequestHeaders().forEach((k, v) -> headers.put(k.toLowerCase(), String.join(",", v)));
            last = new Seen(exchange.getRequestMethod(), exchange.getRequestURI().getPath(), headers, body);
            Reply reply = replies.getOrDefault(exchange.getRequestURI().getPath(), new Reply(404, "{}"));
            byte[] out = reply.body().getBytes(StandardCharsets.UTF_8);
            exchange.getResponseHeaders().add("Content-Type", "application/json");
            exchange.sendResponseHeaders(reply.status(), out.length);
            try (OutputStream stream = exchange.getResponseBody()) {
                stream.write(out);
            }
        });
        server.start();
    }

    public FakeResend reply(String path, int status, String body) {
        replies.put(path, new Reply(status, body));
        return this;
    }

    public URI baseUrl() {
        return URI.create("http://127.0.0.1:" + server.getAddress().getPort());
    }

    public Seen last() {
        return last;
    }

    @Override
    public void close() {
        server.stop(0);
    }
}
