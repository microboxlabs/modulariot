package com.microboxlabs.miot.symptoms.lostsignal;

import io.quarkus.runtime.annotations.RegisterForReflection;
import java.time.Duration;

/**
 * One sender's delivery delays: arrival minus frame time, on time and late frames alike.
 *
 * @param delayedShare the EWMA share of its frames delayed beyond its usual delay ({@link CoverageMap#isDelayed})
 */
@RegisterForReflection
public record SenderProfile(Sketch delay, double delayedShare) {

    static SenderProfile empty() {
        return new SenderProfile(Sketch.empty(), 0);
    }

    SenderProfile with(Frame f, LossSettings settings, boolean delayed) {
        double alpha = Math.max(1.0 / settings.senderMemory(), 1.0 / (delay.count() + 1));
        return new SenderProfile(delay.add(f.delaySeconds(), 1.0 / settings.senderMemory()),
                delayedShare + alpha * ((delayed ? 1 : 0) - delayedShare));
    }

    /** How late this sender's frames usually arrive; the default until it has enough frames. */
    Duration deliveryDelay(LossSettings settings) {
        Duration d = delay.count() < settings.minSamples() ? settings.defaultDelay()
                : Duration.ofSeconds(Math.round(delay.quantile(settings.delayQuantile())));
        return d.compareTo(settings.maxDelay()) > 0 ? settings.maxDelay() : d;
    }
}
