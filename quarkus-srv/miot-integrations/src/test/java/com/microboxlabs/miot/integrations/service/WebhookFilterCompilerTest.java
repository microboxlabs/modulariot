package com.microboxlabs.miot.integrations.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.microboxlabs.miot.integrations.domain.FilterMode;
import com.microboxlabs.miot.integrations.domain.WebhookFilterScopes;
import com.microboxlabs.miot.integrations.domain.WebhookFilterSpec;
import com.microboxlabs.miot.integrations.service.WebhookFilterCompiler.CompiledFilter;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

class WebhookFilterCompilerTest {

    private WebhookFilterCompiler compiler;

    @BeforeEach
    void setUp() {
        compiler = new WebhookFilterCompiler();
    }

    @Test
    void allVisibleModeIgnoresRulesAndCompilesEmptyMembership() {
        CompiledFilter compiled = compiler.compile(
                FilterMode.ALL_VISIBLE,
                new WebhookFilterSpec(
                        new WebhookFilterScopes(false, List.of("A1"), List.of(), List.of(), List.of(), List.of()),
                        "ALL"));

        assertEquals(FilterMode.ALL_VISIBLE, compiled.filterMode());
        assertTrue(compiled.includeAllVisible());
        assertTrue(compiled.assetIds().isEmpty());
        assertTrue(compiled.spec().scopes().allVisible());
    }

    @Test
    void rulesModeCompilesExplicitAssetIds() {
        CompiledFilter compiled = compiler.compile(
                FilterMode.RULES,
                WebhookFilterSpec.fromMap(Map.of(
                        "match", "ALL",
                        "scopes", Map.of(
                                "allVisible", false,
                                "assetIds", List.of(" GZKD49 ", "GZKD49", "SVSX88")))));

        assertFalse(compiled.includeAllVisible());
        assertEquals(List.of("GZKD49", "SVSX88"), compiled.assetIds());
    }

    @Test
    void rulesModeAllVisibleFlagCompilesWithoutAssetMembership() {
        CompiledFilter compiled = compiler.compile(
                FilterMode.RULES,
                WebhookFilterSpec.fromMap(Map.of(
                        "scopes", Map.of("allVisible", true, "assetIds", List.of("X")))));

        assertTrue(compiled.includeAllVisible());
        assertTrue(compiled.assetIds().isEmpty());
    }

    @Test
    void rulesModeAcceptsFieldOnlyFiltersWithoutAssets() {
        CompiledFilter compiled = compiler.compile(
                FilterMode.RULES,
                WebhookFilterSpec.fromMap(Map.of(
                        "scopes", Map.of(
                                "gpsProviders", List.of("QuecLink"),
                                "owners", List.of("Acme")))));

        assertFalse(compiled.includeAllVisible());
        assertTrue(compiled.assetIds().isEmpty());
        assertEquals(List.of("QuecLink"), compiled.spec().scopes().gpsProviders());
    }

    @Test
    void rulesModeRejectsEmptyFilter() {
        WebhookFilterSpec emptyRules = new WebhookFilterSpec(WebhookFilterScopes.empty(), "ALL");
        IllegalArgumentException ex = assertThrows(
                IllegalArgumentException.class,
                () -> compiler.compile(FilterMode.RULES, emptyRules));
        assertTrue(ex.getMessage().contains("at least one"));
    }

    @Test
    void rulesModeRejectsNullFilter() {
        IllegalArgumentException ex = assertThrows(
                IllegalArgumentException.class,
                () -> compiler.compile(FilterMode.RULES, null));
        assertTrue(ex.getMessage().contains("filter is required"));
    }

    @Test
    void rejectsUnsupportedMatchMode() {
        WebhookFilterSpec anyMatch = new WebhookFilterSpec(
                new WebhookFilterScopes(false, List.of("A"), List.of(), List.of(), List.of(), List.of()),
                "ANY");
        assertThrows(
                IllegalArgumentException.class,
                () -> compiler.compile(FilterMode.RULES, anyMatch));
    }

    @Test
    void requiresFilterMode() {
        WebhookFilterSpec allVisible = WebhookFilterSpec.allVisible();
        assertThrows(IllegalArgumentException.class, () -> compiler.compile(null, allVisible));
    }
}
