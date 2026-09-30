package com.microboxlabs.miot.symptoms.store;

import com.microboxlabs.miot.symptoms.domain.AuditEvent;
import java.time.OffsetDateTime;
import java.util.List;

/** Append-only audit log. */
public interface AuditStore {

    /** Appends an event. Assigns id and {@code createdAt}. */
    AuditEvent append(AuditEvent event);

    default List<AuditEvent> list(
            String tenantCode, String entityType, String entityId, Long symptomId, OffsetDateTime before, int limit) {
        return list(tenantCode, entityType, entityId, symptomId, before, null, limit);
    }

    /**
     * Newest first, by {@code createdAt} then id. Null filters match everything.
     * With {@code before} alone, returns events created before it; with
     * {@code beforeId} too, returns events that sort after that event, so a page
     * that ends inside a timestamp tie loses nothing.
     */
    List<AuditEvent> list(
            String tenantCode, String entityType, String entityId, Long symptomId, OffsetDateTime before,
            String beforeId, int limit);
}
