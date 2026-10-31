package com.microboxlabs.miot.symptoms.lostsignal;

import com.fasterxml.jackson.annotation.JsonInclude;
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
public record CheckState(Instant lostSince, Instant checkedAt, Map<String, Long> cases) {

    public static final CheckState NONE = new CheckState(null, null, Map.of());

    public CheckState {
        cases = cases == null ? Map.of() : Map.copyOf(cases);
    }

    boolean lost() {
        return lostSince != null;
    }
}
