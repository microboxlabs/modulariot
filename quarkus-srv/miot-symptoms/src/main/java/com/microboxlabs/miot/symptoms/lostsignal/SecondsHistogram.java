package com.microboxlabs.miot.symptoms.lostsignal;

import java.util.Map;
import java.util.TreeMap;

/** Counts of whole seconds, merged hour by hour, for an exact median over a day. */
final class SecondsHistogram {

    private final TreeMap<Integer, Long> counts = new TreeMap<>();
    private long total;

    void add(int seconds, long n) {
        if (n <= 0) {
            return;
        }
        counts.merge(seconds, n, Long::sum);
        total += n;
    }

    long total() {
        return total;
    }

    /** The median, interpolated between the two middle values as {@code percentile_cont(0.5)}; null when empty. */
    Double median() {
        if (total == 0) {
            return null;
        }
        long lo = (total - 1) / 2;
        long hi = total / 2;
        Integer a = null;
        Integer b = null;
        long seen = 0;
        for (Map.Entry<Integer, Long> e : counts.entrySet()) {
            long next = seen + e.getValue();
            if (a == null && lo < next) {
                a = e.getKey();
            }
            if (hi < next) {
                b = e.getKey();
                break;
            }
            seen = next;
        }
        return (a + b) / 2.0;
    }
}
