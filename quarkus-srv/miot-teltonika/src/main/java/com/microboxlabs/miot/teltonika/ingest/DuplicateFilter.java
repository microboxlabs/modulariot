package com.microboxlabs.miot.teltonika.ingest;

import java.time.Duration;
import java.time.Instant;
import java.util.LinkedHashSet;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Remembers the last record times published per device, so a packet the device sends again (lost
 * acknowledgment, reconnection) is not published twice. Bounded twice: at most {@code window} times
 * per device, and devices idle longer than {@code idleEviction} are forgotten by {@link #evictIdle}.
 * With 5,000 devices and a window of 256 it holds about 1.3 million entries (~90 MB).
 *
 * <p>In memory: it covers one receiver instance. Across pods and restarts the deterministic
 * request id lets the database discard duplicates (pending in tracking/StreamHub).
 */
public final class DuplicateFilter {

    private final int window;
    private final Duration idleEviction;
    private final Map<String, Seen> byDevice = new ConcurrentHashMap<>();

    public DuplicateFilter(int window, Duration idleEviction) {
        if (window < 1) {
            throw new IllegalArgumentException("window must be positive");
        }
        this.window = window;
        this.idleEviction = idleEviction;
    }

    public boolean isPublished(String imei, Instant recordTime) {
        Seen seen = byDevice.get(imei);
        return seen != null && seen.contains(recordTime);
    }

    public void markPublished(String imei, Instant recordTime) {
        byDevice.computeIfAbsent(imei, k -> new Seen()).add(recordTime, window);
    }

    /** Forgets devices not published for longer than the idle period; returns how many. */
    public int evictIdle(Instant now) {
        Instant cutoff = now.minus(idleEviction);
        int before = byDevice.size();
        byDevice.values().removeIf(s -> s.lastUse().isBefore(cutoff));
        return before - byDevice.size();
    }

    /** IMEIs currently remembered. */
    public Set<String> deviceSet() {
        return byDevice.keySet();
    }

    public int devices() {
        return byDevice.size();
    }

    private static final class Seen {
        private final LinkedHashSet<Instant> times = new LinkedHashSet<>();
        private Instant lastUse = Instant.now();

        synchronized boolean contains(Instant t) {
            return times.contains(t);
        }

        synchronized void add(Instant t, int window) {
            lastUse = Instant.now();
            if (times.add(t) && times.size() > window) {
                times.remove(times.iterator().next());
            }
        }

        synchronized Instant lastUse() {
            return lastUse;
        }
    }
}
