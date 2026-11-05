package com.microboxlabs.miot.symptoms.evaluator.evals;

import static org.junit.jupiter.api.Assertions.assertEquals;

import com.microboxlabs.miot.symptoms.catalog.domain.DataSource;
import com.microboxlabs.miot.symptoms.catalog.domain.SymptomSpec;
import com.microboxlabs.miot.symptoms.catalog.service.SeedTemplates;
import com.microboxlabs.miot.symptoms.evaluator.evals.EvalTraces.Fixture;
import com.microboxlabs.miot.symptoms.evaluator.evals.EvalTraces.Signal;
import com.microboxlabs.miot.symptoms.evaluator.evals.EvalTraces.Trace;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import com.microboxlabs.miot.symptoms.catalog.domain.SymptomState;
import com.microboxlabs.miot.symptoms.evaluator.CompiledSymptom;
import com.microboxlabs.miot.symptoms.evaluator.Episode;
import com.microboxlabs.miot.symptoms.evaluator.InMemoryEpisodeStore;
import com.microboxlabs.miot.symptoms.evaluator.SignalEvaluator;
import java.util.UUID;
import org.junit.jupiter.api.Test;

/**
 * The zone and hour templates (V0.12.19) on the real trips of their evals, against production's transitions. The
 * traces are written in the fields of the eval's production rule, so each signal is read as the signal builder
 * writes it: {@code local_hour} the whole hour and {@code local_minutes} the minutes of the day; in the night-stop
 * traces, "inside an authorized zone" is the GPS database's opposite of {@code outside_authorized}.
 */
@SuppressWarnings("unchecked")
class ZoneTemplatesParityTest {

    private static final DataSource GPS = EvalTraces.source("gps_signal");

    @SuppressWarnings("unchecked")
    static Signal asBuilt(Signal s, boolean authorizedMeansNotOutside) {
        Map<String, Object> signal = new LinkedHashMap<>((Map<String, Object>) s.root().get("signal"));
        if (signal.get("local_hour") instanceof Number h) {
            signal.put("local_hour", (int) Math.floor(h.doubleValue()));
            signal.put("local_minutes", h.doubleValue() * 60.0);
        }
        if (signal.get("geo") instanceof Map<?, ?> g && authorizedMeansNotOutside) {
            Map<String, Object> geo = new LinkedHashMap<>((Map<String, Object>) g);
            Object inside = geo.remove("authorized_zone");
            geo.put("outside_authorized", !Boolean.TRUE.equals(inside));
            signal.put("geo", geo);
        }
        return new Signal(s.at(), Map.of("signal", signal));
    }

    /** The trips where the template's transitions differ from production's. */
    private static List<String> differing(String template, String folder, boolean authorizedMeansNotOutside) {
        SymptomSpec spec = SeedTemplates.get(template).spec();
        Fixture fixture = EvalTraces.fixture(folder, "production-traces.json");
        List<String> out = new ArrayList<>();
        for (Trace t : fixture.traces()) {
            List<String> got = EvalTraces.replay(spec, GPS,
                    t.signals().stream().map(s -> asBuilt(s, authorizedMeansNotOutside)).toList());
            if (!got.equals(t.expected())) {
                out.add(t.id());
            }
        }
        System.out.printf("%s on %s: %d trips, %d differ%n", template, folder, fixture.traces().size(), out.size());
        return out;
    }

    @Test
    void riskZoneStopMatchesProductionOnEveryTrip() {
        assertEquals(List.of(), differing("risk-zone-stop", "risk-zone-stop", false));
    }

    @Test
    void nightRiskStayMatchesProductionOnEveryTrip() {
        assertEquals(List.of(), differing("night-risk-stay", "night-risk-stay", false));
    }

    @Test
    void offHoursDrivingMatchesProductionOnEveryTripIncludingTheFortyFiveMinuteClock() {
        assertEquals(List.of(), differing("off-hours-driving", "off-hours-driving", false),
                "level 4 counts open_s, the time since the case opened, as production does");
    }

    @Test
    void nightStopMatchesProductionOnEveryTripWithTheOperatorsCloses() throws Exception {
        SymptomSpec spec = SeedTemplates.get("night-stop-unauthorized").spec();
        Fixture fixture = EvalTraces.fixture("night-stop-unauthorized", "production-traces.json");
        Map<String, Integer> closes = operatorCloses("night-stop-unauthorized");
        List<String> differ = new ArrayList<>();
        for (Trace t : fixture.traces()) {
            List<String> got = replayWithOperatorClose(spec,
                    t.signals().stream().map(s -> asBuilt(s, true)).toList(), closes.get(t.id()));
            if (!got.equals(t.expected())) {
                differ.add(t.id() + "\n  production " + t.expected() + "\n  template   " + got);
            }
        }
        System.out.printf("night-stop-unauthorized with operator closes: %d trips, %d differ%n",
                fixture.traces().size(), differ.size());
        assertEquals(List.of(), differ);
    }

    /** {@code operatorClosedAt} per trip: when an operator's treatment of its case expired. */
    private static Map<String, Integer> operatorCloses(String folder) throws Exception {
        Map<String, Integer> out = new LinkedHashMap<>();
        try (var in = ZoneTemplatesParityTest.class.getResourceAsStream("/evals/" + folder + "/production-traces.json")) {
            for (var t : new com.fasterxml.jackson.databind.ObjectMapper().readTree(in).get("traces")) {
                if (t.hasNonNull("operatorClosedAt")) {
                    out.put(t.get("id").asText(), t.get("operatorClosedAt").asInt());
                }
            }
        }
        return out;
    }

    /**
     * The signals on one trip, with the operator closing the case at {@code closeAt} as the treatment API does:
     * the case closes and the episode keeps the trip ({@code EvaluatorStream.forget} with the trip).
     */
    private static List<String> replayWithOperatorClose(SymptomSpec spec, List<Signal> signals, Integer closeAt) {
        UUID id = UUID.randomUUID();
        CompiledSymptom symptom = CompiledSymptom.compile(id, "1.0.0", SymptomState.TEST, spec, GPS);
        InMemoryEpisodeStore store = new InMemoryEpisodeStore();
        SignalEvaluator evaluator = new SignalEvaluator(store);
        List<String> out = new ArrayList<>();
        boolean closed = closeAt == null;
        for (Signal s : signals) {
            if (!closed && s.at() >= closeAt) {
                closed = true;
                store.find("tenant", "vehicle", id).filter(Episode::open).ifPresent(e -> out.add(
                        EvalTraces.transition("CLOSED", closeAt, e.level(), e.level())));
                store.save("tenant", Episode.closedOnTrip(id, "vehicle", "trip-1", EvalTraces.T0.plusSeconds(closeAt)));
            }
            Map<String, Object> signal = new LinkedHashMap<>((Map<String, Object>) s.root().get("signal"));
            Map<String, Object> trip = new LinkedHashMap<>((Map<String, Object>) signal.get("trip"));
            trip.put("id", "trip-1");
            signal.put("trip", trip);
            var r = evaluator.evaluate("tenant", "vehicle", EvalTraces.T0.plusSeconds(s.at()), Map.of("signal", signal),
                    List.of(symptom));
            r.transitions().forEach(t -> out.add(EvalTraces.transition(t.kind().name(), s.at(), t.previousLevel(),
                    t.level())));
        }
        return out;
    }
}
