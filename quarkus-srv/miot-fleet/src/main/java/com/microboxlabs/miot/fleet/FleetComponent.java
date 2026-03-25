package com.microboxlabs.miot.fleet;

import com.microboxlabs.miot.core.config.IMiotComponent;
import io.quarkus.arc.lookup.LookupIfProperty;
import jakarta.enterprise.context.ApplicationScoped;
import org.eclipse.microprofile.health.HealthCheck;
import org.eclipse.microprofile.health.HealthCheckResponse;
import org.jboss.logging.Logger;

@ApplicationScoped
@LookupIfProperty(name = "miot.component.fleet.enabled", stringValue = "true")
public class FleetComponent implements IMiotComponent {

    private static final Logger LOG = Logger.getLogger(FleetComponent.class);

    @Override
    public String name() {
        return "fleet";
    }

    @Override
    public int priority() {
        return 100;
    }

    @Override
    public void onStart() {
        LOG.info("Fleet component started");
    }

    @Override
    public void onStop() {
        LOG.info("Fleet component stopped");
    }

    @Override
    public HealthCheck healthCheck() {
        return () -> HealthCheckResponse.named("fleet").up().build();
    }
}
