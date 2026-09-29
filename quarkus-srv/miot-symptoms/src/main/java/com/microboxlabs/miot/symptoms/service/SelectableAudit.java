package com.microboxlabs.miot.symptoms.service;

import com.microboxlabs.miot.core.selectable.SelectableChanged;
import io.quarkus.arc.properties.IfBuildProperty;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.event.Observes;
import jakarta.inject.Inject;

/** Records core selectable writes in the Control Tower audit log, entity type {@code selectable}. */
@ApplicationScoped
@IfBuildProperty(name = "miot.component.symptoms.enabled", stringValue = "true")
public class SelectableAudit {

    static final String ENTITY = "selectable";

    private final AuditService audit;

    @Inject
    public SelectableAudit(AuditService audit) {
        this.audit = audit;
    }

    void onChanged(@Observes SelectableChanged e) {
        audit.record(e.tenantCode(), e.actor(), e.action(), ENTITY, e.key(), null, e.details());
    }
}
