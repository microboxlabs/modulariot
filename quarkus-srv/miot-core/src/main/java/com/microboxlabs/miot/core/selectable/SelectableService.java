package com.microboxlabs.miot.core.selectable;

import com.microboxlabs.miot.core.api.dto.SelectableBindingsRequest;
import com.microboxlabs.miot.core.api.dto.SelectableRequest;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.event.Event;
import jakarta.enterprise.inject.Instance;
import jakarta.inject.Inject;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.NoSuchElementException;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.function.Consumer;
import java.util.regex.Pattern;

/**
 * Per-organization option lists, and which form field uses which list. An
 * organization gets every {@link SelectableDefaults} list the first time it
 * asks, so a form always has something to show. Writes fire
 * {@link SelectableChanged}.
 */
@ApplicationScoped
public class SelectableService {

    private static final Pattern KEY = Pattern.compile("^[a-z][a-z0-9_]{1,63}$");

    private final SelectableStore store;
    private final Iterable<SelectableDefaults> defaults;
    private final Consumer<SelectableChanged> changed;
    private final Set<String> seeded = ConcurrentHashMap.newKeySet();
    /** One lock per tenant: every write holds it from validation to the last store change. */
    private final Map<String, Object> tenantLocks = new ConcurrentHashMap<>();

    @Inject
    public SelectableService(SelectableStore store, Instance<SelectableDefaults> defaults,
            Event<SelectableChanged> changed) {
        this(store, defaults, changed::fire);
    }

    SelectableService(SelectableStore store, Iterable<SelectableDefaults> defaults,
            Consumer<SelectableChanged> changed) {
        this.store = store;
        this.defaults = defaults;
        this.changed = changed;
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
        if (req == null || req.name() == null || req.name().isBlank()) {
            throw new IllegalArgumentException("name is required");
        }
        if (req.mode() == null) {
            throw new IllegalArgumentException("mode is required (SINGLE or MULTIPLE)");
        }
        List<SelectableOption> options = normalizeOptions(req.options());
        synchronized (lockFor(tenantCode)) {
            seedOnce(tenantCode);
            Selectable saved = store.upsert(new Selectable(
                    tenantCode, key, req.name().trim(), req.description(), req.mode(), options, actor, null));
            changed.accept(new SelectableChanged(tenantCode, actor, "selectable.replaced", key,
                    Map.of("name", saved.name(), "options", options.size())));
            return saved;
        }
    }

    public boolean delete(String tenantCode, String actor, String key) {
        validateKey(key);
        synchronized (lockFor(tenantCode)) {
            seedOnce(tenantCode);
            boolean deleted = store.delete(tenantCode, key);
            if (deleted) {
                changed.accept(new SelectableChanged(tenantCode, actor, "selectable.deleted", key, Map.of()));
            }
            return deleted;
        }
    }

    /** Drops every list and binding and puts the defaults back. A failing provider leaves everything as it was. */
    public List<Selectable> reset(String tenantCode, String actor) {
        synchronized (lockFor(tenantCode)) {
            List<Selectable> defaultLists = collectDefaults(tenantCode);
            store.clear(tenantCode);
            defaultLists.forEach(store::upsert);
            seeded.add(tenantCode);
            changed.accept(new SelectableChanged(tenantCode, actor, "selectable.reset", "all", Map.of()));
            return store.list(tenantCode);
        }
    }

    public Map<String, String> bindings(String tenantCode) {
        return store.bindings(tenantCode);
    }

    public Map<String, String> updateBindings(String tenantCode, String actor, SelectableBindingsRequest req) {
        if (req == null || req.bindings() == null || req.bindings().isEmpty()) {
            throw new IllegalArgumentException("bindings is required");
        }
        synchronized (lockFor(tenantCode)) {
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
            changed.accept(new SelectableChanged(tenantCode, actor, "selectable.bindings_updated", "bindings",
                    new LinkedHashMap<>(req.bindings())));
            return store.bindings(tenantCode);
        }
    }

    private Object lockFor(String tenantCode) {
        return tenantLocks.computeIfAbsent(tenantCode, k -> new Object());
    }

    /** A provider failure leaves the tenant unseeded, so the next read tries again. */
    private void seedOnce(String tenantCode) {
        synchronized (lockFor(tenantCode)) {
            if (seeded.contains(tenantCode)) {
                return;
            }
            if (store.list(tenantCode).isEmpty()) {
                collectDefaults(tenantCode).forEach(store::upsert);
            }
            seeded.add(tenantCode);
        }
    }

    /** Every provider's lists, collected before anything is written. */
    private List<Selectable> collectDefaults(String tenantCode) {
        List<Selectable> out = new ArrayList<>();
        for (SelectableDefaults d : defaults) {
            out.addAll(d.forTenant(tenantCode));
        }
        return out;
    }

    /** Trims names, assigns ids to options without one, and rejects nameless options and duplicate ids. */
    private static List<SelectableOption> normalizeOptions(List<SelectableOption> given) {
        List<SelectableOption> options = new ArrayList<>();
        Set<String> ids = new HashSet<>();
        for (SelectableOption o : given == null ? List.<SelectableOption>of() : given) {
            if (o == null || o.name() == null || o.name().isBlank()) {
                throw new IllegalArgumentException("every option needs a name");
            }
            String id = o.id() == null || o.id().isBlank() ? newOptionId() : o.id().trim();
            if (!ids.add(id)) {
                throw new IllegalArgumentException("duplicate option id: " + id);
            }
            options.add(new SelectableOption(id, o.name().trim(), o.description() == null ? "" : o.description()));
        }
        return options;
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
