package com.microboxlabs.miot.integrations;

import com.microboxlabs.miot.core.config.IMiotComponent;
import com.microboxlabs.miot.integrations.retransmit.EnrichedPositionRetransmitConsumer;
import com.microboxlabs.miot.integrations.retransmit.StreamhubGpsClient;
import io.quarkus.arc.lookup.LookupIfProperty;
import jakarta.enterprise.context.ApplicationScoped;
import org.eclipse.microprofile.health.HealthCheck;
import org.eclipse.microprofile.health.HealthCheckResponse;
import org.jboss.logging.Logger;

@ApplicationScoped
@LookupIfProperty(name = "miot.component.integrations.enabled", stringValue = "true")
public class IntegrationsComponent implements IMiotComponent {

    private static final Logger LOG = Logger.getLogger(IntegrationsComponent.class);

    private final EnrichedPositionRetransmitConsumer retransmitConsumer;
    private final StreamhubGpsClient gpsClient;

    IntegrationsComponent(
            EnrichedPositionRetransmitConsumer retransmitConsumer,
            StreamhubGpsClient gpsClient) {
        this.retransmitConsumer = retransmitConsumer;
        this.gpsClient = gpsClient;
    }

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
        if (retransmitConsumer.isEnabled()) {
            if (!gpsClient.isConfigured()) {
                LOG.warn(
                        "Retransmit worker enabled but GPS datasource is not configured "
                                + "(miot.integrations.retransmit.gps.reactive-url / username)");
            }
            retransmitConsumer.start();
        }
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
