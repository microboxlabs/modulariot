package com.microboxlabs.miot.symptoms.catalog.domain;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import java.util.List;

/**
 * One field a rule can read, such as {@code signal.gps.speed_kmh}.
 *
 * @param type            number, bool, text, list, duration, time or zone
 * @param origin          where the value comes from, or null when not confirmed
 * @param engineSupported the engine evaluates rules on this field today
 * @param values          the values a list field takes, or null when they are open
 */
@JsonIgnoreProperties(ignoreUnknown = true)
public record SourceField(String path, String label, String type, String unit, FieldOrigin origin,
        boolean engineSupported, List<FieldValue> values) {

    public SourceField(String path, String label, String type, String unit, FieldOrigin origin,
            boolean engineSupported) {
        this(path, label, type, unit, origin, engineSupported, null);
    }

    /** A value as rules write it ({@code HEAVY}) and as people read it. */
    @JsonIgnoreProperties(ignoreUnknown = true)
    public record FieldValue(String value, String label) {
    }
}
