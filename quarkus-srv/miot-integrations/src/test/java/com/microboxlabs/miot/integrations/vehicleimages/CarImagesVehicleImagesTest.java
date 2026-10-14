package com.microboxlabs.miot.integrations.vehicleimages;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.microboxlabs.miot.core.vehicle.VehicleImages;
import com.microboxlabs.miot.integrations.domain.AuthType;
import com.microboxlabs.miot.integrations.domain.ProviderType;
import com.microboxlabs.miot.integrations.email.PlatformMailService;
import com.microboxlabs.miot.integrations.service.ConnectionResolutionException;
import com.microboxlabs.miot.integrations.service.IntegrationConnectionResolver;
import com.microboxlabs.miot.integrations.service.ResolvedConnection;
import com.sun.net.httpserver.HttpServer;
import java.io.IOException;
import java.net.InetSocketAddress;
import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.atomic.AtomicReference;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

/** Against a local stand-in for carimagesapi.com. */
class CarImagesVehicleImagesTest {

    private static final long EXPIRES = 1_800_000_000L;

    private HttpServer server;
    private URI base;
    private final List<String> requests = new ArrayList<>();
    private final List<String> secrets = new ArrayList<>();
    private final AtomicReference<Instant> now = new AtomicReference<>(Instant.ofEpochSecond(EXPIRES - 600));

    @BeforeEach
    void start() throws IOException {
        server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        server.createContext("/api/v1/signed-url", exchange -> {
            String query = exchange.getRequestURI().getRawQuery();
            requests.add(query);
            secrets.add(exchange.getRequestHeaders().getFirst("X-Api-Secret"));
            boolean known = !query.contains("make=Unknown");
            byte[] body = (known
                    ? "{\"url\":\"https://cdn.example/image?" + query + "&expires=" + EXPIRES + "&sig=ab\"}"
                    : "{\"error\":\"not found\"}").getBytes(StandardCharsets.UTF_8);
            exchange.sendResponseHeaders(known ? 200 : 404, body.length);
            exchange.getResponseBody().write(body);
            exchange.close();
        });
        server.start();
        base = URI.create("http://127.0.0.1:" + server.getAddress().getPort());
    }

    @AfterEach
    void stop() {
        server.stop(0);
    }

    /** Resolves only the tenants given, like a database holding those connections. */
    private IntegrationConnectionResolver resolver(Map<String, ResolvedConnection> byTenant) {
        return new IntegrationConnectionResolver(null, null, null) {
            @Override
            public ResolvedConnection resolve(String tenantCode, ProviderType providerType) {
                ResolvedConnection connection = byTenant.get(tenantCode);
                if (connection == null || providerType != ProviderType.CAR_IMAGES) {
                    throw new ConnectionResolutionException("none");
                }
                return connection;
            }
        };
    }

    private ResolvedConnection connection(String id, String key, String secret) {
        return new ResolvedConnection(id, base, Map.of(CarImagesKeys.API_KEY, key),
                Map.of(CarImagesKeys.SECRET, secret), AuthType.API_KEY_HEADER, null,
                Map.of("name", CarImagesKeys.SECRET_HEADER));
    }

    private VehicleImages images(Map<String, ResolvedConnection> byTenant) {
        Clock clock = new Clock() {
            @Override
            public java.time.ZoneId getZone() {
                return ZoneOffset.UTC;
            }

            @Override
            public Clock withZone(java.time.ZoneId zone) {
                return this;
            }

            @Override
            public Instant instant() {
                return now.get();
            }
        };
        return new CarImagesVehicleImages(resolver(byTenant), new CarImagesClient(base), clock);
    }

    private static VehicleImages.Query volvo() {
        return new VehicleImages.Query("Volvo", "FH 540", 2022, null, null);
    }

    @Test
    void signsOnTheServerWithTheSecretInTheHeaderAndKeepsTheUrlUntilItExpires() {
        VehicleImages images = images(Map.of("acme", connection("c1", "ci_acme", "s3cret")));

        Optional<VehicleImages.Image> image = images.find("acme", volvo());
        assertTrue(image.isPresent());
        assertEquals(Instant.ofEpochSecond(EXPIRES), image.get().expiresAt());
        assertEquals(List.of("api_key=ci_acme&make=Volvo&model=FH+540&year=2022&width=800"), requests);
        assertEquals(List.of("s3cret"), secrets);

        images.find("acme", volvo());
        assertEquals(1, requests.size());

        now.set(Instant.ofEpochSecond(EXPIRES - 30));
        images.find("acme", volvo());
        assertEquals(2, requests.size());
    }

    @Test
    void usesThePlatformWhenTheOrganizationHasNoProvider() {
        VehicleImages images = images(Map.of(PlatformMailService.PLATFORM_TENANT,
                connection("p1", "ci_platform", "platform-secret")));
        assertTrue(images.find("acme", volvo()).isPresent());
        assertTrue(requests.get(0).startsWith("api_key=ci_platform"));
        assertEquals("platform-secret", secrets.get(0));
    }

    @Test
    void noProviderNoMakeOrUnknownVehicleGiveNothing() {
        assertTrue(images(Map.of()).find("acme", volvo()).isEmpty());

        VehicleImages images = images(Map.of("acme", connection("c1", "ci_acme", "s3cret")));
        assertTrue(images.find("acme", new VehicleImages.Query(" ", null, null, null, null)).isEmpty());
        VehicleImages.Query unknown = new VehicleImages.Query("Unknown", null, null, null, null);
        assertTrue(images.find("acme", unknown).isEmpty());
        assertTrue(images.find("acme", unknown).isEmpty());
        assertEquals(1, requests.size());
    }

    @Test
    void neverSendsTheSecretToAnotherHost() {
        ResolvedConnection elsewhere = new ResolvedConnection("c1", URI.create("https://evil.example"),
                Map.of(CarImagesKeys.API_KEY, "ci_acme"), Map.of(CarImagesKeys.SECRET, "s3cret"),
                AuthType.API_KEY_HEADER, null, Map.of());
        assertTrue(images(Map.of("acme", elsewhere)).find("acme", volvo()).isEmpty());
        assertTrue(requests.isEmpty());
    }
}
