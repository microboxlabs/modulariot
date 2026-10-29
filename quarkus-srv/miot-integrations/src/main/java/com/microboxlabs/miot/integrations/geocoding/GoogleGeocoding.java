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
import java.util.Set;
import org.eclipse.microprofile.config.inject.ConfigProperty;

/**
 * Google Geocoding API, {@code GET /maps/api/geocode/json}. Its results are not stored until Google's terms are
 * confirmed: {@code miot.integrations.geocoding.google.storable} is false by default.
 */
@ApplicationScoped
public class GoogleGeocoding implements GeocodingProvider {

    public static final String NAME = "google";
    private static final Set<String> ADDRESS_TYPES = Set.of("street_address", "premise", "subpremise");
    private static final ObjectMapper JSON = new ObjectMapper();

    private final URI baseUrl;
    private final boolean storable;

    public GoogleGeocoding(
            @ConfigProperty(name = "miot.integrations.geocoding.google.base-url",
                    defaultValue = "https://maps.googleapis.com") URI baseUrl,
            @ConfigProperty(name = "miot.integrations.geocoding.google.storable", defaultValue = "false")
            boolean storable) {
        this.baseUrl = baseUrl;
        this.storable = storable;
    }

    @Override
    public String name() {
        return NAME;
    }

    @Override
    public URI baseUrl() {
        return baseUrl;
    }

    @Override
    public boolean storable(GeocodingConnection connection) {
        return storable;
    }

    @Override
    public List<Candidate> forward(GeocodingConnection connection, Query query)
            throws IOException, InterruptedException {
        Map<String, String> params = new LinkedHashMap<>();
        params.put("address", GeocodingProvider.text(query));
        if (query.country() != null && !query.country().isBlank()) {
            params.put("components", "country:" + query.country().strip().toUpperCase(Locale.ROOT));
        }
        params.put("key", connection.token());
        var response = GeocodingHttp.get(baseUrl, "/maps/api/geocode/json", params);
        if (response.statusCode() != 200) {
            throw new IOException("Google answered HTTP " + response.statusCode());
        }
        JsonNode body = JSON.readTree(response.body());
        String status = body.path("status").asText("");
        if ("ZERO_RESULTS".equals(status)) {
            return List.of();
        }
        if (!"OK".equals(status)) {
            throw new IOException("Google answered " + status);
        }
        List<Candidate> out = new ArrayList<>();
        for (JsonNode r : body.path("results")) {
            JsonNode loc = r.path("geometry").path("location");
            if (!loc.path("lat").isNumber() || !loc.path("lng").isNumber()) {
                continue;
            }
            List<String> types = new ArrayList<>();
            r.path("types").forEach(t -> types.add(t.asText()));
            boolean address = types.stream().anyMatch(ADDRESS_TYPES::contains);
            out.add(new Candidate(loc.get("lng").asDouble(), loc.get("lat").asDouble(),
                    types.isEmpty() ? null : types.get(0), address, r.path("formatted_address").asText(null)));
        }
        return out;
    }
}
