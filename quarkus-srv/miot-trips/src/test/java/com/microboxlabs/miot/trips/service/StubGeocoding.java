package com.microboxlabs.miot.trips.service;

import com.microboxlabs.miot.integrations.domain.ProviderType;
import com.microboxlabs.miot.integrations.geocoding.Geocoder;
import com.microboxlabs.miot.integrations.geocoding.GeocodingConnection;
import com.microboxlabs.miot.integrations.geocoding.GoogleGeocoding;
import com.microboxlabs.miot.integrations.geocoding.MapboxGeocoding;
import com.microboxlabs.miot.integrations.service.ConnectionNotConfiguredException;
import com.microboxlabs.miot.integrations.service.IntegrationConnectionResolver;
import com.microboxlabs.miot.integrations.service.ResolvedConnection;
import com.sun.net.httpserver.HttpServer;
import java.io.IOException;
import java.io.UncheckedIOException;
import java.net.InetSocketAddress;
import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

/** A local stand-in for Mapbox and Google, and a {@link Geocoder} that reaches it through a tenant's connection. */
public final class StubGeocoding implements AutoCloseable {

    final List<String> queries = new ArrayList<>();
    private final Map<String, Object> metadata = new HashMap<>();
    private final HttpServer server;
    private final URI base;
    private String body = features();

    public StubGeocoding() {
        try {
            server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        }
        server.createContext("/", exchange -> {
            queries.add(exchange.getRequestURI().getRawQuery());
            byte[] bytes = body.getBytes(StandardCharsets.UTF_8);
            exchange.sendResponseHeaders(200, bytes.length);
            exchange.getResponseBody().write(bytes);
            exchange.close();
        });
        server.start();
        base = URI.create("http://127.0.0.1:" + server.getAddress().getPort());
        metadata.put(GeocodingConnection.COST, "0.00075");
    }

    StubGeocoding answer(String body) {
        this.body = body;
        return this;
    }

    StubGeocoding metadata(String key, String value) {
        metadata.put(key, value);
        return this;
    }

    /** A Mapbox v6 answer: {@code type, lon, lat} per feature. */
    static String features(Object... typeLonLat) {
        StringBuilder sb = new StringBuilder("{\"type\":\"FeatureCollection\",\"features\":[");
        for (int i = 0; i < typeLonLat.length; i += 3) {
            sb.append(i == 0 ? "" : ",").append(String.format(Locale.ROOT,
                    "{\"type\":\"Feature\",\"geometry\":{\"type\":\"Point\",\"coordinates\":[%s,%s]},"
                            + "\"properties\":{\"feature_type\":\"%s\"}}",
                    typeLonLat[i + 1], typeLonLat[i + 2], typeLonLat[i]));
        }
        return sb.append("]}").toString();
    }

    /** A Google answer: {@code type, lon, lat} per result. */
    static String results(Object... typeLonLat) {
        StringBuilder sb = new StringBuilder("{\"status\":\"OK\",\"results\":[");
        for (int i = 0; i < typeLonLat.length; i += 3) {
            sb.append(i == 0 ? "" : ",").append(String.format(Locale.ROOT,
                    "{\"types\":[\"%s\"],\"geometry\":{\"location\":{\"lat\":%s,\"lng\":%s}}}",
                    typeLonLat[i], typeLonLat[i + 2], typeLonLat[i + 1]));
        }
        return sb.append("]}").toString();
    }

    /** Resolves a connection for {@code tenant} only. */
    Geocoder geocoder(String tenant) {
        IntegrationConnectionResolver resolver = new IntegrationConnectionResolver(null, null, null) {
            @Override
            public ResolvedConnection resolve(String tenantCode, ProviderType providerType) {
                if (!tenant.equals(tenantCode) || providerType != ProviderType.GEOCODING) {
                    throw new ConnectionNotConfiguredException("none");
                }
                return new ResolvedConnection("geo-1", base, Map.copyOf(metadata),
                        Map.of(GeocodingConnection.TOKEN, "pk.test"));
            }
        };
        return new Geocoder(resolver, List.of(new MapboxGeocoding(base), new GoogleGeocoding(base, false)));
    }

    /** A geocoder with no connection anywhere: it never calls out. */
    public static Geocoder none() {
        return new Geocoder(new IntegrationConnectionResolver(null, null, null) {
            @Override
            public ResolvedConnection resolve(String tenantCode, ProviderType providerType) {
                throw new ConnectionNotConfiguredException("none");
            }
        }, List.of());
    }

    @Override
    public void close() {
        server.stop(0);
    }
}
