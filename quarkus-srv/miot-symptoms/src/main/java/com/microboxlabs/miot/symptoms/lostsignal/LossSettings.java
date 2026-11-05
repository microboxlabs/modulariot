package com.microboxlabs.miot.symptoms.lostsignal;

import java.time.Duration;
import java.util.Map;

/**
 * How the detector reads the profiles. A vehicle's expected gap is the {@code gapQuantile} of its gaps in the
 * frame's motion times {@code gapMargin}, once it has {@code minSamples} of them; before, the motion's default.
 * A sender's delivery delay is the {@code delayQuantile} of its delays, capped at {@code maxDelay}.
 *
 * @param vehicleMemory about how many gaps a vehicle's profile remembers per motion
 * @param senderMemory  about how many frames a sender's delay profile remembers
 */
public record LossSettings(Duration profileTtl, int vehicleMemory, int senderMemory, int minSamples,
        double gapQuantile, double gapMargin, Map<Motion, Duration> defaultGap, Duration minGap,
        double delayQuantile, Duration defaultDelay, Duration maxDelay) {

    public static LossSettings defaults() {
        return new LossSettings(Duration.ofDays(7), 500, 5000, 20, 0.95, 1.5,
                Map.of(Motion.MOVING, Duration.ofMinutes(2), Motion.STOPPED, Duration.ofMinutes(5),
                        Motion.ENGINE_OFF, Duration.ofHours(1)),
                Duration.ofMinutes(1), 0.9, Duration.ofMinutes(1), Duration.ofHours(1));
    }
}
