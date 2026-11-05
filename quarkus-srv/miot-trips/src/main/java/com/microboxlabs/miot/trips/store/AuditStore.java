package com.microboxlabs.miot.trips.store;

import com.microboxlabs.miot.trips.domain.AuditEvent;
import java.time.OffsetDateTime;
import java.util.List;

/** Append-only module audit; read with a keyset cursor. */
public interface AuditStore {

    AuditEvent append(AuditEvent event);

    List<AuditEvent> list(String tenantCode, String entityType, String entityId, OffsetDateTime before,
            Long beforeId, int limit);
}
