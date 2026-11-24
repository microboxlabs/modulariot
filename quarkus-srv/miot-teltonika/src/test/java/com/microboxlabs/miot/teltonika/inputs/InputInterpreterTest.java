package com.microboxlabs.miot.teltonika.inputs;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import cl.streamhub.gps.model.Event;
import java.time.ZoneOffset;
import java.time.ZonedDateTime;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;

class InputInterpreterTest {

    private static final ZonedDateTime T0 = ZonedDateTime.of(2026, 11, 16, 12, 0, 0, 0, ZoneOffset.UTC);
    private static final InputMapping DOOR = new InputMapping("din2", "door", "Puerta trasera", true, null, true, true);
    private static final InputMapping PANIC = new InputMapping("din3", "panic", "Botón de pánico", false, null, true,
            false);
    private static final InputMapping COLD = new InputMapping("ain1", "refrigeration", "Equipo de frío", true, 6.0,
            true, true);

    private final InputInterpreter interpreter = new InputInterpreter();

    @Test
    void anEventOnlyWhenTheStateChanges() {
        assertTrue(apply(T0, Map.of("din2", false)).events().isEmpty(), "first state seen: no event");
        assertEquals(List.of("door_open"), types(apply(T0.plusSeconds(10), Map.of("din2", true))));
        assertTrue(apply(T0.plusSeconds(20), Map.of("din2", true)).events().isEmpty(), "unchanged");
        assertEquals(List.of("door_closed"), types(apply(T0.plusSeconds(30), Map.of("din2", false))));
    }

    @Test
    void theFirstStateCountsWhenTheDeviceSaysTheInputGeneratedTheRecord() {
        var r = interpreter.apply("d1", List.of(DOOR), new InputReading(Map.of("din2", true), Map.of(), "din2"), T0);
        assertEquals(List.of("door_open"), types(r));
    }

    @Test
    void activeLowInvertsAndOffEventsCanBeTurnedOff() {
        apply(T0, Map.of("din3", true));
        assertEquals(List.of("panic_button"), types(apply(T0.plusSeconds(5), Map.of("din3", false))),
                "active low: 0 means pressed");
        assertTrue(apply(T0.plusSeconds(9), Map.of("din3", true)).events().isEmpty(), "release event is off");
    }

    @Test
    void analogInputsUseTheirThreshold() {
        interpreter.apply("d1", List.of(COLD), new InputReading(Map.of(), Map.of("ain1", 0.4), null), T0);
        var on = interpreter.apply("d1", List.of(COLD), new InputReading(Map.of(), Map.of("ain1", 12.1), null),
                T0.plusSeconds(60));
        assertEquals(List.of("refrigeration_on"), types(on));
        assertEquals(Map.of("on", true, "volts", 12.1), on.states().get("Equipo de frío"));
    }

    @Test
    void aBatchThatIsNotPublishedLeavesTheStateAsItWas() {
        apply(T0, Map.of("din2", false));
        var failed = interpreter.batch();
        var first = interpreter.apply(failed, "d1", List.of(DOOR),
                new InputReading(Map.of("din2", true), Map.of(), null), T0.plusSeconds(10));
        assertEquals(List.of("door_open"), types(first));
        // Not committed (publish failed): the same record sent again produces the event again.
        var retry = interpreter.batch();
        var again = interpreter.apply(retry, "d1", List.of(DOOR),
                new InputReading(Map.of("din2", true), Map.of(), null), T0.plusSeconds(10));
        assertEquals(List.of("door_open"), types(again), "the door that opened is not lost");
        interpreter.commit(retry);
        assertTrue(apply(T0.plusSeconds(10), Map.of("din2", true)).events().isEmpty(), "committed now");
    }

    @Test
    void olderRecordsDoNotMoveTheState() {
        apply(T0.plusSeconds(100), Map.of("din2", false));
        assertTrue(apply(T0, Map.of("din2", true)).events().isEmpty(), "buffered record from before");
        assertEquals(List.of("door_open"), types(apply(T0.plusSeconds(110), Map.of("din2", true))));
    }

    @Test
    void namedStatesAreReportedForEveryMappedInput() {
        var r = apply(T0, Map.of("din2", true, "din3", true, "din1", true));
        assertEquals(Map.of("Puerta trasera", true, "Botón de pánico", false), r.states());
    }

    @Test
    void mappingsAreValidated() {
        assertThrows(IllegalArgumentException.class, () -> new InputMapping("din9", "door", "x", true, null, true, true));
        assertThrows(IllegalArgumentException.class, () -> new InputMapping("ain1", "door", "x", true, null, true, true),
                "analog needs a threshold");
        assertThrows(IllegalArgumentException.class, () -> new InputMapping("din1", "door", "x", true, 3.0, true, true),
                "digital has no threshold");
        assertThrows(IllegalArgumentException.class, () -> new InputMapping("din1", "fuel", "x", true, null, true, true));
        assertThrows(IllegalArgumentException.class, () -> new InputProfile(null, "t", "p", null, List.of(DOOR, DOOR),
                null, null, null, null), "an input mapped twice");
    }

    private InputInterpreter.Result apply(ZonedDateTime t, Map<String, Boolean> digital) {
        return interpreter.apply("d1", List.of(DOOR, PANIC), new InputReading(digital, Map.of(), null), t);
    }

    private static List<String> types(InputInterpreter.Result r) {
        return r.events().stream().map(Event::getEventType).toList();
    }
}
