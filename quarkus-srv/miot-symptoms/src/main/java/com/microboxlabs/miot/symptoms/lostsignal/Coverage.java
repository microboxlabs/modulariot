package com.microboxlabs.miot.symptoms.lostsignal;

import com.fasterxml.jackson.annotation.JsonProperty;
import io.quarkus.runtime.annotations.RegisterForReflection;
import java.time.Duration;
import java.time.Instant;

/**
 * Frames and delayed frames seen in one grid cell, by one sender or all of them, fading with time. A frame is
 * delayed when it arrives later than its sender usually does ({@link CoverageMap#delayed}): the GPS kept fixing
 * where the cellular network did not, so delayed frames mark where coverage is poor.
 */
@RegisterForReflection
public record Coverage(@JsonProperty("f") double frames, @JsonProperty("d") double delayed,
        @JsonProperty("t") Instant at) {

    static Coverage with(Coverage old, boolean delayed, Instant now, Duration halfLife) {
        if (old == null) {
            return new Coverage(1, delayed ? 1 : 0, now);
        }
        Coverage aged = old.at(now, halfLife);
        return new Coverage(round(aged.frames() + 1), round(aged.delayed() + (delayed ? 1 : 0)), now);
    }

    /** The counts faded to {@code now}, without a new frame. */
    Coverage at(Instant now, Duration halfLife) {
        double keep = Math.pow(0.5, Math.max(0, Duration.between(at, now).toMillis())
                / (double) halfLife.toMillis());
        return new Coverage(frames * keep, delayed * keep, now);
    }

    double share() {
        return frames <= 0 ? 0 : delayed / frames;
    }

    private static double round(double v) {
        return Math.round(v * 1000) / 1000.0;
    }
}
