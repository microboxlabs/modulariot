package com.microboxlabs.miot.symptoms.lostsignal;

import com.microboxlabs.miot.core.gps.SignalStates;
import com.microboxlabs.miot.symptoms.lostsignal.LossStore.Seen;
import java.time.Duration;
import java.time.Instant;
import java.util.Collection;
import java.util.Comparator;
import java.util.List;
import java.util.Optional;
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

    /**
     * What the newest frames say about one vehicle, for a case's popup.
     *
     * @param medianIntervalS the median of its gaps in its current motion (its most sampled motion until it has one
     *                        there), null without any
     * @param engineOn        the newest frame's engine status, null when the device does not say
     */
    public record Reported(SignalState state, Long medianIntervalS, Boolean engineOn) {
    }

    /** Empty when the vehicle has no profile (never seen, or it expired). */
    public Optional<Reported> reported(String assetId, Instant now) {
        Seen seen = store.seen(List.of(assetId)).get(assetId);
        SignalState state = state(seen, now);
        if (state.status() == Status.UNKNOWN) {
            return Optional.empty();
        }
        VehicleProfile v = seen.profile();
        Sketch gaps = usualGaps(v);
        Long median = gaps == null ? null : Math.round(gaps.quantile(0.5));
        return Optional.of(new Reported(state, median, v.last() == null ? null : v.last().engine()));
    }

    /** The gaps in the vehicle's current motion; until it has one there, those of its most sampled motion. */
    private static Sketch usualGaps(VehicleProfile v) {
        if (v.gaps() == null || v.gaps().isEmpty()) {
            return null;
        }
        Sketch current = v.motion() == null ? null : v.gaps().get(v.motion());
        if (current != null && current.count() > 0) {
            return current;
        }
        return v.gaps().values().stream().filter(g -> g.count() > 0)
                .max(Comparator.comparingLong(Sketch::count)).orElse(null);
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
