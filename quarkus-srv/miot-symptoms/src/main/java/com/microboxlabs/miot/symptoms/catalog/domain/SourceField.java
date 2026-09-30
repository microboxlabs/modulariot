package com.microboxlabs.miot.symptoms.catalog.domain;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

/**
 * One field a rule can read, such as {@code signal.gps.speed_kmh}.
 *
 * @param type            number, bool, text, list, duration, time or zone
 * @param origin          where the value comes from, or null when not confirmed
 * @param engineSupported the engine evaluates rules on this field today
 */
@JsonIgnoreProperties(ignoreUnknown = true)
public record SourceField(String path, String label, String type, String unit, FieldOrigin origin,
        boolean engineSupported) {
}
