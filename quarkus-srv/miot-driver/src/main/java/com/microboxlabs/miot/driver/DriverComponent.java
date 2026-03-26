package com.microboxlabs.miot.driver;

import com.microboxlabs.miot.core.config.IMiotComponent;
import io.quarkus.arc.lookup.LookupIfProperty;
import jakarta.enterprise.context.ApplicationScoped;
import org.eclipse.microprofile.health.HealthCheck;
import org.eclipse.microprofile.health.HealthCheckResponse;
import org.jboss.logging.Logger;

@ApplicationScoped
@LookupIfProperty(name = "miot.component.driver.enabled", stringValue = "true")
public class DriverComponent implements IMiotComponent {

    private static final Logger LOG = Logger.getLogger(DriverComponent.class);

    @Override
    public String name() {
        return "driver";
    }

    @Override
    public int priority() {
        return 200;
    }

    @Override
    public void onStart() {
        LOG.info("Driver component started");
    }

    @Override
    public void onStop() {
        LOG.info("Driver component stopped");
    }

    @Override
    public HealthCheck healthCheck() {
        return () -> HealthCheckResponse.named("driver").up().build();
    }
}
