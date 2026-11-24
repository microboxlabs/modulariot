package com.microboxlabs.miot.teltonika.inputs;

import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * What is wired to one input of the device ({@code miot_teltonika.input_mapping}).
 *
 * @param source     canonical input: {@code din1}..{@code din4} (digital) or {@code ain1}, {@code ain2} (volts)
 * @param meaning    what it is: door, panic, pto, refrigeration, seatbelt, tamper or custom
 * @param label      name shown to the operator (e.g. "Puerta trasera")
 * @param activeHigh digital: the meaning is "on" when the input is 1; false inverts it
 * @param thresholdV analog: "on" at or above this voltage (below it when {@code activeHigh} is false)
 * @param eventOn    produce an event when it turns on
 * @param eventOff   produce an event when it turns off
 */
public record InputMapping(String source, String meaning, String label, boolean activeHigh, Double thresholdV,
        boolean eventOn, boolean eventOff) {

    public static final Set<String> DIGITAL = Set.of("din1", "din2", "din3", "din4");
    public static final Set<String> ANALOG = Set.of("ain1", "ain2");

    /** Event types by meaning: when it turns on, when it turns off. */
    public static final Map<String, List<String>> MEANINGS = Map.of(
            "door", List.of("door_open", "door_closed"),
            "panic", List.of("panic_button", "panic_released"),
            "pto", List.of("pto_on", "pto_off"),
            "refrigeration", List.of("refrigeration_on", "refrigeration_off"),
            "seatbelt", List.of("seatbelt_fastened", "seatbelt_unfastened"),
            "tamper", List.of("tamper", "tamper_cleared"),
            "custom", List.of("input_on", "input_off"));

    public InputMapping {
        if (source == null || !(DIGITAL.contains(source) || ANALOG.contains(source))) {
            throw new IllegalArgumentException("source must be one of din1..din4, ain1, ain2");
        }
        if (meaning == null || !MEANINGS.containsKey(meaning)) {
            throw new IllegalArgumentException("meaning must be one of " + MEANINGS.keySet().stream().sorted().toList());
        }
        if (label == null || label.isBlank() || label.length() > 60) {
            throw new IllegalArgumentException("label is required (up to 60 characters)");
        }
        label = label.trim();
        if (ANALOG.contains(source)) {
            if (thresholdV == null || thresholdV < 0 || thresholdV > 60) {
                throw new IllegalArgumentException("an analog input needs thresholdV between 0 and 60 V");
            }
        } else if (thresholdV != null) {
            throw new IllegalArgumentException("thresholdV applies only to analog inputs");
        }
    }

    public boolean analog() {
        return ANALOG.contains(source);
    }

    public String onEvent() {
        return MEANINGS.get(meaning).get(0);
    }

    public String offEvent() {
        return MEANINGS.get(meaning).get(1);
    }
}
