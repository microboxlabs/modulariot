package com.microboxlabs.miot.integrations;

import com.microboxlabs.miot.core.config.IMiotComponent;
import io.quarkus.arc.lookup.LookupIfProperty;
import jakarta.enterprise.context.ApplicationScoped;
import org.eclipse.microprofile.health.HealthCheck;
import org.eclipse.microprofile.health.HealthCheckResponse;
import org.jboss.logging.Logger;

@ApplicationScoped
@LookupIfProperty(name = "miot.component.integrations.enabled", stringValue = "true")
public class IntegrationsComponent implements IMiotComponent {

    private static final Logger LOG = Logger.getLogger(IntegrationsComponent.class);

    @Override
    public String name() {
        return "integrations";
    }

    @Override
    public int priority() {
        return 150;
    }

    @Override
    public void onStart() {
        LOG.info("Integrations component started");
    }

    @Override
    public void onStop() {
        LOG.info("Integrations component stopped");
    }

    @Override
    public HealthCheck healthCheck() {
        return () -> HealthCheckResponse.named("integrations").up().build();
    }
}
