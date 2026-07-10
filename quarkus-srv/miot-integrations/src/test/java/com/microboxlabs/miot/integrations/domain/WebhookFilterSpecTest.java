package com.microboxlabs.miot.integrations.domain;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;

class WebhookFilterSpecTest {

    @Test
    void fromMapRoundTripsScopes() {
        Map<String, Object> raw = Map.of(
                "match", "all",
                "scopes", Map.of(
                        "allVisible", false,
                        "assetIds", List.of("A1", "A2"),
                        "carrierIds", List.of("c1"),
                        "ingestClientIds", List.of("client-x"),
                        "gpsProviders", List.of("QuecLink"),
                        "owners", List.of("Owner Co")));

        WebhookFilterSpec spec = WebhookFilterSpec.fromMap(raw);
        assertEquals("ALL", spec.match());
        assertEquals(List.of("A1", "A2"), spec.scopes().assetIds());
        assertEquals(List.of("c1"), spec.scopes().carrierIds());
        assertEquals(List.of("client-x"), spec.scopes().ingestClientIds());
        assertEquals(List.of("QuecLink"), spec.scopes().gpsProviders());
        assertEquals(List.of("Owner Co"), spec.scopes().owners());
        assertFalse(spec.scopes().allVisible());

        Map<String, Object> encoded = spec.toMap();
        WebhookFilterSpec again = WebhookFilterSpec.fromMap(encoded);
        assertEquals(spec.scopes().assetIds(), again.scopes().assetIds());
        assertEquals(spec.match(), again.match());
    }

    @Test
    void allVisibleFactory() {
        WebhookFilterSpec spec = WebhookFilterSpec.allVisible();
        assertTrue(spec.scopes().allVisible());
        assertTrue(spec.scopes().hasAnyRuleDimension());
    }

    @Test
    void emptyMapDefaultsToAllVisible() {
        WebhookFilterSpec spec = WebhookFilterSpec.fromMap(Map.of());
        assertTrue(spec.scopes().allVisible());
    }
}
