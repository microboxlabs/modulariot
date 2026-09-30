package com.microboxlabs.miot.core.selectable;

import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.locks.ReentrantLock;
import java.util.function.Supplier;

/** Process-local store for the service unit tests. Not a bean, so {@code @QuarkusTest} gets the JDBC one. */
class InMemorySelectableStore implements SelectableStore {

    private final Map<String, Map<String, Selectable>> byTenant = new LinkedHashMap<>();
    private final Map<String, Map<String, String>> bindingsByTenant = new LinkedHashMap<>();
    private final Set<String> seeded = new HashSet<>();
    private final Map<String, ReentrantLock> tenantLocks = new ConcurrentHashMap<>();

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
        Selectable saved = new Selectable(s.tenantCode(), s.key(), s.name(), s.description(), s.mode(), s.settings(),
                s.groups(), s.source(), List.copyOf(s.options()), s.updatedBy(), OffsetDateTime.now(ZoneOffset.UTC));
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
    public synchronized Map<String, String> bindings(String tenantCode) {
        return new LinkedHashMap<>(bindingsByTenant.getOrDefault(tenantCode, Map.of()));
    }

    @Override
    public synchronized void bindAll(String tenantCode, Map<String, String> fieldToSelectable) {
        Map<String, Selectable> lists = byTenant.getOrDefault(tenantCode, Map.of());
        fieldToSelectable.values().forEach(key -> {
            if (!lists.containsKey(key)) {
                throw new IllegalArgumentException("unknown selectable: " + key);
            }
        });
        bindingsByTenant.computeIfAbsent(tenantCode, k -> new LinkedHashMap<>()).putAll(fieldToSelectable);
    }

    @Override
    public synchronized boolean isSeeded(String tenantCode) {
        return seeded.contains(tenantCode);
    }

    @Override
    public synchronized void seed(String tenantCode, List<Selectable> defaults) {
        if (seeded.add(tenantCode)) {
            defaults.forEach(this::upsert);
        }
    }

    /** Not synchronized on the store, so other calls go through while a tenant is locked. */
    @Override
    public <T> T locked(String tenantCode, Supplier<T> work) {
        ReentrantLock lock = tenantLocks.computeIfAbsent(tenantCode, k -> new ReentrantLock());
        lock.lock();
        try {
            return work.get();
        } finally {
            lock.unlock();
        }
    }

    @Override
    public synchronized void resetTo(String tenantCode, List<Selectable> lists) {
        byTenant.remove(tenantCode);
        bindingsByTenant.remove(tenantCode);
        lists.forEach(this::upsert);
        seeded.add(tenantCode);
    }
}
