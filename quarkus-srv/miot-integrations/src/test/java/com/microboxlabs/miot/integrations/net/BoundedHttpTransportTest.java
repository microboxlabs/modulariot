package com.microboxlabs.miot.integrations.net;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

import com.sun.net.httpserver.HttpServer;
import java.io.IOException;
import java.net.InetSocketAddress;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import org.junit.jupiter.api.Test;

class BoundedHttpTransportTest {
    @Test
    void readsAnExactUtf8ByteLimitOverARealSocket() throws Exception {
        byte[] body = "{\"name\":\"😀\"}".getBytes(StandardCharsets.UTF_8);
        HttpServer server = server();
        server.createContext("/", exchange -> {
            exchange.sendResponseHeaders(200, body.length);
            exchange.getResponseBody().write(body);
            exchange.close();
        });
        server.start();
        try (HttpClient client = HttpClient.newHttpClient()) {
            var response = BoundedHttpTransport.send(client, request(server), body.length, Duration.ofSeconds(2));
            assertEquals(200, response.statusCode());
            assertEquals(new String(body, StandardCharsets.UTF_8), response.body());
        } finally {
            server.stop(0);
        }
    }

    @Test
    void refusesAnOversizedChunkedBodyWithoutTrustingContentLength() throws Exception {
        HttpServer server = server();
        server.createContext("/", exchange -> {
            exchange.sendResponseHeaders(200, 0);
            exchange.getResponseBody().write(new byte[1024]);
            exchange.close();
        });
        server.start();
        try (HttpClient client = HttpClient.newHttpClient()) {
            assertThrows(IOException.class,
                    () -> BoundedHttpTransport.send(client, request(server), 100, Duration.ofSeconds(2)));
        } finally {
            server.stop(0);
        }
    }

    @Test
    void deadlineCoversAResponseThatStallsAfterHeaders() throws Exception {
        HttpServer server = server();
        server.createContext("/", exchange -> {
            exchange.sendResponseHeaders(200, 0);
            exchange.getResponseBody().write('x');
            exchange.getResponseBody().flush();
            // Leave the body open: receiving headers must not end the deadline.
        });
        server.start();
        try (HttpClient client = HttpClient.newHttpClient()) {
            assertThrows(IOException.class,
                    () -> BoundedHttpTransport.send(client, request(server), 100, Duration.ofMillis(200)));
        } finally {
            server.stop(0);
        }
    }

    @Test
    void interruptionCancelsTheOutstandingRequest() throws Exception {
        HttpServer server = server();
        server.createContext("/", exchange -> { });
        server.start();
        try (HttpClient client = HttpClient.newHttpClient()) {
            Thread.currentThread().interrupt();
            try {
                assertThrows(InterruptedException.class,
                        () -> BoundedHttpTransport.send(client, request(server), 100, Duration.ofSeconds(2)));
            } finally {
                Thread.interrupted();
            }
        } finally {
            server.stop(0);
        }
    }

    @Test
    void invalidLimitsFailBeforeSending() throws Exception {
        HttpServer server = server();
        try (HttpClient client = HttpClient.newHttpClient()) {
            assertThrows(IllegalArgumentException.class,
                    () -> BoundedHttpTransport.send(client, request(server), 0, Duration.ofSeconds(1)));
            assertThrows(IllegalArgumentException.class,
                    () -> BoundedHttpTransport.send(client, request(server), 1, Duration.ZERO));
        } finally {
            server.stop(0);
        }
    }

    private static HttpServer server() throws IOException {
        return HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
    }

    private static HttpRequest request(HttpServer server) {
        return HttpRequest.newBuilder(URI.create("http://127.0.0.1:" + server.getAddress().getPort() + "/")).build();
    }
}
