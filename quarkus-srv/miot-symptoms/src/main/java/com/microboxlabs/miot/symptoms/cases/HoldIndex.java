package com.microboxlabs.miot.symptoms.cases;

import com.microboxlabs.miot.symptoms.evaluator.Holds;
import io.quarkus.arc.properties.IfBuildProperty;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import org.jboss.logging.Logger;

/**
 * The holds the evaluator reads on every signal, per organization, read again after {@link #TTL} or when this
 * pod starts or ends one. Another pod's change shows within {@link #TTL}. A failed read keeps the last list.
 */
@ApplicationScoped
@IfBuildProperty(name = "miot.component.symptoms.enabled", stringValue = "true")
public class HoldIndex implements Holds {

    static final Duration TTL = Duration.ofSeconds(15);
    private static final Logger LOG = Logger.getLogger(HoldIndex.class);

    private record Cached(Instant at, List<IgnoreHold> holds) {
    }

    private final HoldStore store;
    private final Clock clock;
    private final Map<String, Cached> byTenant = new ConcurrentHashMap<>();

    @Inject
    HoldIndex(HoldStore store) {
        this(store, Clock.systemUTC());
    }

    public HoldIndex(HoldStore store, Clock clock) {
        this.store = store;
        this.clock = clock;
    }

    @Override
    public boolean held(String tenantCode, String assetId, UUID definitionId, Instant caseOpenedAt) {
        Instant now = clock.instant();
        return holds(tenantCode, now).stream()
                .anyMatch(h -> h.activeAt(now) && h.covers(assetId, definitionId, caseOpenedAt));
    }

    /** Drops the organization's list, so the next signal reads it again. */
    public void changed(String tenantCode) {
        byTenant.remove(tenantCode);
    }

    private List<IgnoreHold> holds(String tenantCode, Instant now) {
        Cached c = byTenant.get(tenantCode);
        if (c != null && c.at().plus(TTL).isAfter(now)) {
            return c.holds();
        }
        try {
            List<IgnoreHold> fresh = List.copyOf(store.open(tenantCode));
            byTenant.put(tenantCode, new Cached(now, fresh));
            return fresh;
        } catch (RuntimeException e) {
            LOG.warnf("Holds not read: tenant=%s (%s)", tenantCode, e.getClass().getSimpleName());
            List<IgnoreHold> last = c == null ? List.of() : c.holds();
            byTenant.put(tenantCode, new Cached(now, last));
            return last;
        }
    }
}
