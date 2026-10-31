package com.microboxlabs.miot.symptoms.lostsignal;

import com.fasterxml.jackson.annotation.JsonProperty;
import java.util.Arrays;

/**
 * Durations in seconds as a decayed histogram on fixed bounds, with their EWMA. Adding one costs the same
 * whatever the history; each add first scales the weights by {@code 1 - alpha}, so old values fade. A quantile is
 * its bucket's upper bound, so it errs long.
 */
public record Sketch(@JsonProperty("e") double ewma, @JsonProperty("n") long count,
        @JsonProperty("w") double[] weights) {

    static final double[] BOUNDS = { 1, 2, 5, 10, 15, 20, 30, 45, 60, 90, 120, 180, 300, 450, 600, 900, 1200, 1800,
            2700, 3600, 5400, 7200, 10800, 21600 };
    /** The quantile of the bucket above the last bound. */
    static final double OVER = 2 * BOUNDS[BOUNDS.length - 1];

    public static Sketch empty() {
        return new Sketch(0, 0, new double[BOUNDS.length + 1]);
    }

    public Sketch add(double seconds, double alpha) {
        double x = Math.max(0, seconds);
        double[] next = new double[BOUNDS.length + 1];
        double keep = 1 - alpha;
        for (int i = 0; i < next.length; i++) {
            // Rounded, so the stored JSON stays short and faded buckets reach zero.
            next[i] = Math.round((i < weights.length ? weights[i] : 0) * keep * 1000) / 1000.0;
        }
        next[bucket(x)] += 1;
        // The first values average evenly, then the EWMA uses alpha.
        double a = Math.max(alpha, 1.0 / (count + 1));
        return new Sketch(count == 0 ? x : ewma + a * (x - ewma), count + 1, next);
    }

    public double quantile(double q) {
        double total = Arrays.stream(weights).sum();
        if (total <= 0) {
            return 0;
        }
        double cumulative = 0;
        for (int i = 0; i < weights.length; i++) {
            cumulative += weights[i];
            if (cumulative >= q * total) {
                return i < BOUNDS.length ? BOUNDS[i] : OVER;
            }
        }
        return OVER;
    }

    static int bucket(double seconds) {
        for (int i = 0; i < BOUNDS.length; i++) {
            if (seconds <= BOUNDS[i]) {
                return i;
            }
        }
        return BOUNDS.length;
    }

    @Override
    public boolean equals(Object o) {
        return o instanceof Sketch s && s.ewma == ewma && s.count == count && Arrays.equals(s.weights, weights);
    }

    @Override
    public int hashCode() {
        return 31 * Long.hashCode(count) + Arrays.hashCode(weights);
    }

    @Override
    public String toString() {
        return "Sketch[ewma=" + ewma + ", count=" + count + "]";
    }
}
