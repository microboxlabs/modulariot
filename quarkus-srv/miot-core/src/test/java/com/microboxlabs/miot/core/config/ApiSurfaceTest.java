package com.microboxlabs.miot.core.config;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import org.junit.jupiter.api.Test;

class ApiSurfaceTest {

    @Test
    void aWorkerServesHealthAndMetricsOnly() {
        assertTrue(ApiSurface.served("/q/health/ready"));
        assertTrue(ApiSurface.served("/q/metrics"));
        assertTrue(ApiSurface.served("/q"));
        assertFalse(ApiSurface.served("/api/v1/orgs/acme/control-tower/device-events"));
        assertFalse(ApiSurface.served("/webhooks/whatsapp/1"));
        assertFalse(ApiSurface.served("/quality"));
        assertFalse(ApiSurface.served("/"));
        assertFalse(ApiSurface.served(null));
    }
}
