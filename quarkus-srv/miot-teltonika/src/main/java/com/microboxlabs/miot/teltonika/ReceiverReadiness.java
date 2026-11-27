package com.microboxlabs.miot.teltonika;

import io.quarkus.arc.properties.IfBuildProperty;
import io.smallrye.health.api.HealthGroup;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.inject.Instance;
import org.eclipse.microprofile.health.HealthCheck;
import org.eclipse.microprofile.health.HealthCheckResponse;

/**
 * Readiness of the receiver's own deployment, at {@code /q/health/group/teltonika}: DOWN until the
 * device registry is loaded and the listener is open, and while draining. Kept out of the pod-wide
 * readiness so the receiver can never take an API pod out of service.
 */
@ApplicationScoped
@HealthGroup("teltonika")
@IfBuildProperty(name = "miot.component.teltonika.enabled", stringValue = "true")
public class ReceiverReadiness implements HealthCheck {

    private final Instance<TeltonikaComponent> component;

    ReceiverReadiness(Instance<TeltonikaComponent> component) {
        this.component = component;
    }

    @Override
    public HealthCheckResponse call() {
        if (!component.isResolvable()) {
            return HealthCheckResponse.named("teltonika-receiver").down().withData("state", "disabled").build();
        }
        TeltonikaComponent c = component.get();
        var builder = HealthCheckResponse.named("teltonika-receiver").status(c.ready());
        c.describe().forEach((k, v) -> builder.withData(k, String.valueOf(v)));
        return builder.build();
    }
}
