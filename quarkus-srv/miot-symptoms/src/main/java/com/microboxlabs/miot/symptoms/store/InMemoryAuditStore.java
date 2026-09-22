package com.microboxlabs.miot.symptoms.store;

import com.microboxlabs.miot.symptoms.domain.AuditEvent;
import jakarta.enterprise.context.ApplicationScoped;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;

/** Process-local audit log. */
@ApplicationScoped
public class InMemoryAuditStore implements AuditStore {

    private final List<AuditEvent> events = new ArrayList<>();

    @Override
    public synchronized AuditEvent append(AuditEvent e) {
        AuditEvent saved = new AuditEvent(UUID.randomUUID().toString(), e.tenantCode(), e.actor(), e.action(),
                e.entityType(), e.entityId(), e.symptomId(), e.details() == null ? Map.of() : Map.copyOf(e.details()),
                OffsetDateTime.now());
        events.add(saved);
        return saved;
    }

    @Override
    public synchronized List<AuditEvent> list(
            String tenantCode, String entityType, String entityId, Long symptomId, OffsetDateTime before, int limit) {
        List<AuditEvent> out = new ArrayList<>();
        for (int i = events.size() - 1; i >= 0 && out.size() < limit; i--) {
            AuditEvent e = events.get(i);
            if (e.tenantCode().equals(tenantCode)
                    && (entityType == null || entityType.equals(e.entityType()))
                    && (entityId == null || entityId.equals(e.entityId()))
                    && (symptomId == null || Objects.equals(symptomId, e.symptomId()))
                    && (before == null || e.createdAt().isBefore(before))) {
                out.add(e);
            }
        }
        return out;
    }
}
