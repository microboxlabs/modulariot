package com.microboxlabs.miot.core.selectable;

import jakarta.enterprise.context.ApplicationScoped;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

/** Process-local store: lists are lost on restart. */
@ApplicationScoped
public class InMemorySelectableStore implements SelectableStore {

    private final Map<String, Map<String, Selectable>> byTenant = new LinkedHashMap<>();
    private final Map<String, Map<String, String>> bindingsByTenant = new LinkedHashMap<>();

    @Override
    public synchronized List<Selectable> list(String tenantCode) {
        return new ArrayList<>(byTenant.getOrDefault(tenantCode, Map.of()).values());
    }

    @Override
    public synchronized Optional<Selectable> find(String tenantCode, String key) {
        return Optional.ofNullable(byTenant.getOrDefault(tenantCode, Map.of()).get(key));
    }

    @Override
    public synchronized Selectable upsert(Selectable s) {
        Selectable saved = new Selectable(s.tenantCode(), s.key(), s.name(), s.description(), s.mode(),
                List.copyOf(s.options()), s.updatedBy(), OffsetDateTime.now());
        byTenant.computeIfAbsent(s.tenantCode(), k -> new LinkedHashMap<>()).put(s.key(), saved);
        return saved;
    }

    @Override
    public synchronized boolean delete(String tenantCode, String key) {
        Map<String, Selectable> tenant = byTenant.get(tenantCode);
        if (tenant == null || tenant.remove(key) == null) {
            return false;
        }
        Map<String, String> bindings = bindingsByTenant.get(tenantCode);
        if (bindings != null) {
            bindings.values().removeIf(key::equals);
        }
        return true;
    }

    @Override
    public synchronized void clear(String tenantCode) {
        byTenant.remove(tenantCode);
        bindingsByTenant.remove(tenantCode);
    }

    @Override
    public synchronized Map<String, String> bindings(String tenantCode) {
        return new LinkedHashMap<>(bindingsByTenant.getOrDefault(tenantCode, Map.of()));
    }

    @Override
    public synchronized void bind(String tenantCode, String fieldKey, String selectableKey) {
        bindingsByTenant.computeIfAbsent(tenantCode, k -> new LinkedHashMap<>()).put(fieldKey, selectableKey);
    }
}
