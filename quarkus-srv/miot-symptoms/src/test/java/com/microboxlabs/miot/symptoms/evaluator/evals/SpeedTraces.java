package com.microboxlabs.miot.symptoms.evaluator.evals;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.microboxlabs.miot.symptoms.catalog.domain.SymptomSpec;
import com.microboxlabs.miot.symptoms.catalog.domain.SymptomState;
import com.microboxlabs.miot.symptoms.catalog.service.Specs;
import com.microboxlabs.miot.symptoms.evaluator.CompiledSymptom;
import com.microboxlabs.miot.symptoms.evaluator.InMemoryEpisodeStore;
import com.microboxlabs.miot.symptoms.evaluator.SignalEvaluator;
import com.microboxlabs.miot.symptoms.evaluator.SignalEvaluator.Result;
import java.io.IOException;
import java.io.InputStream;
import java.io.UncheckedIOException;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.TreeMap;
import java.util.UUID;

/**
 * Speed signals replayed through {@link SignalEvaluator}, with transitions written as
 * {@code KIND@seconds:previous>level} so a trace's result compares with what production did.
 */
final class SpeedTraces {

    static final Instant T0 = Instant.parse("2026-01-01T00:00:00Z");
    private static final ObjectMapper JSON = new ObjectMapper();

    /** One signal: seconds from the trace start, speed in km/h, OSM limit (-1 when there is no road). */
    record Signal(int at, double speed, double limit, boolean onTrip) {

        Signal(int at, double speed, double limit) {
            this(at, speed, limit, true);
        }
    }

    /** A vehicle's signals on one trip, and the transitions production produced from them. */
    record Trace(String id, List<Signal> signals, List<String> expected) {
    }

    /** A trace production handles differently for a reason a spec cannot express, and what the evaluator gives. */
    record KnownGap(String reason, List<String> evaluator) {
    }

    private SpeedTraces() {
    }

    static SymptomSpec spec(String resource) {
        try (InputStream in = resource(resource)) {
            return JSON.readValue(in, SymptomSpec.class);
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        }
    }

    static List<Trace> traces(String resource) {
        try (InputStream in = resource(resource)) {
            List<Trace> out = new ArrayList<>();
            for (JsonNode t : JSON.readTree(in).get("traces")) {
                List<Signal> signals = new ArrayList<>();
                t.get("signals").forEach(s -> signals.add(new Signal(s.get(0).asInt(), s.get(1).asDouble(),
                        s.get(2).asDouble())));
                List<String> expected = new ArrayList<>();
                t.get("expected").forEach(e -> expected.add(transition(e.get(0).asText(), e.get(1).asInt(),
                        e.get(3).asInt(), e.get(2).asInt())));
                out.add(new Trace(t.get("id").asText(), signals, expected));
            }
            return out;
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        }
    }

    static Map<String, KnownGap> knownGaps(String resource) {
        try (InputStream in = resource(resource)) {
            Map<String, KnownGap> out = new TreeMap<>();
            JSON.readTree(in).properties().forEach(e -> {
                List<String> evaluator = new ArrayList<>();
                e.getValue().get("evaluator").forEach(t -> evaluator.add(t.asText()));
                out.put(e.getKey(), new KnownGap(e.getValue().get("reason").asText(), evaluator));
            });
            return out;
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        }
    }

    /** Runs the signals through a fresh evaluator; rule errors fail the run. */
    static List<String> replay(SymptomSpec spec, List<Signal> signals) {
        CompiledSymptom symptom = CompiledSymptom.compile(UUID.randomUUID(), "1.0.0", SymptomState.TEST, spec,
                Specs.gpsSignal());
        SignalEvaluator evaluator = new SignalEvaluator(new InMemoryEpisodeStore());
        List<String> out = new ArrayList<>();
        for (Signal s : signals) {
            Result r = evaluator.evaluate("tenant", "vehicle", T0.plusSeconds(s.at()), root(s), List.of(symptom));
            if (!r.errors().isEmpty()) {
                throw new AssertionError("rule error at " + s.at() + " s: " + r.errors());
            }
            r.transitions().forEach(t -> out.add(transition(t.kind().name(), s.at(), t.previousLevel(),
                    t.level())));
        }
        return out;
    }

    static String transition(String kind, int at, int previous, int level) {
        return kind + "@" + at + ":" + previous + ">" + level;
    }

    private static Map<String, Object> root(Signal s) {
        return Map.of("signal", Map.of(
                "trip", Map.of("active", s.onTrip()),
                "vehicle", Map.of("weight_category", "HEAVY"),
                "gps", Map.of("speed_kmh", s.speed()),
                "road", Map.of("maxspeed_osm", s.limit())));
    }

    private static InputStream resource(String name) {
        InputStream in = SpeedTraces.class.getResourceAsStream("/evals/speed/" + name);
        if (in == null) {
            throw new IllegalStateException("missing test resource evals/speed/" + name);
        }
        return in;
    }
}
