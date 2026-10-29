package com.microboxlabs.miot.trips.geo;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import io.quarkus.arc.properties.IfBuildProperty;
import jakarta.enterprise.context.ApplicationScoped;
import java.io.IOException;
import java.io.InputStream;
import java.io.UncheckedIOException;
import java.text.Normalizer;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.zip.GZIPInputStream;

/**
 * Peru's districts and Chile's communes, read once from {@code geo/*.json.gz} and kept in memory. A district's
 * {@code shape} is null when the source has no geometry for it.
 */
@ApplicationScoped
@IfBuildProperty(name = "miot.component.trips.enabled", stringValue = "true")
public class AdminBoundaries {

    public record Boundary(String country, String code, String name, String province, String region,
            List<Double> centroid, List<Double> bbox, GeoShape shape) {

        public Boundary {
            centroid = List.copyOf(centroid);
            bbox = List.copyOf(bbox);
        }

        boolean mayContain(double lon, double lat) {
            return bbox.size() == 4 && lon >= bbox.get(0) && lon <= bbox.get(2)
                    && lat >= bbox.get(1) && lat <= bbox.get(3);
        }
    }

    private static final Map<String, String> FILES = Map.of("PE", "/geo/districts-pe.json.gz",
            "CL", "/geo/communes-cl.json.gz");
    private static final Map<String, Integer> CODE_DIGITS = Map.of("PE", 6, "CL", 5);
    private static final ObjectMapper JSON = new ObjectMapper();

    private final Map<String, List<Boundary>> byCountry = new HashMap<>();

    public boolean supports(String country) {
        return FILES.containsKey(country);
    }

    /** By code; a code sent as a number that lost its leading zeros is padded. */
    public Optional<Boundary> byCode(String country, String code) {
        String c = normalizeCode(country, code);
        return c == null ? Optional.empty() : all(country).stream().filter(b -> b.code().equals(c)).findFirst();
    }

    /** By name, ignoring case, accents and repeated spaces; several when the name repeats in the country. */
    public List<Boundary> byName(String country, String name) {
        if (name == null || name.isBlank()) {
            return List.of();
        }
        String n = fold(name);
        return all(country).stream().filter(b -> fold(b.name()).equals(n)).toList();
    }

    public Optional<Boundary> containing(String country, double lon, double lat) {
        return all(country).stream()
                .filter(b -> b.shape() != null && b.mayContain(lon, lat) && b.shape().contains(lon, lat))
                .findFirst();
    }

    public String normalizeCode(String country, String code) {
        Integer digits = CODE_DIGITS.get(country);
        if (digits == null || code == null || !code.strip().matches("\\d{1," + digits + "}")) {
            return null;
        }
        String c = code.strip();
        return "0".repeat(digits - c.length()) + c;
    }

    static String fold(String s) {
        return Normalizer.normalize(s, Normalizer.Form.NFD).replaceAll("\\p{M}", "")
                .strip().replaceAll("\\s+", " ").toUpperCase(Locale.ROOT);
    }

    private synchronized List<Boundary> all(String country) {
        String file = FILES.get(country);
        if (file == null) {
            return List.of();
        }
        return byCountry.computeIfAbsent(country, c -> load(c, file));
    }

    private static List<Boundary> load(String country, String file) {
        try (InputStream in = AdminBoundaries.class.getResourceAsStream(file)) {
            if (in == null) {
                throw new IllegalStateException(file + " is missing");
            }
            List<Boundary> out = new ArrayList<>();
            for (JsonNode b : JSON.readTree(new GZIPInputStream(in)).path("boundaries")) {
                JsonNode geometry = b.get("geometry");
                out.add(new Boundary(country, b.path("code").asText(), b.path("name").asText(),
                        b.path("province").asText(null), b.path("region").asText(null),
                        doubles(b.get("centroid")), doubles(b.get("bbox")),
                        geometry == null ? null : GeoShape.of(geometry)));
            }
            return List.copyOf(out);
        } catch (IOException e) {
            throw new UncheckedIOException(file + " is unreadable", e);
        }
    }

    private static List<Double> doubles(JsonNode array) {
        if (array == null || !array.isArray()) {
            return List.of();
        }
        List<Double> out = new ArrayList<>(array.size());
        for (JsonNode value : array) out.add(value.asDouble());
        return List.copyOf(out);
    }
}
