package com.microboxlabs.miot.gateway;

import com.microboxlabs.miot.core.config.IMiotComponent;
import io.quarkus.arc.lookup.LookupIfProperty;
import jakarta.enterprise.context.ApplicationScoped;
import org.eclipse.microprofile.health.HealthCheck;
import org.eclipse.microprofile.health.HealthCheckResponse;
import org.jboss.logging.Logger;

@ApplicationScoped
@LookupIfProperty(name = "miot.component.gateway.enabled", stringValue = "true")
public class GatewayComponent implements IMiotComponent {

    private static final Logger LOG = Logger.getLogger(GatewayComponent.class);

    @Override
    public String name() {
        return "gateway";
    }

    @Override
    public int priority() {
        return 300;
    }

    @Override
    public void onStart() {
        LOG.info("Gateway component started — routing rules active");
    }

    @Override
    public void onStop() {
        LOG.info("Gateway component stopped");
    }

    @Override
    public HealthCheck healthCheck() {
        return () -> HealthCheckResponse.named("gateway").up().build();
    }
}
