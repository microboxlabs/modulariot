package com.microboxlabs.miot.symptoms.evaluator;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.microboxlabs.miot.symptoms.catalog.domain.DataSource;
import com.microboxlabs.miot.symptoms.catalog.domain.SymptomSpec;
import com.microboxlabs.miot.symptoms.catalog.domain.SymptomSpec.Lifecycle;
import com.microboxlabs.miot.symptoms.catalog.domain.SymptomState;
import com.microboxlabs.miot.symptoms.catalog.service.DataSourceService;
import com.microboxlabs.miot.symptoms.catalog.service.InMemoryCatalog;
import com.microboxlabs.miot.symptoms.catalog.service.SeedTemplates;
import com.microboxlabs.miot.symptoms.evaluator.SignalEvaluator.Result;
import com.microboxlabs.miot.symptoms.signal.SignalSamples;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;

/** The signal-loss template's close rule (2.2.0) on the detector's checks, against 2.1.0's operator-only close. */
class SignalLossCloseTest {

    private static final String TENANT = "tenant-a";
    private static final String TRUCK = "truck-1";
    private static final Instant T0 = Instant.parse("2026-10-03T03:00:00Z");
    private static final DataSource TRIP_CHECK = new DataSourceService(new InMemoryCatalog(),
            SignalSamples.inMemory()).find(TENANT, "trip_check").orElseThrow();
    private static final String OPERATOR_ONLY = "case.closed_by_operator";

    private final InMemoryEpisodeStore store = new InMemoryEpisodeStore();
    private final SignalEvaluator evaluator = new SignalEvaluator(store);

    private static SymptomSpec template() {
        return SeedTemplates.get("signal-loss").spec();
    }

    /** 2.2.0 with 2.1.0's close rule. */
    private static SymptomSpec operatorOnly() {
        SymptomSpec s = template();
        return new SymptomSpec(s.source(), s.activation(), s.measure(), s.levels(),
                new Lifecycle(s.lifecycle().open(), OPERATOR_ONLY), s.recurrence(), s.family(), s.state());
    }

    /** A lost-signal check after {@code silence} seconds; {@code returned} when frames arrive again. */
    private static Map<String, Object> check(double silence, boolean returned) {
        return Map.of("check", Map.of(
                "trip", Map.of("active", true, "double_driver", false),
                "signal_lost_minutes", silence / 60,
                "loss", Map.of("silence_s", silence, "expected_s", 180.0, "ratio", silence / 180.0,
                        "returned", returned, "backfill", false, "low_coverage_zone", false,
                        "cohort_outage", false, "nearby_reporting", 0.0)));
    }

    /** Lost checks at these seconds of silence, then the return check; the transitions as {@code KIND:level}. */
    private List<String> run(SymptomSpec spec, int returnAt, int... silences) {
        List<CompiledSymptom> symptoms = List.of(CompiledSymptom.compile(UUID.randomUUID(), "2.2.0",
                SymptomState.ACTIVE, spec, TRIP_CHECK));
        List<String> out = new ArrayList<>();
        for (int s : silences) {
            out.addAll(kinds(evaluator.evaluate(TENANT, TRUCK, T0.plusSeconds(s), check(s, false), symptoms)));
        }
        out.addAll(kinds(evaluator.evaluate(TENANT, TRUCK, T0.plusSeconds(returnAt), check(returnAt, true),
                symptoms)));
        return out;
    }

    private static List<String> kinds(Result r) {
        assertTrue(r.errors().isEmpty(), r.errors().toString());
        return r.transitions().stream().map(t -> t.kind() + ":" + t.level()).toList();
    }

    @Test
    void theTemplateClosesOnlyByOperatorOrAtLevelOneOnceNormal() {
        assertEquals("case.closed_by_operator || (case.level <= 1 && case.normal_s >= 0)",
                template().lifecycle().close());
        assertEquals(template().activation(), operatorOnly().activation());
        assertEquals(template().levels(), operatorOnly().levels());
    }

    @Test
    void aCaseThatStayedAtLevelOneClosesOnTheReturnCheck() {
        assertEquals(List.of("OPENED:1", "CLOSED:1"), run(template(), 900, 360, 600));
    }

    @Test
    void withTheOperatorOnlyCloseTheSameCaseStaysOpen() {
        assertEquals(List.of("OPENED:1"), run(operatorOnly(), 900, 360, 600));
    }

    @Test
    void aCaseThatReachedLevelTwoStaysOpenOnTheReturnCheck() {
        assertEquals(List.of("OPENED:1", "LEVEL_CHANGED:2"), run(template(), 2100, 360, 1800));
    }

    @Test
    void aCaseThatOpenedAtLevelTwoStaysOpenOnTheReturnCheck() {
        assertEquals(List.of("OPENED:2"), run(template(), 2400, 1900));
    }

    @Test
    void aLevelOneCaseStaysOpenWhileTheVehicleIsSilent() {
        // Until the return check the activation holds, so case.normal_s is -1.
        List<String> lost = run(template(), 1200, 360, 600, 900);
        assertEquals(List.of("OPENED:1", "CLOSED:1"), lost, "closed by the return at 1200 s, not before");
    }
}
