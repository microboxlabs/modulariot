package com.microboxlabs.miot.symptoms.lostsignal;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.annotation.JsonProperty;
import io.quarkus.runtime.annotations.RegisterForReflection;
import java.time.Duration;
import java.time.Instant;
import java.util.EnumMap;
import java.util.Map;

/**
 * One vehicle's newest frame and its gaps between frames, by the motion of the frame before the gap. Only a frame
 * newer than the newest moves it: a late frame never moves "last signal" back, and a replay counts no gap.
 *
 * @param at      the newest frame's time
 * @param arrival when the newest frame arrived
 * @param seen    when any frame of the vehicle last arrived, late ones included
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
@RegisterForReflection
public record VehicleProfile(Instant at, Instant arrival, Instant seen, Motion motion, Map<Motion, Sketch> gaps,
        Last last) {

    /** The newest frame as the check reads it. */
    @JsonInclude(JsonInclude.Include.NON_NULL)
    @RegisterForReflection
    public record Last(Instant at, @JsonProperty("lat") Double latitude, @JsonProperty("lon") Double longitude,
            Double speed, Boolean engine) {
    }

    static VehicleProfile first(Frame f) {
        return new VehicleProfile(f.at(), f.arrivedAt(), f.arrivedAt(), f.motion(), new EnumMap<>(Motion.class),
                last(f));
    }

    /** The profile after the frame. */
    VehicleProfile with(Frame f, LossSettings settings) {
        Instant lastSeen = seen == null || f.arrivedAt().isAfter(seen) ? f.arrivedAt() : seen;
        if (!f.at().isAfter(at)) {
            return new VehicleProfile(at, arrival, lastSeen, motion, gaps, last);
        }
        Map<Motion, Sketch> next = new EnumMap<>(Motion.class);
        next.putAll(gaps);
        double gap = (f.at().toEpochMilli() - at.toEpochMilli()) / 1000.0;
        next.put(motion, next.getOrDefault(motion, Sketch.empty()).add(gap, 1.0 / settings.vehicleMemory()));
        return new VehicleProfile(f.at(), f.arrivedAt(), lastSeen, f.motion(), next, last(f));
    }

    /** How long a gap after the newest frame is normal for this vehicle in its current motion. */
    Duration expectedGap(LossSettings settings) {
        Sketch s = gaps.get(motion);
        double profiled = s == null || s.count() == 0 ? 0 : s.quantile(settings.gapQuantile()) * settings.gapMargin();
        double seconds = s != null && s.count() >= settings.minSamples() ? profiled
                : Math.max(profiled, (double) settings.defaultGap().getOrDefault(motion, settings.minGap()).toSeconds());
        return Duration.ofSeconds(Math.max(settings.minGap().toSeconds(), Math.round(seconds)));
    }

    private static Last last(Frame f) {
        return new Last(f.at(), f.latitude(), f.longitude(), f.speedKmh(), f.engineOn());
    }
}
