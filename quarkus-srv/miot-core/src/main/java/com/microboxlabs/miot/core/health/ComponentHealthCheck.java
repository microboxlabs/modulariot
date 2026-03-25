package com.microboxlabs.miot.core.health;

import com.microboxlabs.miot.core.config.ComponentRegistry;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import org.eclipse.microprofile.health.HealthCheck;
import org.eclipse.microprofile.health.HealthCheckResponse;
import org.eclipse.microprofile.health.Readiness;

/**
 * Aggregated health check that reports on all active components.
 */
@Readiness
@ApplicationScoped
public class ComponentHealthCheck implements HealthCheck {

    @Inject
    ComponentRegistry registry;

    @Override
    public HealthCheckResponse call() {
        var builder = HealthCheckResponse.named("miot-components").up();
        for (var component : registry.active()) {
            var check = component.healthCheck().call();
            builder.withData(component.name(), check.getStatus().name());
            if (check.getStatus() == HealthCheckResponse.Status.DOWN) {
                builder.down();
            }
        }
        return builder.build();
    }
}
