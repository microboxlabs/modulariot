package com.microboxlabs.miot.symptoms.lostsignal;

import java.time.Duration;

/** One sender's delivery delays: arrival minus frame time, on time and late frames alike. */
public record SenderProfile(Sketch delay) {

    static SenderProfile empty() {
        return new SenderProfile(Sketch.empty());
    }

    SenderProfile with(Frame f, LossSettings settings) {
        return new SenderProfile(delay.add(f.delaySeconds(), 1.0 / settings.senderMemory()));
    }

    /** How late this sender's frames usually arrive; the default until it has enough frames. */
    Duration deliveryDelay(LossSettings settings) {
        if (delay.count() < settings.minSamples()) {
            return settings.defaultDelay();
        }
        Duration d = Duration.ofSeconds(Math.round(delay.quantile(settings.delayQuantile())));
        return d.compareTo(settings.maxDelay()) > 0 ? settings.maxDelay() : d;
    }
}
