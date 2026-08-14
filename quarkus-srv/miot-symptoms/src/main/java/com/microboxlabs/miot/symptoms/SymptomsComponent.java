package com.microboxlabs.miot.symptoms;

import com.microboxlabs.miot.core.config.IMiotComponent;
import com.microboxlabs.miot.symptoms.process.StreamhubSymptomsGpsClient;
import com.microboxlabs.miot.symptoms.route.RouteTable;
import com.microboxlabs.miot.symptoms.route.RouteTableHolder;
import com.microboxlabs.miot.symptoms.route.RouteTableSource;
import io.quarkus.arc.lookup.LookupIfProperty;
import jakarta.enterprise.context.ApplicationScoped;
import org.eclipse.microprofile.config.inject.ConfigProperty;
import org.eclipse.microprofile.health.HealthCheck;
import org.eclipse.microprofile.health.HealthCheckResponse;
import org.jboss.logging.Logger;

/**
 * In-process symptoms dispatcher. Off unless
 * {@code miot.component.symptoms.enabled=true}. The Pulsar subscription is
 * the {@code symptoms-cdc} SmallRye channel (Latest / Shared); unowned
 * {@code rule_id}s are skipped so old Helm pods can keep those rules.
 *
 * <p>Readiness stays UP even if GPS is down so a shared modulith pod is
 * not taken out of service.
 */
@ApplicationScoped
@LookupIfProperty(name = "miot.component.symptoms.enabled", stringValue = "true")
public class SymptomsComponent implements IMiotComponent {

    private static final Logger LOG = Logger.getLogger(SymptomsComponent.class);

    private final RouteTableSource source;
    private final RouteTableHolder holder;
    private final StreamhubSymptomsGpsClient gpsClient;
    private final String initialPosition;

    SymptomsComponent(
            RouteTableSource source,
            RouteTableHolder holder,
            StreamhubSymptomsGpsClient gpsClient,
            @ConfigProperty(
                            name = "miot.symptoms.pulsar.subscription-initial-position",
                            defaultValue = "Latest")
                    String initialPosition) {
        this.source = source;
        this.holder = holder;
        this.gpsClient = gpsClient;
        this.initialPosition = initialPosition;
    }

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
        if (!"Latest".equalsIgnoreCase(initialPosition)) {
            throw new IllegalStateException(
                    "miot.symptoms.pulsar.subscription-initial-position must be Latest, was "
                            + initialPosition);
        }
        RouteTable table = source.load();
        holder.replace(table);
        if (table.anyPostgres() && !gpsClient.isConfigured()) {
            LOG.warn(
                    "Symptoms routes call Postgres but GPS datasource is not configured "
                            + "(miot.symptoms.gps.reactive-url / username)");
        }
        LOG.infof(
                "Symptoms component started — %d route(s), channel symptoms-cdc",
                table.routes().size());
    }

    @Override
    public void onStop() {
        LOG.info("Symptoms component stopped");
    }

    @Override
    public HealthCheck healthCheck() {
        return () -> HealthCheckResponse.named("symptoms")
                .up()
                .withData("routes", holder.get().routes().size())
                .withData("gps", gpsClient.isConfigured() ? "CONFIGURED" : "UNCONFIGURED")
                .withData("channel", "symptoms-cdc")
                .build();
    }
}
