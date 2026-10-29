package com.microboxlabs.miot.integrations.orgaccount;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.sun.net.httpserver.HttpServer;
import java.io.IOException;
import java.net.InetSocketAddress;
import java.net.http.HttpClient;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

class PlatformGoogleTokenTest {

    private final List<String> requests = new ArrayList<>();
    private HttpServer server;
    private String base;

    @TempDir
    Path dir;

    @BeforeEach
    void start() throws IOException {
        server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        server.createContext("/", exchange -> {
            String body = new String(exchange.getRequestBody().readAllBytes(), StandardCharsets.UTF_8);
            requests.add(exchange.getRequestMethod() + " " + exchange.getRequestURI().getPath() + " "
                    + exchange.getRequestHeaders().getFirst("Metadata-Flavor") + " " + body);
            byte[] out = "{\"access_token\":\"ya29.platform\",\"expires_in\":3599}".getBytes(StandardCharsets.UTF_8);
            exchange.sendResponseHeaders(200, out.length);
            exchange.getResponseBody().write(out);
            exchange.close();
        });
        server.start();
        base = "http://127.0.0.1:" + server.getAddress().getPort();
    }

    @AfterEach
    void stop() {
        server.stop(0);
    }

    private PlatformGoogleToken token(Optional<Path> adc) {
        return new PlatformGoogleToken(HttpClient.newHttpClient(), new ObjectMapper(),
                Clock.fixed(Instant.parse("2026-10-29T12:00:00Z"), ZoneOffset.UTC), adc,
                base + "/metadata", base + "/token");
    }

    @Test
    void usesTheMetadataServerWithoutALocalFileAndCachesTheToken() {
        PlatformGoogleToken platform = token(Optional.empty());
        assertEquals("ya29.platform", platform.get());
        assertEquals("ya29.platform", platform.get());
        assertEquals(1, requests.size());
        assertTrue(requests.get(0).startsWith("GET /metadata Google"));
    }

    @Test
    void refreshesLocalUserCredentials() throws IOException {
        Path file = dir.resolve("adc.json");
        Files.writeString(file, "{\"type\":\"authorized_user\",\"client_id\":\"cid\","
                + "\"client_secret\":\"cs\",\"refresh_token\":\"rt\"}");
        assertEquals("ya29.platform", token(Optional.of(file)).get());
        assertTrue(requests.get(0).startsWith("POST /token"));
        assertTrue(requests.get(0).contains("grant_type=refresh_token"));
        assertTrue(requests.get(0).contains("refresh_token=rt"));
    }

    @Test
    void refusesAKeyFile() throws IOException {
        Path file = dir.resolve("key.json");
        Files.writeString(file, "{\"type\":\"service_account\",\"private_key\":\"x\"}");
        assertThrows(GoogleCallException.class, () -> token(Optional.of(file)).get());
        assertTrue(requests.isEmpty());
    }
}
