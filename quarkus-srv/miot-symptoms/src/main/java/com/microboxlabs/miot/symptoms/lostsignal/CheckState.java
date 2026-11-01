package com.microboxlabs.miot.symptoms.lostsignal;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.annotation.JsonProperty;
import com.microboxlabs.miot.symptoms.catalog.domain.SymptomState;
import io.quarkus.runtime.annotations.RegisterForReflection;
import java.time.Instant;
import java.util.Map;

/**
 * What the checks left for the vehicle. Written by the ticker only; the frames read it.
 *
 * @param lostSince the newest frame's time when its deadline expired, or null while the vehicle reports
 * @param checkedAt the last check
 * @param cases     the open {@code trip_check} cases the checks opened, by {@code tenant/symptom id}; kept after
 *                  a return, since only an operator closes them
 */
@JsonInclude(JsonInclude.Include.NON_EMPTY)
@RegisterForReflection
public record CheckState(Instant lostSince, Instant checkedAt, Map<String, OpenCase> cases) {

    public static final CheckState NONE = new CheckState(null, null, Map.of());

    /** A case as it was opened: the return is reported with its version and state, whatever the symptom is now. */
    @RegisterForReflection
    public record OpenCase(@JsonProperty("id") long id, @JsonProperty("v") String version,
            @JsonProperty("s") SymptomState state) {
    }

    public CheckState {
        cases = cases == null ? Map.of() : Map.copyOf(cases);
    }

    boolean lost() {
        return lostSince != null;
    }
}
