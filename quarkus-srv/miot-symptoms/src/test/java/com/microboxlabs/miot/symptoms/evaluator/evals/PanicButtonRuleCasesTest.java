package com.microboxlabs.miot.symptoms.evaluator.evals;

import static org.junit.jupiter.api.Assertions.assertEquals;

import com.microboxlabs.miot.symptoms.catalog.domain.DataSource;
import com.microboxlabs.miot.symptoms.catalog.domain.SymptomSpec;
import com.microboxlabs.miot.symptoms.catalog.service.SeedTemplates;
import com.microboxlabs.miot.symptoms.evaluator.evals.EvalTraces.Signal;
import com.microboxlabs.miot.symptoms.signal.GpsSignal;
import java.util.Arrays;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;

/**
 * The catalog's panic-button template: a GPS frame with {@code sensors.panic_button} true opens a case at
 * code black, on a trip or not, and only an operator closes it. No device in production sends the field yet.
 * Since 1.1.0 the driver app's emergency event opens it too ({@code EventTemplatesRuleCasesTest}).
 */
class PanicButtonRuleCasesTest {

    private static final SymptomSpec TEMPLATE = SeedTemplates.get("panic-button").spec();
    private static final DataSource GPS = EvalTraces.source("gps_signal");

    private static Signal frame(int at, boolean pressed, boolean onTrip) {
        return new Signal(at, EvalTraces.root(Map.of("signal.frame.sensors.panic_button", pressed,
                "signal.trip.active", onTrip, "signal.frame.gps.speed", 0.0)));
    }

    /** The frames as the evaluator stream hands them over: with the frame's events as a list. */
    @SuppressWarnings("unchecked")
    private static List<String> run(Signal... frames) {
        return EvalTraces.replay(TEMPLATE, GPS, Arrays.stream(frames).map(f -> new Signal(f.at(),
                Map.of("signal", GpsSignal.FrameEvent.withEvents((Map<String, Object>) f.root().get("signal")))))
                .toList());
    }

    @Test
    void aPressOpensACaseAtCodeBlackOnATripOrNot() {
        assertEquals(List.of(EvalTraces.transition("OPENED", 0, 0, 4)), run(frame(0, true, true)));
        assertEquals(List.of(EvalTraces.transition("OPENED", 0, 0, 4)), run(frame(0, true, false)));
    }

    @Test
    void theCaseStaysOpenUntilAnOperatorClosesIt() {
        assertEquals(List.of(EvalTraces.transition("OPENED", 0, 0, 4)),
                run(frame(0, true, true), frame(30, true, true), frame(60, false, true), frame(3600, true, true)),
                "frames still pressed, released or pressed again do not open a second case");
        // The evaluator gets no operator events yet, so the operator close can only be checked in the spec.
        assertEquals("case.closed_by_operator", TEMPLATE.lifecycle().close());
    }

    @Test
    void theTemplateReadsTheButtonAsAnOptional() {
        assertEquals("signal.frame.?sensors.?panic_button == TRUE"
                + " || signal.frame.events.exists(e, e.event_type == \"Emergencia\")", TEMPLATE.activation());
    }

    @Test
    void framesWithoutAPressOpenNothing() {
        assertEquals(List.of(), run(frame(0, false, true), frame(30, false, false)));
    }

    @Test
    void framesWithoutTheButtonOpenNothingAndRaiseNoError() {
        Signal noButton = new Signal(0, EvalTraces.root(Map.of("signal.frame.sensors.engine_status", true,
                "signal.trip.active", true)));
        Signal noSensors = new Signal(30, EvalTraces.root(Map.of("signal.frame.gps.latitude", -33.45,
                "signal.trip.active", true)));

        assertEquals(List.of(), run(noButton, noSensors), "replay fails on any rule error");
    }
}
