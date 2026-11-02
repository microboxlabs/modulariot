package com.microboxlabs.miot.integrations.geocoding;

import io.micrometer.core.instrument.Counter;
import io.micrometer.core.instrument.Gauge;
import io.micrometer.core.instrument.MeterRegistry;
import io.micrometer.core.instrument.Tags;
import io.micrometer.core.instrument.Timer;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.inject.Instance;
import jakarta.inject.Inject;
import java.time.Duration;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicLong;

/**
 * Geocoding meters. The cache hit rate is {@code geocoding.cache.lookups} with {@code result=hit} over all of them.
 * The quota gauges carry the organization and hold the last value read, from the quota check or a provider call.
 * Without a registry every method does nothing.
 */
@ApplicationScoped
public class GeocodingMetrics {

    public static final GeocodingMetrics NONE = new GeocodingMetrics((MeterRegistry) null);

    private final MeterRegistry meters;
    private final Map<String, AtomicLong> used = new ConcurrentHashMap<>();
    private final Map<String, AtomicLong> quota = new ConcurrentHashMap<>();

    @Inject
    GeocodingMetrics(Instance<MeterRegistry> registry) {
        this(registry.isResolvable() ? registry.get() : null);
    }

    public GeocodingMetrics(MeterRegistry meters) {
        this.meters = meters;
    }

    /** {@code source} is null when nothing placed the site. */
    public void resolution(String source, String result) {
        count("geocoding.resolutions", "source", source == null ? "none" : source, "result", or(result));
    }

    public void cacheLookup(boolean hit) {
        count("geocoding.cache.lookups", "result", hit ? "hit" : "miss");
    }

    /** One provider answer; {@code outcome} is {@code found} or {@code empty}. */
    public void providerCall(String provider, String outcome, Duration latency) {
        if (meters != null) {
            Timer.builder("geocoding.provider.latency").tags(Tags.of("provider", or(provider), "outcome", outcome))
                    .register(meters).record(latency);
        }
    }

    /** {@code reason}: {@code no_connection}, {@code config}, {@code io} or {@code interrupted}. */
    public void providerError(String provider, String reason) {
        count("geocoding.provider.errors", "provider", or(provider), "reason", reason);
    }

    public void quotaRefusal(String code) {
        count("geocoding.quota.refusals", "code", code);
    }

    public void quota(String organization, long usedCalls, long included) {
        if (meters == null || organization == null) {
            return;
        }
        gauge(this.used, "geocoding.quota.used", organization).set(usedCalls);
        gauge(this.quota, "geocoding.quota.limit", organization).set(included);
    }

    private AtomicLong gauge(Map<String, AtomicLong> values, String name, String organization) {
        return values.computeIfAbsent(organization, org -> {
            AtomicLong value = new AtomicLong();
            Gauge.builder(name, value, AtomicLong::get).tags(Tags.of("organization", org)).register(meters);
            return value;
        });
    }

    private void count(String name, String... tags) {
        if (meters != null) {
            Counter.builder(name).tags(Tags.of(tags)).register(meters).increment();
        }
    }

    private static String or(String value) {
        return value == null ? "unknown" : value;
    }
}
