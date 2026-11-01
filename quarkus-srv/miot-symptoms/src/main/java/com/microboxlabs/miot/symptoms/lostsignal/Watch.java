package com.microboxlabs.miot.symptoms.lostsignal;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.annotation.JsonProperty;
import io.quarkus.runtime.annotations.RegisterForReflection;
import java.util.Map;

/**
 * What the newest frame left for the vehicle's next check: each organization's trip in progress, as the signal
 * carried it, the expected silence and the sender.
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
@RegisterForReflection
public record Watch(Map<String, Map<String, Object>> trips, @JsonProperty("expected_s") long expectedS,
        String sender) {
}
