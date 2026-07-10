package com.microboxlabs.miot.integrations.service;

import com.microboxlabs.miot.integrations.domain.FilterMode;
import com.microboxlabs.miot.integrations.domain.WebhookFilterScopes;
import com.microboxlabs.miot.integrations.domain.WebhookFilterSpec;
import jakarta.enterprise.context.ApplicationScoped;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;

/**
 * Validates filter documents and compiles membership for the hot path.
 *
 * <p>v1 expands only explicit {@code assetIds}. Carrier → asset expansion is a later phase;
 * carrier-only rules are accepted in storage but compile to an empty membership until
 * fleet expansion is wired (worker still applies field predicates for provider/owner).
 */
@ApplicationScoped
public class WebhookFilterCompiler {

    public record CompiledFilter(
            FilterMode filterMode,
            WebhookFilterSpec spec,
            boolean includeAllVisible,
            List<String> assetIds) {
    }

    /**
     * Validates and normalizes the request into a compiled filter snapshot.
     *
     * @throws IllegalArgumentException when the filter is empty or inconsistent
     */
    public CompiledFilter compile(FilterMode mode, WebhookFilterSpec input) {
        if (mode == null) {
            throw new IllegalArgumentException("filterMode is required");
        }
        WebhookFilterSpec spec = input == null ? WebhookFilterSpec.allVisible() : input;
        if (!WebhookFilterSpec.MATCH_ALL.equals(spec.match())) {
            throw new IllegalArgumentException("Only match=ALL is supported in v1");
        }

        if (mode == FilterMode.ALL_VISIBLE) {
            WebhookFilterSpec allVisibleSpec = WebhookFilterSpec.allVisible();
            return new CompiledFilter(mode, allVisibleSpec, true, List.of());
        }

        WebhookFilterScopes scopes = spec.scopes();
        if (!scopes.hasAnyRuleDimension()) {
            throw new IllegalArgumentException(
                    "RULES filter must set at least one of: allVisible, assetIds, carrierIds, "
                            + "ingestClientIds, gpsProviders, owners");
        }

        // allVisible inside RULES means "all visible assets" and ignores asset membership list
        if (scopes.allVisible()) {
            return new CompiledFilter(mode, spec, true, List.of());
        }

        Set<String> assets = new LinkedHashSet<>(scopes.assetIds());
        // carrierIds: deferred expansion (PR5) — membership stays asset-list only for now
        return new CompiledFilter(mode, spec, false, List.copyOf(assets));
    }
}
