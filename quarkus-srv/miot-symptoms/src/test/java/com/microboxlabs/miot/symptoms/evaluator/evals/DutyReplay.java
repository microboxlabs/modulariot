package com.microboxlabs.miot.symptoms.evaluator.evals;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.microboxlabs.miot.symptoms.catalog.domain.DataSource;
import com.microboxlabs.miot.symptoms.catalog.domain.SymptomState;
import com.microboxlabs.miot.symptoms.catalog.service.SeedTemplates;
import com.microboxlabs.miot.symptoms.duty.DutyChecks;
import com.microboxlabs.miot.symptoms.duty.InMemoryDutyStore;
import com.microboxlabs.miot.symptoms.evaluator.CompiledSymptom;
import com.microboxlabs.miot.symptoms.evaluator.Episode;
import com.microboxlabs.miot.symptoms.evaluator.InMemoryEpisodeStore;
import com.microboxlabs.miot.symptoms.evaluator.SignalEvaluator;
import com.microboxlabs.miot.symptoms.signal.TripCheck;
import java.io.IOException;
import java.io.InputStream;
import java.io.UncheckedIOException;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Replays recorded trips ({@code evals/duty/production-trips.json}) through the duty tracker and the published
 * continuous-driving and continuous-resting templates, frame by frame, with the operators' closes. A frame is
 * {@code [seconds, metres from the previous frame, on the trip]}; the replay lays the frames on a meridian, so
 * the distances, and the speeds between frames, are the recorded ones.
 */
final class DutyReplay {

    static final String DRIVING = "continuous-driving";
    static final String RESTING = "continuous-resting";
    private static final String TENANT = "tenant";
    private static final String ASSET = "vehicle";
    private static final double METRES_PER_DEGREE = 6_371_000 * Math.PI / 180;
    private static final ObjectMapper JSON = new ObjectMapper();

    /** One trip: what production did and what the replay gives, per symptom. */
    record Trip(String id, Map<String, List<String>> expected, Map<String, List<String>> got) {

        boolean same(String symptom) {
            return expected.get(symptom).equals(got.get(symptom));
        }
    }

    private DutyReplay() {
    }

    static JsonNode fixture() {
        try (InputStream in = DutyReplay.class.getResourceAsStream("/evals/duty/production-trips.json")) {
            return JSON.readTree(in);
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        }
    }

    static List<Trip> replayAll() {
        List<Trip> out = new ArrayList<>();
        fixture().get("trips").forEach(t -> out.add(replay(t)));
        return out;
    }

    static Trip replay(JsonNode trip) {
        DataSource source = EvalTraces.source(TripCheck.KEY);
        Map<UUID, String> names = new LinkedHashMap<>();
        List<CompiledSymptom> symptoms = new ArrayList<>();
        for (String key : List.of(DRIVING, RESTING)) {
            CompiledSymptom s = CompiledSymptom.compile(UUID.randomUUID(), "1.0.0", SymptomState.TEST,
                    SeedTemplates.get(key).spec(), source);
            names.put(s.definitionId(), key);
            symptoms.add(s);
        }
        InMemoryEpisodeStore episodes = new InMemoryEpisodeStore();
        SignalEvaluator evaluator = new SignalEvaluator(episodes);
        DutyChecks checks = new DutyChecks(new InMemoryDutyStore());
        Map<String, List<String>> got = new LinkedHashMap<>();
        names.values().forEach(n -> got.put(n, new ArrayList<>()));
        Map<String, Object> onTrip = Map.of("active", true, "id", "T-1",
                "double_driver", trip.get("double_driver").asBoolean());
        Map<String, Object> offTrip = Map.of("active", false, "double_driver", false);
        List<JsonNode> closes = new ArrayList<>();
        trip.get("closes").forEach(closes::add);
        int nextClose = 0;
        double metres = 0;
        for (JsonNode f : trip.get("frames")) {
            int at = f.get(0).asInt();
            while (nextClose < closes.size() && closes.get(nextClose).get(0).asInt() < at) {
                JsonNode c = closes.get(nextClose++);
                close(c.get(0).asInt(), c.get(1).asText(), names, episodes, checks, got);
            }
            metres += f.get(1).asDouble();
            Map<String, Object> gps = Map.of("latitude", -60 + metres / METRES_PER_DEGREE, "longitude", -70.0);
            Map<String, Object> signal = Map.of("trip", f.get(2).asInt() == 1 ? onTrip : offTrip,
                    "frame", Map.of("gps", gps));
            var instant = EvalTraces.T0.plusSeconds(at);
            var check = checks.apply(TENANT, ASSET, instant, signal).orElse(null);
            if (check == null) {
                continue;
            }
            SignalEvaluator.Result r = evaluator.evaluateUnder(DutyChecks.WATERMARK, TENANT, ASSET, instant,
                    Map.of(TripCheck.ROOT, check.check()), symptoms);
            if (!r.errors().isEmpty()) {
                throw new AssertionError(trip.get("id").asText() + " rule error at " + at + " s: " + r.errors());
            }
            r.transitions().forEach(t -> got.get(names.get(t.definitionId()))
                    .add(EvalTraces.transition(t.kind().name(), at, t.previousLevel(), t.level())));
            checks.save(TENANT, ASSET, check.next());
        }
        while (nextClose < closes.size()) {
            JsonNode c = closes.get(nextClose++);
            close(c.get(0).asInt(), c.get(1).asText(), names, episodes, checks, got);
        }
        Map<String, List<String>> expected = new LinkedHashMap<>();
        trip.get("expected").properties().forEach(e -> {
            List<String> list = new ArrayList<>();
            e.getValue().forEach(x -> list.add(EvalTraces.transition(x.get(0).asText(), x.get(1).asInt(),
                    x.get(3).asInt(), x.get(2).asInt())));
            expected.put(e.getKey(), list);
        });
        return new Trip(trip.get("id").asText(), expected, got);
    }

    /** As the evaluator's operator close: the open case's episode goes, and a resting close restarts duty. */
    private static void close(int at, String symptom, Map<UUID, String> names, InMemoryEpisodeStore episodes,
            DutyChecks checks, Map<String, List<String>> got) {
        names.forEach((id, name) -> {
            if (!name.equals(symptom)) {
                return;
            }
            episodes.find(TENANT, ASSET, id).filter(Episode::open).ifPresent(e -> {
                got.get(name).add(EvalTraces.transition("CLOSED_BY_OPERATOR", at, e.level(), e.level()));
                episodes.delete(TENANT, ASSET, id);
            });
            if (RESTING.equals(name)) {
                checks.restartDuty(TENANT, ASSET);
            }
        });
    }
}
