package com.microboxlabs.miot.core.selectable;

import com.microboxlabs.miot.core.api.dto.SelectableBindingsRequest;
import com.microboxlabs.miot.core.api.dto.SelectableRequest;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.event.Event;
import jakarta.enterprise.inject.Instance;
import jakarta.inject.Inject;
import java.text.Normalizer;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.NoSuchElementException;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import java.util.function.Consumer;
import java.util.function.Supplier;

/**
 * Per-organization option lists, and which form field uses which list. An
 * organization gets every {@link SelectableDefaults} list the first time it
 * asks, so a form always has something to show. Writes fire
 * {@link SelectableChanged}.
 */
@ApplicationScoped
public class SelectableService {

    public static final int DEFAULT_OPTION_LIMIT = 50;
    private static final int MAX_OPTION_LIMIT = 200;

    private final SelectableStore store;
    private final Iterable<SelectableDefaults> defaults;
    private final Iterable<SelectableOptionSource> sources;
    private final Consumer<SelectableChanged> changed;
    private final Set<String> seeded = ConcurrentHashMap.newKeySet();
    /**
     * Every write holds the tenant's lock from validation to the last store
     * change: this one inside the process, then the store's across replicas.
     */
    private final Map<String, Object> tenantLocks = new ConcurrentHashMap<>();

    @Inject
    public SelectableService(SelectableStore store, Instance<SelectableDefaults> defaults,
            Instance<SelectableOptionSource> sources, Event<SelectableChanged> changed) {
        this(store, defaults, sources, changed::fire);
    }

    SelectableService(SelectableStore store, Iterable<SelectableDefaults> defaults,
            Iterable<SelectableOptionSource> sources, Consumer<SelectableChanged> changed) {
        this.store = store;
        this.defaults = defaults;
        this.sources = sources;
        this.changed = changed;
    }

    SelectableService(SelectableStore store, Iterable<SelectableDefaults> defaults,
            Consumer<SelectableChanged> changed) {
        this(store, defaults, List.of(), changed);
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
        SelectableRules.validateListKey(key);
        if (req == null) {
            throw new IllegalArgumentException("body is required");
        }
        Map<String, String> name = Localized.required(req.name(), "name");
        if (req.mode() == null) {
            throw new IllegalArgumentException("mode is required (SINGLE or MULTIPLE)");
        }
        SelectableSource source = SelectableRules.source(req.source());
        if (!source.isStatic() && req.options() != null && !req.options().isEmpty()) {
            throw new IllegalArgumentException("a " + source.kind() + " list fetches its options; send none");
        }
        List<SelectableGroup> groups = SelectableRules.groups(req.groups());
        seedOnce(tenantCode);
        Selectable saved = withTenantLock(tenantCode, () -> {
            Map<String, Selectable> lists = byKey(tenantCode);
            SelectableSettings settings = SelectableRules.settings(req.settings(), req.mode(), key, lists.keySet());
            rejectCycle(lists, key, settings.dependsOn());
            List<SelectableOption> options = SelectableRules.options(req.options(), groups, settings);
            if (!source.isStatic()) {
                requireSource(tenantCode, source);
            }
            return store.upsert(new Selectable(tenantCode, key, name,
                    Localized.clean(req.description(), "description"), req.mode(), settings, groups, source,
                    options, actor, null));
        });
        changed.accept(new SelectableChanged(tenantCode, actor, "selectable.replaced", key,
                Map.of("name", Localized.preferred(name), "options", saved.options().size(),
                        "source", source.kind().name())));
        return saved;
    }

    /** A list another one depends on cannot be deleted until that one stops depending on it. */
    public boolean delete(String tenantCode, String actor, String key) {
        validateKey(key);
        seedOnce(tenantCode);
        boolean deleted = withTenantLock(tenantCode, () -> {
            List<String> dependents = store.list(tenantCode).stream()
                    .filter(s -> key.equals(s.settings().dependsOn()))
                    .map(Selectable::key)
                    .toList();
            if (!dependents.isEmpty()) {
                throw new IllegalArgumentException("lists " + dependents + " depend on " + key);
            }
            return store.delete(tenantCode, key);
        });
        if (deleted) {
            changed.accept(new SelectableChanged(tenantCode, actor, "selectable.deleted", key, Map.of()));
        }
        return deleted;
    }

    /** Drops every list and binding and puts the defaults back. A failing provider leaves everything as it was. */
    public List<Selectable> reset(String tenantCode, String actor) {
        List<Selectable> lists = withTenantLock(tenantCode, () -> {
            store.resetTo(tenantCode, collectDefaults(tenantCode));
            return store.list(tenantCode);
        });
        seeded.add(tenantCode);
        changed.accept(new SelectableChanged(tenantCode, actor, "selectable.reset", "all", Map.of()));
        return lists;
    }

    public Map<String, String> bindings(String tenantCode) {
        return store.bindings(tenantCode);
    }

    public Map<String, String> updateBindings(String tenantCode, String actor, SelectableBindingsRequest req) {
        if (req == null || req.bindings() == null || req.bindings().isEmpty()) {
            throw new IllegalArgumentException("bindings is required");
        }
        seedOnce(tenantCode);
        Map<String, String> bound = withTenantLock(tenantCode, () -> {
            Set<String> known = byKey(tenantCode).keySet();
            for (Map.Entry<String, String> e : req.bindings().entrySet()) {
                validateKey(e.getKey());
                validateKey(e.getValue());
                if (!known.contains(e.getValue())) {
                    throw new IllegalArgumentException("unknown selectable: " + e.getValue());
                }
            }
            store.bindAll(tenantCode, req.bindings());
            return store.bindings(tenantCode);
        });
        changed.accept(new SelectableChanged(tenantCode, actor, "selectable.bindings_updated", "bindings",
                new LinkedHashMap<>(req.bindings())));
        return bound;
    }

    /**
     * The options a field shows: a static list's own, filtered here, or what
     * its source returns.
     *
     * @param parents values selected in the list this one depends on; empty means all
     */
    public List<SelectableOption> options(String tenantCode, String key, String search, List<String> parents,
            Integer limit) {
        Selectable list = get(tenantCode, key);
        int max = limit == null ? DEFAULT_OPTION_LIMIT : Math.clamp(limit, 1, MAX_OPTION_LIMIT);
        List<String> parentValues = parents == null ? List.of() : parents;
        if (!list.source().isStatic()) {
            return requireSource(tenantCode, list.source())
                    .options(tenantCode, list.source(), new SelectableOptionSource.Query(search, parentValues, max))
                    .stream().limit(max).toList();
        }
        String needle = fold(search);
        return list.options().stream()
                .filter(o -> parentValues.isEmpty() || parentValues.contains(o.parent()))
                .filter(o -> needle.isEmpty() || matches(o, needle))
                .limit(max)
                .toList();
    }

    /** Every non-static source an editor can pick for this tenant. */
    public List<SelectableOptionSource.Descriptor> sources(String tenantCode) {
        List<SelectableOptionSource.Descriptor> out = new ArrayList<>();
        sources.forEach(s -> out.addAll(s.describe(tenantCode)));
        return out;
    }

    private SelectableOptionSource requireSource(String tenantCode, SelectableSource source) {
        for (SelectableOptionSource s : sources) {
            if (s.kind() != source.kind()) {
                continue;
            }
            boolean match = source.kind() == SelectableSource.Kind.CONNECTION
                    ? s.describe(tenantCode).stream().anyMatch(d -> source.ref().equals(d.ref()))
                    : source.ref().equals(s.id());
            if (match) {
                return s;
            }
        }
        throw new IllegalArgumentException("unknown " + source.kind() + " source: " + source.ref());
    }

    static boolean matches(SelectableOption o, String needle) {
        return fold(o.value()).contains(needle)
                || o.label().values().stream().anyMatch(text -> fold(text).contains(needle));
    }

    /** Lower case without accents, so "region" finds "Región". */
    static String fold(String text) {
        if (text == null || text.isBlank()) {
            return "";
        }
        return Normalizer.normalize(text.trim(), Normalizer.Form.NFD).replaceAll("\\p{M}", "")
                .toLowerCase(Locale.ROOT);
    }

    /** The tenant's lists by key, in creation order; the caller has seeded the tenant. */
    private Map<String, Selectable> byKey(String tenantCode) {
        Map<String, Selectable> out = new LinkedHashMap<>();
        store.list(tenantCode).forEach(s -> out.put(s.key(), s));
        return out;
    }

    /** Following {@code dependsOn} from the new value must not lead back to {@code key}. */
    private static void rejectCycle(Map<String, Selectable> lists, String key, String dependsOn) {
        Set<String> seen = new HashSet<>();
        String next = dependsOn;
        while (next != null && seen.add(next)) {
            if (next.equals(key)) {
                throw new IllegalArgumentException("dependsOn " + dependsOn + " would form a cycle through " + key);
            }
            Selectable list = lists.get(next);
            next = list == null ? null : list.settings().dependsOn();
        }
    }

    /**
     * Runs {@code work} under the tenant's lock. The store may run it as one
     * transaction, so callers change in-memory state and fire events only
     * after it returns.
     */
    private <T> T withTenantLock(String tenantCode, Supplier<T> work) {
        synchronized (tenantLocks.computeIfAbsent(tenantCode, k -> new Object())) {
            return store.locked(tenantCode, work);
        }
    }

    /**
     * The store records which tenants were seeded, so deleting every list does
     * not bring the defaults back, even after a restart. A provider failure
     * leaves the tenant unseeded, so the next read tries again. Runs as its
     * own step, so a write that fails afterwards does not undo the seed.
     */
    private void seedOnce(String tenantCode) {
        if (seeded.contains(tenantCode)) {
            return;
        }
        withTenantLock(tenantCode, () -> {
            if (!store.isSeeded(tenantCode)) {
                store.seed(tenantCode, collectDefaults(tenantCode));
            }
            return null;
        });
        seeded.add(tenantCode);
    }

    /**
     * Every provider's lists, collected before anything is written, each
     * stamped with {@code tenantCode} whatever tenant the provider put on it.
     */
    private List<Selectable> collectDefaults(String tenantCode) {
        List<Selectable> out = new ArrayList<>();
        for (SelectableDefaults d : defaults) {
            for (Selectable s : d.forTenant(tenantCode)) {
                out.add(s.forTenant(tenantCode));
            }
        }
        return out;
    }

    static void validateKey(String key) {
        SelectableRules.validateKey(key);
    }
}
