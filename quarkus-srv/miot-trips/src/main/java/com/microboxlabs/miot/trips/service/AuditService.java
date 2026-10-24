package com.microboxlabs.miot.trips.service;

import com.microboxlabs.miot.trips.domain.AuditEvent;
import com.microboxlabs.miot.trips.store.AuditStore;
import io.quarkus.arc.properties.IfBuildProperty;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.inject.Instance;
import jakarta.inject.Inject;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Map;
import java.util.function.Supplier;
import org.jboss.logging.Logger;

/** Writes one audit row per trips mutation, tells {@link TripChanges} about it, and serves the audit log. */
@ApplicationScoped
@IfBuildProperty(name = "miot.component.trips.enabled", stringValue = "true")
public class AuditService {

    public static final int MAX_LIMIT = 500;

    private static final Logger LOG = Logger.getLogger(AuditService.class);

    private final AuditStore store;
    private final Supplier<TripChanges> changes;

    public AuditService(AuditStore store) {
        this(store, () -> TripChanges.NONE);
    }

    /** {@code changes} is looked up on first use: the monitor engine it resolves to uses this service too. */
    public AuditService(AuditStore store, Supplier<TripChanges> changes) {
        this.store = store;
        this.changes = changes;
    }

    @Inject
    AuditService(AuditStore store, Instance<TripChanges> changes) {
        this(store, () -> changes.isResolvable() ? changes.get() : TripChanges.NONE);
    }

    /**
     * Appends an event in the transaction of the change it records, so a rolled-back change leaves
     * no event. If the append itself fails, the change stays, the failure is logged, and null is
     * returned rather than failing the request. A change of a trip is then passed to {@link TripChanges}.
     */
    public AuditEvent log(String tenantCode, String actor, String action, String entityType, String entityId,
            String tripId, Map<String, Object> details) {
        Map<String, Object> d = details == null ? Map.of() : details;
        AuditEvent event;
        try {
            event = store.append(new AuditEvent(null, tenantCode, actor, action, entityType, entityId, tripId, d,
                    null));
        } catch (RuntimeException e) {
            LOG.errorf(e, "Audit event not stored: tenant=%s action=%s %s=%s", tenantCode, action, entityType,
                    entityId);
            event = null;
        }
        if (tripId != null) {
            changes.get().changed(tenantCode, actor, action, tripId, d);
        }
        return event;
    }

    public List<AuditEvent> list(String tenantCode, String entityType, String entityId, OffsetDateTime before,
            Long beforeId, Integer limit) {
        int effective = limit == null ? 100 : limit;
        if (effective < 1 || effective > MAX_LIMIT) {
            throw new IllegalArgumentException("limit must be between 1 and " + MAX_LIMIT);
        }
        if (beforeId != null && before == null) {
            throw new IllegalArgumentException("beforeId needs before");
        }
        return store.list(tenantCode, blankToNull(entityType), blankToNull(entityId), before, beforeId, effective);
    }

    private static String blankToNull(String value) {
        return value == null || value.isBlank() ? null : value;
    }
}
