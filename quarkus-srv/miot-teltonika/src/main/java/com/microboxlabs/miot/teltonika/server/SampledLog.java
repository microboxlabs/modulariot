package com.microboxlabs.miot.teltonika.server;

import java.time.Duration;
import java.time.Instant;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicInteger;
import org.jboss.logging.Logger;

/**
 * Logs at most {@code perWindow} lines per key and window, then one summary of what was skipped.
 * A device stuck in a reconnection loop (unregistered IMEI, bad packet) must not flood the log.
 */
final class SampledLog {

    private final Logger log;
    private final int perWindow;
    private final Duration window;
    private final Map<String, Bucket> buckets = new ConcurrentHashMap<>();

    SampledLog(Logger log, int perWindow, Duration window) {
        this.log = log;
        this.perWindow = perWindow;
        this.window = window;
    }

    void warn(String key, String message) {
        Instant now = Instant.now();
        Bucket b = buckets.compute(key, (k, old) ->
                old == null || old.start.plus(window).isBefore(now)
                        ? new Bucket(now, old == null ? 0 : Math.max(0, old.count.get() - perWindow)) : old);
        int n = b.count.incrementAndGet();
        if (n <= perWindow) {
            if (n == 1 && b.skippedBefore > 0) {
                log.warnf("%s (%d similar lines skipped in the previous %ds)", message, b.skippedBefore,
                        window.toSeconds());
            } else {
                log.warn(message);
            }
        }
        if (buckets.size() > 10_000) {
            buckets.entrySet().removeIf(e -> e.getValue().start.plus(window).isBefore(now));
        }
    }

    private static final class Bucket {
        final Instant start;
        final AtomicInteger count = new AtomicInteger();
        final int skippedBefore;

        Bucket(Instant start, int skippedBefore) {
            this.start = start;
            this.skippedBefore = skippedBefore;
        }
    }
}
