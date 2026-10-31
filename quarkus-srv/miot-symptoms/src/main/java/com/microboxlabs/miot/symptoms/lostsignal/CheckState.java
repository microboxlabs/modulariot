package com.microboxlabs.miot.symptoms.lostsignal;

import com.fasterxml.jackson.annotation.JsonInclude;
import java.time.Instant;

/**
 * What the checks left for the vehicle. Written by the ticker only; the frames read it.
 *
 * @param lostSince the newest frame's time when its deadline expired, or null while the vehicle reports
 * @param checkedAt the last check
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
public record CheckState(Instant lostSince, Instant checkedAt) {

    public static final CheckState NONE = new CheckState(null, null);

    boolean lost() {
        return lostSince != null;
    }
}
