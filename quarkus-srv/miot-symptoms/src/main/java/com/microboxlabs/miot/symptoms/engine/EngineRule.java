package com.microboxlabs.miot.symptoms.engine;

import java.util.List;
import java.util.Map;

/**
 * A rule as the engine stores it.
 *
 * @param triggerType          {@code signal}, {@code event} or {@code job}
 * @param pattern              the JSON the engine matches signals against, with its control keys
 * @param closeOn              what deactivates a case, such as {@code Invalidated} or {@code Detention}
 * @param deactivateWithSignal a later signal that no longer matches closes the case
 */
public record EngineRule(
        int id,
        String name,
        String triggerType,
        Map<String, Object> pattern,
        boolean active,
        List<String> closeOn,
        boolean deactivateWithSignal) {
}
