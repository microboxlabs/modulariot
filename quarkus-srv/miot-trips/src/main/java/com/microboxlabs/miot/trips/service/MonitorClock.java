package com.microboxlabs.miot.trips.service;

import com.microboxlabs.miot.trips.domain.MonitorRun;
import com.microboxlabs.miot.trips.store.MonitorRunStore;
import io.quarkus.arc.properties.IfBuildProperty;
import io.quarkus.scheduler.Scheduled;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import java.time.Clock;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.List;
import org.eclipse.microprofile.config.inject.ConfigProperty;
import org.jboss.logging.Logger;

/**
 * Fires the monitors' due timers. Every replica claims up to {@code limit} due rows with SKIP LOCKED and evaluates
 * each one in its own transaction. A claim lasts {@code claim-seconds}; a replica that dies leaves its rows due again.
 */
@ApplicationScoped
@IfBuildProperty(name = "miot.component.trips.enabled", stringValue = "true")
public class MonitorClock {

    private static final Logger LOG = Logger.getLogger(MonitorClock.class);

    private final MonitorRunStore runs;
    private final MonitorEngine engine;
    private final Clock clock;
    private final boolean enabled;
    private final int claimSeconds;
    private final int limit;

    @Inject
    MonitorClock(MonitorRunStore runs, MonitorEngine engine,
            @ConfigProperty(name = "miot.trips.monitors.clock.enabled", defaultValue = "true") boolean enabled,
            @ConfigProperty(name = "miot.trips.monitors.clock.claim-seconds", defaultValue = "120") int claimSeconds,
            @ConfigProperty(name = "miot.trips.monitors.clock.limit", defaultValue = "500") int limit) {
        this(runs, engine, Clock.systemUTC(), enabled, claimSeconds, limit);
    }

    public MonitorClock(MonitorRunStore runs, MonitorEngine engine, Clock clock, boolean enabled, int claimSeconds,
            int limit) {
        this.runs = runs;
        this.engine = engine;
        this.clock = clock;
        this.enabled = enabled;
        this.claimSeconds = claimSeconds;
        this.limit = limit;
    }

    /** The first tick waits for startup, so it never runs before the migrations. */
    @Scheduled(every = "${miot.trips.monitors.clock.every:15s}", delayed = "${miot.trips.monitors.clock.delay:60s}",
            concurrentExecution = Scheduled.ConcurrentExecution.SKIP)
    void scheduled() {
        if (enabled) {
            try {
                tick();
            } catch (RuntimeException e) {
                LOG.error("monitors clock tick failed", e);
            }
        }
    }

    /** Fires the due timers; returns how many were claimed. */
    public int tick() {
        List<MonitorRun.Timer> due = runs.claimDue(OffsetDateTime.now(clock).withOffsetSameInstant(ZoneOffset.UTC),
                claimSeconds, limit);
        for (MonitorRun.Timer t : due) {
            try {
                engine.fireTimer(t);
            } catch (RuntimeException e) {
                LOG.errorf(e, "Monitor timer %d failed: tenant=%s trip=%s rule=%s", t.id(), t.tenantCode(),
                        t.tripId(), t.ruleKey());
            }
        }
        return due.size();
    }
}
