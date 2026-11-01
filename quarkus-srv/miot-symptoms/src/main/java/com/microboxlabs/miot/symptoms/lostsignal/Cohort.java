package com.microboxlabs.miot.symptoms.lostsignal;

import com.fasterxml.jackson.annotation.JsonProperty;
import io.quarkus.runtime.annotations.RegisterForReflection;
import java.time.Duration;
import java.time.Instant;

/**
 * How many of a sender's vehicles are usually lost at once: a time-weighted average of the count, so a sender
 * that forwards in batches does not look like an outage all the time. An outage is at least {@code minLost}
 * lost and {@code factor} times the usual.
 */
@RegisterForReflection
public record Cohort(@JsonProperty("b") double baseline, @JsonProperty("t") Instant at,
        @JsonProperty("n") int count) {

    static final Duration HALF_LIFE = Duration.ofHours(6);
    static final int MIN_LOST = 3;
    static final double FACTOR = 3;

    /**
     * The baseline after the count changes to {@code lost} at {@code now}: the time since the last look is weighed
     * with the count that held during it, so a quiet interval lowers the baseline before a new loss is compared.
     */
    static Cohort with(Cohort old, int lost, Instant now) {
        if (old == null) {
            return new Cohort(0, now, lost);
        }
        double w = 1 - Math.pow(0.5, Math.max(0, Duration.between(old.at(), now).toMillis())
                / (double) HALF_LIFE.toMillis());
        return new Cohort(old.baseline() + w * (old.count() - old.baseline()), now, lost);
    }

    static boolean outage(Cohort before, int lost) {
        double usual = before == null ? 0 : before.baseline();
        return lost >= MIN_LOST && lost >= FACTOR * Math.max(1, usual);
    }
}
