package com.microboxlabs.miot.conversational;

import com.microboxlabs.miot.core.config.IMiotComponent;
import io.quarkus.arc.lookup.LookupIfProperty;
import jakarta.enterprise.context.ApplicationScoped;
import org.eclipse.microprofile.health.HealthCheck;
import org.eclipse.microprofile.health.HealthCheckResponse;
import org.jboss.logging.Logger;

@ApplicationScoped
@LookupIfProperty(name = "miot.component.conversational.enabled", stringValue = "true")
public class ConversationalComponent implements IMiotComponent {

    private static final Logger LOG = Logger.getLogger(ConversationalComponent.class);

    @Override
    public String name() {
        return "conversational";
    }

    @Override
    public int priority() {
        return 160;
    }

    @Override
    public void onStart() {
        LOG.info("Conversational component started");
    }

    @Override
    public void onStop() {
        LOG.info("Conversational component stopped");
    }

    @Override
    public HealthCheck healthCheck() {
        return () -> HealthCheckResponse.named("conversational").up().build();
    }
}
