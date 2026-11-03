package com.microboxlabs.miot.symptoms.lostsignal;

import java.time.Duration;
import org.eclipse.microprofile.config.Config;

/**
 * The rules of the shadow map built from {@code asset_data} ({@link CoverageJob}, {@link ShadowMap}).
 *
 * @param floor         a frame later than this, and than {@code medianFactor} x its sender's median delay that day,
 *                      is delayed; the same with the median frame interval marks a gap
 * @param minFrames     a sender decides a cell alone with at least this many (weighted) frames there
 * @param minShare      a cell is shadow for a sender when its share is at least this
 * @param overSender    and at least this many times the sender's share everywhere
 * @param consensus     without enough frames of its own, a sender takes the cell as shadow when this many other
 *                      senders, each on its own, do
 * @param window        days older than this many are not read (config: a duration, {@code P30D})
 * @param halfLife      a day weighs 0.5^(age / halfLife)
 * @param gapMinKm      a gap counts only when the vehicle moved at least this far
 * @param gapMaxKmh     and not faster than this, which is a GPS jump
 * @param anomalyShare  a sender-day with at least this share
 * @param anomalyFactor and more than this many times the sender's median daily share is dropped
 */
public record CoverageSettings(Duration floor, double medianFactor, double minFrames, double minShare,
        double overSender, int consensus, int window, Duration halfLife, double gapMinKm, double gapMaxKmh,
        double anomalyShare, double anomalyFactor) {

    public static CoverageSettings defaults() {
        return new CoverageSettings(Duration.ofMinutes(10), 3, 20, 0.3, 2, 2, 30, Duration.ofDays(7), 2, 150,
                0.3, 3);
    }

    static final String PREFIX = "miot.symptoms.lost-signal.coverage.";

    /** The settings under {@value #PREFIX}, each defaulting to {@link #defaults()}. */
    public static CoverageSettings from(Config c) {
        CoverageSettings d = defaults();
        return new CoverageSettings(
                c.getOptionalValue(PREFIX + "floor", Duration.class).orElse(d.floor()),
                c.getOptionalValue(PREFIX + "median-factor", Double.class).orElse(d.medianFactor()),
                c.getOptionalValue(PREFIX + "min-frames", Double.class).orElse(d.minFrames()),
                c.getOptionalValue(PREFIX + "min-share", Double.class).orElse(d.minShare()),
                c.getOptionalValue(PREFIX + "over-sender", Double.class).orElse(d.overSender()),
                c.getOptionalValue(PREFIX + "consensus", Integer.class).orElse(d.consensus()),
                c.getOptionalValue(PREFIX + "window", Duration.class).map(w -> (int) w.toDays()).orElse(d.window()),
                c.getOptionalValue(PREFIX + "half-life", Duration.class).orElse(d.halfLife()),
                c.getOptionalValue(PREFIX + "gap-min-km", Double.class).orElse(d.gapMinKm()),
                c.getOptionalValue(PREFIX + "gap-max-kmh", Double.class).orElse(d.gapMaxKmh()),
                c.getOptionalValue(PREFIX + "anomaly-share", Double.class).orElse(d.anomalyShare()),
                c.getOptionalValue(PREFIX + "anomaly-factor", Double.class).orElse(d.anomalyFactor()));
    }

    /** How late a frame of a sender with this median delay may arrive before it counts as delayed. */
    double threshold(Double medianSeconds) {
        double m = medianSeconds == null ? 0 : medianSeconds;
        return Math.max((double) floor.toSeconds(), medianFactor * m);
    }
}
