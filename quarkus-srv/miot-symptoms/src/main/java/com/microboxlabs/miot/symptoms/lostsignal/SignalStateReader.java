package com.microboxlabs.miot.symptoms.lostsignal;

import com.microboxlabs.miot.core.gps.SignalStates;
import com.microboxlabs.miot.symptoms.lostsignal.LossStore.Seen;
import java.time.Duration;
import java.time.Instant;
import java.util.Collection;
import java.util.LinkedHashMap;
import java.util.Map;

/**
 * The vehicles' signal state from the detector's profiles, read on demand and never written. Offline once
 * {@code now - arrival of the newest frame} passes the expected silence: the frame's watch's when the vehicle is
 * on a trip, the one its deadline was set with; else computed from the vehicle's and its sender's profiles.
 */
public class SignalStateReader implements SignalStates {

    private final LossStore store;
    private final ArrivalProfiles profiles;

    public SignalStateReader(LossStore store, ArrivalProfiles profiles) {
        this.store = store;
        this.profiles = profiles;
    }

    @Override
    public Map<String, SignalState> states(Collection<String> assetIds, Instant now) {
        Map<String, Seen> seen = store.seen(assetIds);
        Map<String, SignalState> out = new LinkedHashMap<>();
        for (String id : assetIds) {
            out.put(id, state(seen.get(id), now));
        }
        return out;
    }

    SignalState state(Seen seen, Instant now) {
        VehicleProfile v = seen == null ? null : seen.profile();
        if (v == null || v.at() == null || v.arrival() == null) {
            return SignalState.UNKNOWN;
        }
        if (v.seen() != null && Duration.between(v.seen(), now).compareTo(profiles.settings().profileTtl()) > 0) {
            return SignalState.UNKNOWN; // the profile expired, as in Redis
        }
        SenderProfile sender = seen.sender() == null ? SenderProfile.empty() : seen.sender();
        Duration expected = seen.onTrip() ? Duration.ofSeconds(seen.watch().expectedS())
                : profiles.expected(v, sender);
        Duration silence = Duration.between(v.arrival(), now);
        if (silence.isNegative()) {
            silence = Duration.ZERO;
        }
        boolean offline = silence.compareTo(expected) > 0;
        return new SignalState(offline ? Status.OFFLINE : Status.ONLINE, offline ? v.at() : null, v.at(),
                silence.toSeconds(), expected.toSeconds());
    }
}
