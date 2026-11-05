package com.microboxlabs.miot.core.gps;

import java.time.Instant;
import java.util.Collection;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

/**
 * Whether a vehicle's GPS signal is arriving, by the lost-signal detector's threshold: offline once the time since
 * its newest frame arrived passes the silence the detector expects for it. Implemented by the symptoms module;
 * absent where it is not deployed.
 */
public interface SignalStates {

    enum Status {
        ONLINE, OFFLINE, UNKNOWN
    }

    /**
     * One vehicle's state at {@code now}.
     *
     * @param offlineSince the newest frame's GPS time, only when offline
     * @param lastFrameAt  the newest frame's GPS time, null when unknown
     * @param silenceS     seconds since the newest frame arrived, null when unknown
     * @param expectedS    the silence the detector expects after the newest frame, null when unknown
     */
    record SignalState(Status status, Instant offlineSince, Instant lastFrameAt, Long silenceS, Long expectedS) {

        public static final SignalState UNKNOWN = new SignalState(Status.UNKNOWN, null, null, null, null);

        /** As the APIs answer it: {@code state} in lower case, then the known fields in snake case. */
        public Map<String, Object> fields() {
            Map<String, Object> out = new LinkedHashMap<>();
            out.put("state", status.name().toLowerCase(Locale.ROOT));
            if (offlineSince != null) {
                out.put("offline_since", offlineSince.toString());
            }
            if (lastFrameAt != null) {
                out.put("last_frame_at", lastFrameAt.toString());
            }
            if (silenceS != null) {
                out.put("silence_s", silenceS);
            }
            if (expectedS != null) {
                out.put("expected_s", expectedS);
            }
            return out;
        }
    }

    default SignalState state(String assetId, Instant now) {
        return states(List.of(assetId), now).getOrDefault(assetId, SignalState.UNKNOWN);
    }

    /** Every asset asked for, {@link SignalState#UNKNOWN} when it has no profile; in a fixed number of reads. */
    Map<String, SignalState> states(Collection<String> assetIds, Instant now);
}
