package com.microboxlabs.miot.symptoms;

import com.microboxlabs.miot.core.config.IMiotComponent;
import com.microboxlabs.miot.symptoms.consumer.PulsarSymptomsConsumer;
import com.microboxlabs.miot.symptoms.process.StreamhubSymptomsGpsClient;
import com.microboxlabs.miot.symptoms.route.RouteTable;
import com.microboxlabs.miot.symptoms.route.RouteTableHolder;
import com.microboxlabs.miot.symptoms.route.RouteTableSource;
import io.quarkus.arc.lookup.LookupIfProperty;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.inject.Instance;
import org.eclipse.microprofile.health.HealthCheck;
import org.eclipse.microprofile.health.HealthCheckResponse;
import org.jboss.logging.Logger;

/**
 * In-process symptoms dispatcher. Off unless
 * {@code miot.component.symptoms.enabled=true}. Consumer starts only when
 * the RouteTable has at least one route (empty table = old pods still own
 * every {@code rule_id}).
 *
 * <p>Readiness stays UP even if GPS is down so a shared modulith pod is
 * not taken out of service. Report GPS/consumer state as health data.
 */
@ApplicationScoped
@LookupIfProperty(name = "miot.component.symptoms.enabled", stringValue = "true")
public class SymptomsComponent implements IMiotComponent {

    private static final Logger LOG = Logger.getLogger(SymptomsComponent.class);

    private final RouteTableSource source;
    private final RouteTableHolder holder;
    private final StreamhubSymptomsGpsClient gpsClient;
    private final Instance<PulsarSymptomsConsumer> consumer;

    SymptomsComponent(
            RouteTableSource source,
            RouteTableHolder holder,
            StreamhubSymptomsGpsClient gpsClient,
            Instance<PulsarSymptomsConsumer> consumer) {
        this.source = source;
        this.holder = holder;
        this.gpsClient = gpsClient;
        this.consumer = consumer;
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
        RouteTable table = source.load();
        holder.replace(table);
        if (table.anyPostgres() && !gpsClient.isConfigured()) {
            LOG.warn(
                    "Symptoms routes call Postgres but GPS datasource is not configured "
                            + "(miot.symptoms.gps.reactive-url / username)");
        }
        if (!consumer.isResolvable()) {
            LOG.debug("Symptoms Pulsar consumer not available in this build");
            return;
        }
        consumer.get().start();
        LOG.infof("Symptoms component started — %d route(s)", table.routes().size());
    }

    @Override
    public void onStop() {
        LOG.info("Symptoms component stopped");
    }

    @Override
    public HealthCheck healthCheck() {
        return () -> {
            var builder = HealthCheckResponse.named("symptoms").up();
            builder.withData("routes", holder.get().routes().size());
            builder.withData("gps", gpsClient.isConfigured() ? "CONFIGURED" : "UNCONFIGURED");
            if (consumer.isResolvable()) {
                builder.withData("consumer", consumer.get().isRunning() ? "RUNNING" : "IDLE");
            } else {
                builder.withData("consumer", "UNAVAILABLE");
            }
            return builder.build();
        };
    }
}
