package com.microboxlabs.miot.tracking;

import com.microboxlabs.miot.core.config.IMiotComponent;
import io.quarkus.arc.lookup.LookupIfProperty;
import jakarta.enterprise.context.ApplicationScoped;
import org.eclipse.microprofile.health.HealthCheck;
import org.eclipse.microprofile.health.HealthCheckResponse;
import org.jboss.logging.Logger;

@ApplicationScoped
@LookupIfProperty(name = "miot.component.tracking.enabled", stringValue = "true")
public class TrackingComponent implements IMiotComponent {

    private static final Logger LOG = Logger.getLogger(TrackingComponent.class);

    @Override
    public String name() {
        return "tracking";
    }

    @Override
    public int priority() {
        return 200;
    }

    @Override
    public void onStart() {
        LOG.info("Tracking component started");
    }

    @Override
    public void onStop() {
        LOG.info("Tracking component stopped");
    }

    @Override
    public HealthCheck healthCheck() {
        return () -> HealthCheckResponse.named("tracking").up().build();
    }
}
