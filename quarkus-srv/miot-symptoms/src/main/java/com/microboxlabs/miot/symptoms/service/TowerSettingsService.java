package com.microboxlabs.miot.symptoms.service;

import com.microboxlabs.miot.symptoms.domain.TowerSettings;
import com.microboxlabs.miot.symptoms.store.TowerSettingsStore;
import io.quarkus.arc.properties.IfBuildProperty;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.HashMap;
import java.util.Map;

/** The organization's operator team: read by members, saved by owners. */
@ApplicationScoped
@IfBuildProperty(name = "miot.component.symptoms.enabled", stringValue = "true")
public class TowerSettingsService {

    static final int MAX_OPERATORS = 10_000;
    static final int MAX_CAPACITY = 1_000_000;

    private final TowerSettingsStore store;
    private final AuditService audit;

    /** {@code shiftHours} defaults to 8; the other two may be null to clear them. */
    public record SettingsRequest(Integer operators, Integer shiftHours, Integer capacityPerShift) {
    }

    @Inject
    public TowerSettingsService(TowerSettingsStore store, AuditService audit) {
        this.store = store;
        this.audit = audit;
    }

    public TowerSettings get(String tenantCode) {
        return store.find(tenantCode).orElseGet(() -> TowerSettings.defaults(tenantCode));
    }

    public TowerSettings save(String tenantCode, String actor, SettingsRequest req) {
        if (req == null) {
            throw new IllegalArgumentException("operators, shiftHours and capacityPerShift are expected");
        }
        int shiftHours = req.shiftHours() == null ? TowerSettings.DEFAULT_SHIFT_HOURS : req.shiftHours();
        if (shiftHours < 1 || shiftHours > 24) {
            throw new IllegalArgumentException("shiftHours: from 1 to 24");
        }
        range("operators", req.operators(), MAX_OPERATORS);
        range("capacityPerShift", req.capacityPerShift(), MAX_CAPACITY);
        TowerSettings saved = store.save(new TowerSettings(tenantCode, req.operators(), shiftHours,
                req.capacityPerShift(), actor, OffsetDateTime.now(ZoneOffset.UTC)));
        Map<String, Object> details = new HashMap<>();
        details.put("operators", saved.operators());
        details.put("shiftHours", saved.shiftHours());
        details.put("capacityPerShift", saved.capacityPerShift());
        audit.log(tenantCode, actor, "settings.saved", "settings", tenantCode, null, details);
        return saved;
    }

    private static void range(String field, Integer value, int max) {
        if (value != null && (value < 0 || value > max)) {
            throw new IllegalArgumentException(field + ": from 0 to " + max);
        }
    }
}
