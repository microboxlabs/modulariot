package com.microboxlabs.miot.gateway.fork;

import com.microboxlabs.miot.gateway.fork.model.ForkRule;
import io.micrometer.core.instrument.Gauge;
import io.micrometer.core.instrument.MeterRegistry;
import io.quarkus.arc.properties.IfBuildProperty;
import jakarta.enterprise.context.ApplicationScoped;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Collection;
import java.util.Optional;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import java.util.stream.Collectors;
import java.util.stream.Stream;
import org.jboss.logging.Logger;

/**
 * In-memory routing key filter for all fork rules.
 *
 * <p>Reads are lock-free (ConcurrentHashMap.newKeySet). Writes (add/remove/reload)
 * are thread-safe. File reload atomically swaps the set via ConcurrentHashMap.put,
 * so readers see either the old or new set with no intermediate empty state.
 *
 * <p>One Micrometer gauge per rule tracks the live filter size.
 */
@ApplicationScoped
@IfBuildProperty(name = "miot.component.gateway.enabled", stringValue = "true")
public class ForkFilterRegistry {

    private static final Logger LOG = Logger.getLogger(ForkFilterRegistry.class);

    private final MeterRegistry meterRegistry;

    /** rule-id → Set of routing keys (e.g. asset IDs). */
    private final ConcurrentHashMap<String, Set<String>> filters = new ConcurrentHashMap<>();

    /** rule-id → file path (for reload). */
    private final ConcurrentHashMap<String, Path> filePaths = new ConcurrentHashMap<>();

    ForkFilterRegistry(MeterRegistry meterRegistry) {
        this.meterRegistry = meterRegistry;
    }

    // -------------------------------------------------------------------------
    // Lifecycle
    // -------------------------------------------------------------------------

    /**
     * Register a rule. Creates the filter set, loads the filter file if configured,
     * and registers a gauge metric for the filter size.
     * Called by ForkEngine during startup for each enabled rule.
     */
    public void register(ForkRule rule) {
        filters.putIfAbsent(rule.id(), ConcurrentHashMap.newKeySet());

        rule.filterFile().ifPresent(pathStr -> {
            filePaths.put(rule.id(), Path.of(pathStr));
            int loaded = readFile(rule.id(), Path.of(pathStr));
            LOG.infof("Rule '%s': loaded %d key(s) from %s", rule.id(), loaded, pathStr);
        });

        Gauge.builder("fork_filter_size", filters, m -> {
                    Set<String> s = m.get(rule.id());
                    return s == null ? 0d : (double) s.size();
                })
                .tag("rule", rule.id())
                .description("Number of routing keys currently active in the fork filter")
                .register(meterRegistry);
    }

    // -------------------------------------------------------------------------
    // Read (hot path — called on every mirrored request)
    // -------------------------------------------------------------------------

    public boolean contains(String ruleId, String key) {
        Set<String> ids = filters.get(ruleId);
        return ids != null && ids.contains(key);
    }

    // -------------------------------------------------------------------------
    // Management API support
    // -------------------------------------------------------------------------

    /** Add one or more keys to the in-memory filter for a rule. Returns count of newly added keys. */
    public int add(String ruleId, Collection<String> keys) {
        Set<String> ids = filters.computeIfAbsent(ruleId, k -> ConcurrentHashMap.newKeySet());
        int added = 0;
        for (String key : keys) {
            if (key == null) continue;
            String trimmed = key.trim();
            if (!trimmed.isBlank() && ids.add(trimmed)) {
                added++;
            }
        }
        return added;
    }

    /** Remove a single key. Returns true if the key was present. */
    public boolean remove(String ruleId, String key) {
        Set<String> ids = filters.get(ruleId);
        return ids != null && ids.remove(key.trim());
    }

    /**
     * Reload the filter for a rule from its configured file.
     * Atomically replaces the entire set — no empty-state window for readers.
     *
     * @return number of keys loaded from the file
     * @throws IllegalStateException if the rule has no filter file configured
     */
    public int reload(String ruleId) {
        Path path = filePaths.get(ruleId);
        if (path == null) {
            throw new IllegalStateException("Rule '" + ruleId + "' has no filter file configured");
        }
        int loaded = readFile(ruleId, path);
        LOG.infof("Rule '%s': reloaded %d key(s) from %s", ruleId, loaded, path);
        return loaded;
    }

    /** Returns an immutable snapshot of the current filter for a rule. */
    public Optional<Set<String>> inspect(String ruleId) {
        Set<String> ids = filters.get(ruleId);
        return Optional.ofNullable(ids).map(Set::copyOf);
    }

    public boolean isKnown(String ruleId) {
        return filters.containsKey(ruleId);
    }

    public boolean hasFilterFile(String ruleId) {
        return filePaths.containsKey(ruleId);
    }

    // -------------------------------------------------------------------------
    // Internal
    // -------------------------------------------------------------------------

    /**
     * Reads a plain-text file (one key per line, # comments and blank lines ignored)
     * and atomically replaces the filter set for the given rule.
     */
    private int readFile(String ruleId, Path path) {
        try (Stream<String> lines = Files.lines(path)) {
            Set<String> loaded = lines
                    .map(String::trim)
                    .filter(line -> !line.isBlank() && !line.startsWith("#"))
                    .collect(Collectors.toCollection(ConcurrentHashMap::newKeySet));
            // Atomic swap — readers see old or new, never an empty intermediate state
            filters.put(ruleId, loaded);
            return loaded.size();
        } catch (IOException e) {
            LOG.errorf(e, "Rule '%s': failed to read filter file %s", ruleId, path);
            return 0;
        }
    }
}
