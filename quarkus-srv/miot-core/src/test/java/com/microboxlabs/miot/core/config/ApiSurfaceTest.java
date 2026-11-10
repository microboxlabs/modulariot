package com.microboxlabs.miot.core.config;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import org.junit.jupiter.api.Test;

class ApiSurfaceTest {

    @Test
    void aWorkerServesHealthAndMetricsOnly() {
        String management = ApiSurface.managementPath("/", "q");
        assertTrue(ApiSurface.served("/q/health/ready", management));
        assertTrue(ApiSurface.served("/q/metrics", management));
        assertTrue(ApiSurface.served("/q", management));
        assertFalse(ApiSurface.served("/api/v1/orgs/acme/control-tower/device-events", management));
        assertFalse(ApiSurface.served("/webhooks/whatsapp/1", management));
        assertFalse(ApiSurface.served("/quality", management));
        assertFalse(ApiSurface.served("/", management));
        assertFalse(ApiSurface.served(null, management));
    }

    @Test
    void managementFollowsRelativeAndAbsoluteQuarkusRoots() {
        String relative = ApiSurface.managementPath("/worker/", "ops/");
        assertTrue(ApiSurface.served("/worker/ops/health/live", relative));
        assertFalse(ApiSurface.served("/q/health/live", relative));
        assertFalse(ApiSurface.served("/worker/ops-api", relative));

        String absolute = ApiSurface.managementPath("/worker", "/ops");
        assertTrue(ApiSurface.served("/ops/metrics", absolute));
        assertFalse(ApiSurface.served("/worker/ops/metrics", absolute));
    }
}
