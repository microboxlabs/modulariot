package com.microboxlabs.miot.symptoms.service;

import com.microboxlabs.miot.symptoms.domain.AuditEvent;
import com.microboxlabs.miot.symptoms.store.AuditStore;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Map;

/** Writes one audit row per Control Tower mutation and serves the audit log. */
@ApplicationScoped
public class AuditService {

    public static final int MAX_LIMIT = 500;

    private final AuditStore store;

    @Inject
    public AuditService(AuditStore store) {
        this.store = store;
    }

    public AuditEvent record(
            String tenantCode, String actor, String action, String entityType, String entityId,
            Long symptomId, Map<String, Object> details) {
        return store.append(new AuditEvent(
                null, tenantCode, actor, action, entityType, entityId, symptomId,
                details == null ? Map.of() : details, null));
    }

    public List<AuditEvent> list(
            String tenantCode, String entityType, String entityId, Long symptomId, OffsetDateTime before,
            Integer limit) {
        int effective = limit == null ? 100 : limit;
        if (effective < 1 || effective > MAX_LIMIT) {
            throw new IllegalArgumentException("limit must be between 1 and " + MAX_LIMIT);
        }
        return store.list(tenantCode, blankToNull(entityType), blankToNull(entityId), symptomId, before, effective);
    }

    private static String blankToNull(String value) {
        return value == null || value.isBlank() ? null : value;
    }
}
