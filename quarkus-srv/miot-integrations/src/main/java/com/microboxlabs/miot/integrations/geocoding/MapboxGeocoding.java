package com.microboxlabs.miot.integrations.geocoding;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.enterprise.context.ApplicationScoped;
import java.io.IOException;
import java.net.URI;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import org.eclipse.microprofile.config.inject.ConfigProperty;

/**
 * Mapbox Geocoding v6, {@code GET /search/geocode/v6/forward}. Asks for permanent results when the connection says
 * so, which Mapbox's terms allow storing. Filters by country and sends no {@code language}, so names come back as
 * the country writes them.
 */
@ApplicationScoped
public class MapboxGeocoding implements GeocodingProvider {

    public static final String PROVIDER_NAME = "mapbox";
    private static final int LIMIT = 5;
    private static final ObjectMapper JSON = new ObjectMapper();

    private final URI baseUrl;

    public MapboxGeocoding(
            @ConfigProperty(name = "miot.integrations.geocoding.mapbox.base-url",
                    defaultValue = "https://api.mapbox.com") URI baseUrl) {
        this.baseUrl = baseUrl;
    }

    @Override
    public String name() {
        return PROVIDER_NAME;
    }

    @Override
    public URI baseUrl() {
        return baseUrl;
    }

    @Override
    public boolean storable(GeocodingConnection connection) {
        return connection.permanent();
    }

    @Override
    public List<Candidate> forward(GeocodingConnection connection, Query query)
            throws IOException, InterruptedException {
        Map<String, String> params = new LinkedHashMap<>();
        params.put("q", GeocodingProvider.text(query));
        if (query.country() != null && !query.country().isBlank()) {
            params.put("country", query.country().strip().toLowerCase(Locale.ROOT));
        }
        params.put("permanent", Boolean.toString(connection.permanent()));
        params.put("limit", Integer.toString(LIMIT));
        params.put("access_token", connection.token());
        var response = GeocodingHttp.get(baseUrl, "/search/geocode/v6/forward", params);
        if (response.statusCode() != 200) {
            throw new IOException("Mapbox answered HTTP " + response.statusCode());
        }
        List<Candidate> out = new ArrayList<>();
        for (JsonNode f : JSON.readTree(response.body()).path("features")) {
            JsonNode c = f.path("geometry").path("coordinates");
            if (c.size() < 2 || !c.get(0).isNumber() || !c.get(1).isNumber()) {
                continue;
            }
            String type = f.path("properties").path("feature_type").asText(null);
            String label = f.path("properties").path("full_address").asText(null);
            out.add(new Candidate(c.get(0).asDouble(), c.get(1).asDouble(), type, "address".equals(type), label));
        }
        return out;
    }
}
