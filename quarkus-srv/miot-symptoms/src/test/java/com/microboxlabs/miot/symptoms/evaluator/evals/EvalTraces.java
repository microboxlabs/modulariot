package com.microboxlabs.miot.symptoms.evaluator.evals;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.microboxlabs.miot.symptoms.catalog.domain.DataSource;
import com.microboxlabs.miot.symptoms.catalog.domain.SymptomSpec;
import com.microboxlabs.miot.symptoms.catalog.domain.SymptomState;
import com.microboxlabs.miot.symptoms.catalog.service.DataSourceService;
import com.microboxlabs.miot.symptoms.catalog.service.InMemoryCatalog;
import com.microboxlabs.miot.symptoms.engine.UnavailableSymptomEngine;
import com.microboxlabs.miot.symptoms.evaluator.CompiledSymptom;
import com.microboxlabs.miot.symptoms.evaluator.InMemoryEpisodeStore;
import com.microboxlabs.miot.symptoms.evaluator.SignalEvaluator.Result;
import com.microboxlabs.miot.symptoms.evaluator.SignalEvaluator;
import java.io.IOException;
import java.io.InputStream;
import java.io.UncheckedIOException;
import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.TreeMap;
import java.util.UUID;

/**
 * Signals replayed through {@link SignalEvaluator}, with transitions written as
 * {@code KIND@seconds:previous>level} so a trace's result compares with what production did.
 *
 * <p>A trace file ({@code evals/<symptom>/production-traces.json}) names its source, the field paths of each
 * signal row after the time ({@code columns}), and values shared by every signal ({@code constants}), for
 * the whole file or one trace.
 */
final class EvalTraces {

    static final Instant T0 = Instant.parse("2026-01-01T00:00:00Z");
    private static final ObjectMapper JSON = new ObjectMapper();

    /** One signal: seconds from the trace start, and the source's object as the rules read it. */
    record Signal(int at, Map<String, Object> root) {
    }

    /** A vehicle's signals on one trip, and the transitions production produced from them. */
    record Trace(String id, List<Signal> signals, List<String> expected) {
    }

    record Fixture(String source, List<Trace> traces) {
    }

    /** A trace production handles differently for a reason a spec cannot express, and what the evaluator gives. */
    record KnownGap(String reason, List<String> evaluator) {
    }

    private EvalTraces() {
    }

    static SymptomSpec spec(String symptom, String file) {
        try (InputStream in = resource(symptom, file)) {
            return JSON.readValue(in, SymptomSpec.class);
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        }
    }

    static Fixture fixture(String symptom, String file) {
        try (InputStream in = resource(symptom, file)) {
            JsonNode doc = JSON.readTree(in);
            List<String> columns = new ArrayList<>();
            doc.get("columns").forEach(c -> columns.add(c.asText()));
            Map<String, Object> shared = values(doc.get("constants"));
            List<Trace> traces = new ArrayList<>();
            for (JsonNode t : doc.get("traces")) {
                Map<String, Object> constants = new LinkedHashMap<>(shared);
                constants.putAll(values(t.get("constants")));
                List<Signal> signals = new ArrayList<>();
                for (JsonNode row : t.get("signals")) {
                    Map<String, Object> flat = new LinkedHashMap<>(constants);
                    for (int i = 0; i < columns.size(); i++) {
                        flat.put(columns.get(i), value(row.get(i + 1)));
                    }
                    signals.add(new Signal(row.get(0).asInt(), root(flat)));
                }
                List<String> expected = new ArrayList<>();
                t.get("expected").forEach(e -> expected.add(transition(e.get(0).asText(), e.get(1).asInt(),
                        e.get(3).asInt(), e.get(2).asInt())));
                traces.add(new Trace(t.get("id").asText(), signals, expected));
            }
            return new Fixture(doc.get("source").asText(), traces);
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        }
    }

    static Map<String, KnownGap> knownGaps(String symptom, String file) {
        try (InputStream in = resource(symptom, file)) {
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

    /** The platform data source with this key, as a new organization gets it. */
    static DataSource source(String key) {
        return new DataSourceService(new InMemoryCatalog(), new UnavailableSymptomEngine()).find("tenant", key)
                .orElseThrow();
    }

    /** Runs the signals through a fresh evaluator; rule errors fail the run. */
    static List<String> replay(SymptomSpec spec, DataSource source, List<Signal> signals) {
        CompiledSymptom symptom = CompiledSymptom.compile(UUID.randomUUID(), "1.0.0", SymptomState.TEST, spec,
                source);
        SignalEvaluator evaluator = new SignalEvaluator(new InMemoryEpisodeStore());
        List<String> out = new ArrayList<>();
        for (Signal s : signals) {
            Result r = evaluator.evaluate("tenant", "vehicle", T0.plusSeconds(s.at()), s.root(), List.of(symptom));
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

    /** Dotted field paths to nested objects: {@code signal.gps.moving} becomes {@code {signal: {gps: {moving}}}}. */
    @SuppressWarnings("unchecked")
    static Map<String, Object> root(Map<String, Object> flat) {
        Map<String, Object> root = new LinkedHashMap<>();
        flat.forEach((path, value) -> {
            String[] parts = path.split("\\.");
            Map<String, Object> node = root;
            for (int i = 0; i < parts.length - 1; i++) {
                node = (Map<String, Object>) node.computeIfAbsent(parts[i], k -> new LinkedHashMap<String, Object>());
            }
            node.put(parts[parts.length - 1], value);
        });
        return root;
    }

    private static Map<String, Object> values(JsonNode node) {
        Map<String, Object> out = new LinkedHashMap<>();
        if (node != null) {
            node.properties().forEach(e -> out.put(e.getKey(), value(e.getValue())));
        }
        return out;
    }

    private static Object value(JsonNode v) {
        if (v.isBoolean()) {
            return v.asBoolean();
        }
        if (v.isNumber()) {
            return v.asDouble();
        }
        return v.asText();
    }

    private static InputStream resource(String symptom, String file) {
        String name = "/evals/" + symptom + "/" + file;
        InputStream in = EvalTraces.class.getResourceAsStream(name);
        if (in == null) {
            throw new IllegalStateException("missing test resource " + name);
        }
        return in;
    }
}
