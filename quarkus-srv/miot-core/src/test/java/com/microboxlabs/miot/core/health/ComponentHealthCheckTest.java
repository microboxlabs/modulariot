package com.microboxlabs.miot.core.health;

import static org.junit.jupiter.api.Assertions.assertEquals;

import com.microboxlabs.miot.core.config.ComponentRegistry;
import com.microboxlabs.miot.core.config.IMiotComponent;
import java.util.List;
import org.eclipse.microprofile.health.HealthCheck;
import org.eclipse.microprofile.health.HealthCheckResponse;
import org.junit.jupiter.api.Test;

class ComponentHealthCheckTest {

    @Test
    void readinessIncludesTheComponentsDetailsAndFailure() {
        IMiotComponent component = new IMiotComponent() {
            @Override
            public String name() {
                return "symptoms";
            }

            @Override
            public int priority() {
                return 160;
            }

            @Override
            public void onStart() {
                // This fixture has no lifecycle resources.
            }

            @Override
            public void onStop() {
                // This fixture has no lifecycle resources.
            }

            @Override
            public HealthCheck healthCheck() {
                return () -> HealthCheckResponse.named("symptoms").down()
                        .withData("parts", "device-events,evaluator")
                        .withData("routes", 2).withData("gps", "CONFIGURED").build();
            }
        };
        ComponentHealthCheck check = new ComponentHealthCheck();
        check.registry = new ComponentRegistry() {
            @Override
            public List<IMiotComponent> active() {
                return List.of(component);
            }
        };

        var response = check.call();
        assertEquals(HealthCheckResponse.Status.DOWN, response.getStatus());
        var data = response.getData().orElseThrow();
        assertEquals("DOWN", data.get("symptoms"));
        assertEquals("device-events,evaluator", data.get("symptoms.parts"));
        assertEquals("2", data.get("symptoms.routes"));
        assertEquals("CONFIGURED", data.get("symptoms.gps"));
    }
}
