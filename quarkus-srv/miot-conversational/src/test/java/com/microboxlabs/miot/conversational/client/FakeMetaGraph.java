package com.microboxlabs.miot.conversational.client;

import com.sun.net.httpserver.HttpServer;
import java.io.IOException;
import java.io.UncheckedIOException;
import java.net.InetSocketAddress;
import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Deque;
import java.util.List;

/**
 * A local HTTP server standing in for the Meta Graph API: it answers each request with the next queued
 * response and records what it received. No network beyond the loopback.
 */
public final class FakeMetaGraph implements AutoCloseable {

    /** One request as Meta would see it. */
    public record Seen(String method, String path, String query, String auth, String body) {
    }

    private record Reply(int status, String body) {
    }

    private final HttpServer server;
    private final Deque<Reply> replies = new ArrayDeque<>();
    private final List<Seen> seen = new ArrayList<>();

    public FakeMetaGraph() {
        try {
            server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        }
        server.createContext("/", exchange -> {
            Reply reply;
            synchronized (this) {
                seen.add(new Seen(exchange.getRequestMethod(), exchange.getRequestURI().getPath(),
                        exchange.getRequestURI().getRawQuery(),
                        exchange.getRequestHeaders().getFirst("Authorization"),
                        new String(exchange.getRequestBody().readAllBytes(), StandardCharsets.UTF_8)));
                reply = replies.isEmpty() ? new Reply(500, "{}") : replies.removeFirst();
            }
            byte[] payload = reply.body().getBytes(StandardCharsets.UTF_8);
            exchange.getResponseHeaders().add("Content-Type", "application/json");
            exchange.sendResponseHeaders(reply.status(), payload.length == 0 ? -1 : payload.length);
            if (payload.length > 0) {
                exchange.getResponseBody().write(payload);
            }
            exchange.close();
        });
        server.start();
    }

    /** Queues the next response. */
    public synchronized FakeMetaGraph reply(int status, String body) {
        replies.addLast(new Reply(status, body));
        return this;
    }

    public synchronized List<Seen> seen() {
        return List.copyOf(seen);
    }

    public synchronized Seen last() {
        return seen.get(seen.size() - 1);
    }

    /** Like a connection's base URL, with the Graph version. */
    public URI baseUrl() {
        return URI.create("http://127.0.0.1:" + server.getAddress().getPort() + "/v25.0");
    }

    @Override
    public void close() {
        server.stop(0);
    }
}
