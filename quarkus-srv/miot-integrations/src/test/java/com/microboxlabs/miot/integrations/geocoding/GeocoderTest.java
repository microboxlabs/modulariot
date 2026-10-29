package com.microboxlabs.miot.integrations.geocoding;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.microboxlabs.miot.integrations.domain.AuthType;
import com.microboxlabs.miot.integrations.domain.CredentialType;
import com.microboxlabs.miot.integrations.domain.ProviderType;
import com.microboxlabs.miot.integrations.email.PlatformMailService;
import com.microboxlabs.miot.integrations.geocoding.GeocodingProvider.Query;
import com.microboxlabs.miot.integrations.service.ConnectionNotConfiguredException;
import com.microboxlabs.miot.integrations.service.IntegrationConnectionResolver;
import com.microboxlabs.miot.integrations.service.ManagedCredentials;
import com.microboxlabs.miot.integrations.service.ResolvedConnection;
import com.sun.net.httpserver.HttpServer;
import java.io.IOException;
import java.math.BigDecimal;
import java.net.InetSocketAddress;
import java.net.URI;
import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

/** Against local stand-ins for Mapbox and Google. */
class GeocoderTest {

    private static final String MAPBOX = """
            {"type":"FeatureCollection","features":[
              {"type":"Feature","geometry":{"type":"Point","coordinates":[-77.0297,-12.1211]},
               "properties":{"feature_type":"address","full_address":"Avenida Larco 101, Miraflores, Lima, Peru"}},
              {"type":"Feature","geometry":{"type":"Point","coordinates":[-77.03,-12.12]},
               "properties":{"feature_type":"street","full_address":"Avenida Larco, Miraflores"}}]}""";

    private static final String GOOGLE = """
            {"status":"OK","results":[
              {"types":["route"],"formatted_address":"Av. Larco, Miraflores",
               "geometry":{"location":{"lat":-12.12,"lng":-77.03}}},
              {"types":["premise"],"formatted_address":"Av. Larco 101, Miraflores",
               "geometry":{"location":{"lat":-12.1211,"lng":-77.0297}}}]}""";

    private HttpServer server;
    private URI base;
    private final List<Map<String, String>> requests = new ArrayList<>();
    private final List<String> paths = new ArrayList<>();
    private String googleBody = GOOGLE;
    private int status = 200;

    @BeforeEach
    void start() throws IOException {
        server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        server.createContext("/", exchange -> {
            paths.add(exchange.getRequestURI().getPath());
            requests.add(query(exchange.getRequestURI().getRawQuery()));
            byte[] body = (exchange.getRequestURI().getPath().startsWith("/maps") ? googleBody : MAPBOX)
                    .getBytes(StandardCharsets.UTF_8);
            exchange.sendResponseHeaders(status, body.length);
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

    private static Map<String, String> query(String raw) {
        Map<String, String> out = new HashMap<>();
        for (String pair : raw.split("&")) {
            String[] kv = pair.split("=", 2);
            out.put(kv[0], URLDecoder.decode(kv.length > 1 ? kv[1] : "", StandardCharsets.UTF_8));
        }
        return out;
    }

    private static final String PLATFORM = PlatformMailService.PLATFORM_TENANT;
    private static final String ORG = "acme";

    private IntegrationConnectionResolver resolver(Map<String, ResolvedConnection> byTenant) {
        return new IntegrationConnectionResolver(null, null, null) {
            @Override
            public ResolvedConnection resolve(String tenantCode, ProviderType providerType) {
                ResolvedConnection c = byTenant.get(tenantCode);
                if (c == null || providerType != ProviderType.GEOCODING) {
                    throw new ConnectionNotConfiguredException("none");
                }
                return c;
            }
        };
    }

    private ResolvedConnection connection(URI url, Map<String, Object> metadata) {
        return new ResolvedConnection("c1", url, metadata, Map.of(GeocodingConnection.TOKEN_KEY, "tok"));
    }

    /** The organization's managed connection: no secret, no metadata. */
    private static ResolvedConnection managed() {
        return new ResolvedConnection("org-1", null, Map.of(), Map.of(), AuthType.BEARER_TOKEN,
                CredentialType.BEARER_TOKEN, Map.of(ManagedCredentials.MANAGED, true));
    }

    /** {@link #ORG} has its managed connection unless {@code byTenant} says otherwise. */
    private Geocoder geocoder(Map<String, ResolvedConnection> byTenant, boolean googleStorable) {
        Map<String, ResolvedConnection> all = new HashMap<>(byTenant);
        all.putIfAbsent(ORG, managed());
        return bare(all, googleStorable);
    }

    private Geocoder bare(Map<String, ResolvedConnection> byTenant, boolean googleStorable) {
        return new Geocoder(resolver(byTenant),
                List.of(new MapboxGeocoding(base), new GoogleGeocoding(base, googleStorable)));
    }

    private static Query larco() {
        return new Query("Av. Larco 101", "Miraflores", "PE");
    }

    @Test
    void mapboxAsksForPermanentResultsInTheCountryWithoutLanguage() {
        Geocoder.Result r = geocoder(Map.of(PLATFORM, connection(base,
                Map.of(GeocodingConnection.COST, "0.005"))), false).forward(ORG, larco());

        assertEquals("mapbox", r.provider());
        assertTrue(r.called());
        assertTrue(r.storable());
        assertEquals(new BigDecimal("0.005"), r.costUsd());
        assertEquals(List.of("/search/geocode/v6/forward"), paths);
        Map<String, String> q = requests.get(0);
        assertEquals("Av. Larco 101, Miraflores", q.get("q"));
        assertEquals("pe", q.get("country"));
        assertEquals("true", q.get("permanent"));
        assertEquals("tok", q.get("access_token"));
        assertFalse(q.containsKey("language"));
        assertEquals(2, r.candidates().size());
        assertTrue(r.candidates().get(0).addressLevel());
        assertEquals(-77.0297, r.candidates().get(0).lon());
        assertFalse(r.candidates().get(1).addressLevel());
    }

    @Test
    void aTemporaryMapboxConnectionIsNotStorable() {
        Geocoder.Result r = geocoder(Map.of(PLATFORM, connection(base,
                Map.of(GeocodingConnection.PERMANENT_KEY, "false"))), false).forward(ORG, larco());

        assertFalse(r.storable());
        assertEquals("false", requests.get(0).get("permanent"));
        assertNull(r.costUsd());
    }

    @Test
    void googleIsChosenByTheConnectionAndIsNotStorableByDefault() {
        Geocoder.Result r = geocoder(Map.of(PLATFORM, connection(base,
                Map.of(GeocodingConnection.PROVIDER_KEY, "google"))), false).forward(ORG, larco());

        assertEquals("google", r.provider());
        assertFalse(r.storable());
        assertEquals(List.of("/maps/api/geocode/json"), paths);
        assertEquals("country:PE", requests.get(0).get("components"));
        assertEquals("tok", requests.get(0).get("key"));
        assertFalse(r.candidates().get(0).addressLevel());
        assertTrue(r.candidates().get(1).addressLevel());
        assertEquals("premise", r.candidates().get(1).type());
    }

    @Test
    void googleStorableIsAFlagOnTheProvider() {
        Geocoder.Result r = geocoder(Map.of(PLATFORM, connection(base,
                Map.of(GeocodingConnection.PROVIDER_KEY, "google"))), true).forward(ORG, larco());

        assertTrue(r.storable());
    }

    @Test
    void googleZeroResultsIsAnAnsweredEmptyCall() {
        googleBody = "{\"status\":\"ZERO_RESULTS\",\"results\":[]}";
        Geocoder.Result r = geocoder(Map.of(PLATFORM, connection(base,
                Map.of(GeocodingConnection.PROVIDER_KEY, "google"))), false).forward(ORG, larco());

        assertTrue(r.called());
        assertTrue(r.candidates().isEmpty());
    }

    @Test
    void googleDeniedIsAnError() {
        googleBody = "{\"status\":\"REQUEST_DENIED\",\"error_message\":\"bad key tok\"}";
        Geocoder.Result r = geocoder(Map.of(PLATFORM, connection(base,
                Map.of(GeocodingConnection.PROVIDER_KEY, "google"))), false).forward(ORG, larco());

        assertFalse(r.called());
        assertEquals("Google answered REQUEST_DENIED", r.error());
    }

    @Test
    void anHttpErrorDoesNotQuoteTheToken() {
        status = 401;
        Geocoder.Result r = geocoder(Map.of(PLATFORM, connection(base, Map.of())), false).forward(ORG, larco());

        assertFalse(r.called());
        assertEquals("Mapbox answered HTTP 401", r.error());
    }

    @Test
    void anOrganizationWithoutItsOwnConnectionGetsNoCall() {
        Geocoder.Result r = bare(Map.of(PLATFORM, connection(base, Map.of())), false).forward(ORG, larco());

        assertNull(r.provider());
        assertFalse(r.called());
        assertEquals("this organization has no geocoding connection; a platform owner adds it in Conexiones",
                r.error());
        assertTrue(requests.isEmpty());
    }

    /** A connection the organization made itself, with its own token, is not the platform's managed one. */
    @Test
    void anOrganizationConnectionThatIsNotManagedIsRefused() {
        Geocoder.Result r = geocoder(Map.of(PLATFORM, connection(base, Map.of()),
                ORG, connection(base, Map.of())), false).forward(ORG, larco());

        assertFalse(r.called());
        assertEquals("this organization's geocoding connection is not managed by the platform", r.error());
        assertTrue(requests.isEmpty());
    }

    @Test
    void theOrganizationConnectionCarriesNoCost() {
        Geocoder.Result r = geocoder(Map.of(PLATFORM, connection(base, Map.of(GeocodingConnection.COST, "0.005")),
                ORG, new ResolvedConnection("org-1", null, Map.of(GeocodingConnection.COST, "9"), Map.of(),
                        AuthType.BEARER_TOKEN, CredentialType.BEARER_TOKEN,
                        Map.of(ManagedCredentials.MANAGED, true))), false).forward(ORG, larco());

        assertTrue(r.called());
        assertEquals(new BigDecimal("0.005"), r.costUsd());
        assertEquals("tok", requests.get(0).get("access_token"));
    }

    @Test
    void noPlatformProviderMeansNoCall() {
        Geocoder.Result r = geocoder(Map.of(), false).forward(ORG, larco());

        assertNull(r.provider());
        assertFalse(r.called());
        assertEquals("the platform has no geocoding provider", r.error());
        assertTrue(requests.isEmpty());
    }

    @Test
    void theTokenIsNotSentToAnotherHost() {
        Geocoder.Result r = geocoder(Map.of(PLATFORM, connection(URI.create("https://evil.example"), Map.of())),
                false).forward(ORG, larco());

        assertFalse(r.called());
        assertTrue(requests.isEmpty());
        assertTrue(r.error().startsWith("the geocoding connection must use "));
    }

    @Test
    void anUnknownProviderIsAnError() {
        Geocoder.Result r = geocoder(Map.of(PLATFORM, connection(base,
                Map.of(GeocodingConnection.PROVIDER_KEY, "here"))), false).forward(ORG, larco());

        assertEquals("unknown geocoding provider here", r.error());
        assertTrue(requests.isEmpty());
    }
}
