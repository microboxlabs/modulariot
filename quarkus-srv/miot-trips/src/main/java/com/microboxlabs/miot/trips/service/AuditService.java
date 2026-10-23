package com.microboxlabs.miot.trips.service;

import com.microboxlabs.miot.trips.domain.AuditEvent;
import com.microboxlabs.miot.trips.store.AuditStore;
import io.quarkus.arc.properties.IfBuildProperty;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Map;
import org.jboss.logging.Logger;

/** Writes one audit row per trips mutation and serves the audit log. */
@ApplicationScoped
@IfBuildProperty(name = "miot.component.trips.enabled", stringValue = "true")
public class AuditService {

    public static final int MAX_LIMIT = 500;

    private static final Logger LOG = Logger.getLogger(AuditService.class);

    private final AuditStore store;

    @Inject
    public AuditService(AuditStore store) {
        this.store = store;
    }

    /**
     * Appends an event after the change it records has been stored. The two writes are not one
     * transaction: if the append fails, the change stays, the failure is logged, and null is
     * returned rather than failing the request.
     */
    public AuditEvent log(String tenantCode, String actor, String action, String entityType, String entityId,
            String tripId, Map<String, Object> details) {
        try {
            return store.append(new AuditEvent(null, tenantCode, actor, action, entityType, entityId, tripId,
                    details == null ? Map.of() : details, null));
        } catch (RuntimeException e) {
            LOG.errorf(e, "Audit event not stored: tenant=%s action=%s %s=%s", tenantCode, action, entityType,
                    entityId);
            return null;
        }
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
