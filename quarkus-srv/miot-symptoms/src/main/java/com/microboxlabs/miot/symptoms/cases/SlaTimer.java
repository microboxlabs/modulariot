package com.microboxlabs.miot.symptoms.cases;

import com.microboxlabs.miot.symptoms.events.SymptomEvents;
import io.quarkus.arc.properties.IfBuildProperty;
import io.quarkus.scheduler.Scheduled;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import org.eclipse.microprofile.config.inject.ConfigProperty;
import org.jboss.logging.Logger;

/**
 * Publishes {@code symptom.case.sla_expired} once per case and level when an open ACTIVE case stays unattended
 * past its level's {@code slaMinutes} ({@link SlaStore}). Only cases opened within {@code lookback} are read.
 * Several pods may run it: the expiry mark is written first and only the pod that writes it publishes.
 * On with {@code miot.symptoms.sla.enabled}.
 */
@ApplicationScoped
@IfBuildProperty(name = "miot.component.symptoms.enabled", stringValue = "true")
public class SlaTimer {

    private static final Logger LOG = Logger.getLogger(SlaTimer.class);
    static final int BATCH = 500;

    private final boolean enabled;
    private final Duration lookback;
    private final SlaStore store;
    private final SymptomEvents events;
    private final Clock clock;
    private HoldStore holds;

    @Inject
    SlaTimer(@ConfigProperty(name = "miot.symptoms.sla.enabled", defaultValue = "false") boolean enabled,
            @ConfigProperty(name = "miot.symptoms.sla.lookback", defaultValue = "P7D") Duration lookback,
            SlaStore store, SymptomEvents events, HoldStore holds) {
        this(enabled, lookback, store, events, Clock.systemUTC());
        this.holds = holds;
    }

    SlaTimer(boolean enabled, Duration lookback, SlaStore store, SymptomEvents events, Clock clock) {
        this.enabled = enabled;
        this.lookback = lookback;
        this.store = store;
        this.events = events;
        this.clock = clock;
    }

    @Scheduled(every = "${miot.symptoms.sla.every:60s}", delayed = "30s",
            concurrentExecution = Scheduled.ConcurrentExecution.SKIP)
    void tick() {
        if (!enabled) {
            return;
        }
        try {
            run();
        } catch (RuntimeException e) {
            // The cases stay due: the next run finds them again.
            LOG.warnf("Symptom SLA timer: run failed (%s)", e.getClass().getSimpleName());
        }
    }

    /** One pass; returns the expiries it published. */
    int run() {
        Instant now = clock.instant();
        int published = 0;
        for (SlaStore.Due d : store.due(now.minus(lookback), now, BATCH)) {
            published += holds == null ? expire(d, now)
                    : holds.locked(d.tenantCode(), d.engineCase().assetId(), () -> expire(d, now));
        }
        return published;
    }

    private int expire(SlaStore.Due d, Instant now) {
        EngineCase c = d.engineCase();
        if (holds != null && holds.open(d.tenantCode()).stream()
                .anyMatch(h -> h.covers(c.assetId(), c.definitionId(), c.openedAt()))) {
            return 0;
        }
        if (store.markExpired(d, now)) {
            events.slaExpired(d.tenantCode(), c, d.slaMinutes(), d.levelSince(), now);
            return 1;
        }
        return 0;
    }
}
