package com.microboxlabs.miot.symptoms.evaluator.evals;

import static org.junit.jupiter.api.Assertions.assertEquals;

import com.microboxlabs.miot.symptoms.catalog.domain.DataSource;
import com.microboxlabs.miot.symptoms.catalog.domain.SymptomSpec;
import com.microboxlabs.miot.symptoms.catalog.service.TemplateService;
import com.microboxlabs.miot.symptoms.evaluator.evals.EvalTraces.Signal;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;

/**
 * The catalog's panic-button template against production's SOS rule: an SOS event opens a case at code black,
 * on a trip or not, and only an operator closes it. Production has too few SOS events to replay real trips.
 */
class PanicButtonRuleCasesTest {

    private static final SymptomSpec TEMPLATE = new TemplateService().get("panic-button").spec();
    private static final DataSource EVENTS = EvalTraces.source("device_event");

    private static Signal event(int at, String type, boolean onTrip) {
        return new Signal(at, EvalTraces.root(Map.of("event.type", type, "event.trip.active", onTrip,
                "event.gps.speed_kmh", 0.0)));
    }

    private static List<String> run(Signal... events) {
        return EvalTraces.replay(TEMPLATE, EVENTS, List.of(events));
    }

    @Test
    void anSosOpensACaseAtCodeBlackOnATripOrNot() {
        assertEquals(List.of(EvalTraces.transition("OPENED", 0, 0, 4)), run(event(0, "SOS", true)));
        assertEquals(List.of(EvalTraces.transition("OPENED", 0, 0, 4)), run(event(0, "SOS", false)));
    }

    @Test
    void theCaseStaysOpenUntilAnOperatorClosesIt() {
        assertEquals(List.of(EvalTraces.transition("OPENED", 0, 0, 4)),
                run(event(0, "SOS", true), event(60, "SOS", true), event(3600, "AAS", true)),
                "more events and other event types do not close it");
        // The evaluator gets no operator events yet, so the operator close can only be checked in the spec.
        assertEquals("caso.cerrado_por_operador", TEMPLATE.lifecycle().close());
    }

    @Test
    void otherEventsOpenNothing() {
        assertEquals(List.of(), run(event(0, "AAS", true)));
    }
}
