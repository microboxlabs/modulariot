package com.microboxlabs.miot.symptoms.service;

import com.microboxlabs.miot.symptoms.domain.Selectable;
import com.microboxlabs.miot.symptoms.domain.SelectableOption;
import com.microboxlabs.miot.symptoms.dto.SelectableBindingsRequest;
import com.microboxlabs.miot.symptoms.dto.SelectableRequest;
import com.microboxlabs.miot.symptoms.store.SelectableStore;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.NoSuchElementException;
import java.util.Set;
import java.util.UUID;
import java.util.regex.Pattern;

/**
 * Option lists behind the treatment forms. An organization gets
 * {@link DefaultSelectables} the first time it asks, so the forms and the
 * settings page always have something to show.
 */
@ApplicationScoped
public class SelectableService {

    static final String ENTITY = "selectable";
    private static final Pattern KEY = Pattern.compile("^[a-z][a-z0-9_]{1,63}$");

    private final SelectableStore store;
    private final AuditService audit;
    private final Set<String> seeded = new HashSet<>();

    @Inject
    public SelectableService(SelectableStore store, AuditService audit) {
        this.store = store;
        this.audit = audit;
    }

    public List<Selectable> list(String tenantCode) {
        seedOnce(tenantCode);
        return store.list(tenantCode);
    }

    public Selectable get(String tenantCode, String key) {
        validateKey(key);
        seedOnce(tenantCode);
        return store.find(tenantCode, key).orElseThrow(() -> new NoSuchElementException("selectable not found: " + key));
    }

    public Selectable replace(String tenantCode, String actor, String key, SelectableRequest req) {
        validateKey(key);
        seedOnce(tenantCode);
        if (req == null || req.name() == null || req.name().isBlank()) {
            throw new IllegalArgumentException("name is required");
        }
        if (req.mode() == null) {
            throw new IllegalArgumentException("mode is required (SINGLE or MULTIPLE)");
        }
        List<SelectableOption> options = new ArrayList<>();
        Set<String> ids = new HashSet<>();
        for (SelectableOption o : req.options() == null ? List.<SelectableOption>of() : req.options()) {
            if (o == null || o.name() == null || o.name().isBlank()) {
                throw new IllegalArgumentException("every option needs a name");
            }
            String id = o.id() == null || o.id().isBlank() ? newOptionId() : o.id().trim();
            if (!ids.add(id)) {
                throw new IllegalArgumentException("duplicate option id: " + id);
            }
            options.add(new SelectableOption(id, o.name().trim(), o.description() == null ? "" : o.description()));
        }
        Selectable saved = store.upsert(new Selectable(
                tenantCode, key, req.name().trim(), req.description(), req.mode(), options, actor, null));
        audit.record(tenantCode, actor, "selectable.replaced", ENTITY, key, null,
                Map.of("name", saved.name(), "options", options.size()));
        return saved;
    }

    public boolean delete(String tenantCode, String actor, String key) {
        validateKey(key);
        seedOnce(tenantCode);
        boolean deleted = store.delete(tenantCode, key);
        if (deleted) {
            audit.record(tenantCode, actor, "selectable.deleted", ENTITY, key, null, Map.of());
        }
        return deleted;
    }

    /** Drops every list and binding and puts the defaults back. */
    public List<Selectable> reset(String tenantCode, String actor) {
        synchronized (seeded) {
            store.clear(tenantCode);
            DefaultSelectables.forTenant(tenantCode).forEach(store::upsert);
            seeded.add(tenantCode);
        }
        audit.record(tenantCode, actor, "selectable.reset", ENTITY, "all", null, Map.of());
        return store.list(tenantCode);
    }

    public Map<String, String> bindings(String tenantCode) {
        return store.bindings(tenantCode);
    }

    public Map<String, String> updateBindings(String tenantCode, String actor, SelectableBindingsRequest req) {
        if (req == null || req.bindings() == null || req.bindings().isEmpty()) {
            throw new IllegalArgumentException("bindings is required");
        }
        Set<String> known = new HashSet<>();
        list(tenantCode).forEach(s -> known.add(s.key()));
        for (Map.Entry<String, String> e : req.bindings().entrySet()) {
            validateKey(e.getKey());
            validateKey(e.getValue());
            if (!known.contains(e.getValue())) {
                throw new IllegalArgumentException("unknown selectable: " + e.getValue());
            }
        }
        req.bindings().forEach((field, key) -> store.bind(tenantCode, field, key));
        audit.record(tenantCode, actor, "selectable.bindings_updated", ENTITY, "bindings", null,
                new LinkedHashMap<>(req.bindings()));
        return store.bindings(tenantCode);
    }

    private void seedOnce(String tenantCode) {
        synchronized (seeded) {
            if (seeded.add(tenantCode) && store.list(tenantCode).isEmpty()) {
                DefaultSelectables.forTenant(tenantCode).forEach(store::upsert);
            }
        }
    }

    static void validateKey(String key) {
        if (key == null || !KEY.matcher(key).matches()) {
            throw new IllegalArgumentException("key must match [a-z][a-z0-9_]{1,63}: " + key);
        }
    }

    static String newOptionId() {
        return "opt_" + UUID.randomUUID().toString().replace("-", "").substring(0, 12);
    }
}
