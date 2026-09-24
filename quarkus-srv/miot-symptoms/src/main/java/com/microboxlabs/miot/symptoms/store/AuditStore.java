package com.microboxlabs.miot.symptoms.store;

import com.microboxlabs.miot.symptoms.domain.AuditEvent;
import java.time.OffsetDateTime;
import java.util.List;

/** Append-only audit log. */
public interface AuditStore {

    /** Appends an event. Assigns id and {@code createdAt}. */
    AuditEvent append(AuditEvent event);

    /** Newest first. Null filters match everything. */
    List<AuditEvent> list(
            String tenantCode, String entityType, String entityId, Long symptomId, OffsetDateTime before, int limit);
}
