package com.microboxlabs.miot.symptoms.engine;

import com.microboxlabs.miot.core.gps.GpsDatabase;
import io.quarkus.arc.properties.IfBuildProperty;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.inject.Produces;
import java.util.List;
import java.util.Optional;
import org.eclipse.microprofile.config.inject.ConfigProperty;
import org.jboss.logging.Logger;

/**
 * Picks the {@link SymptomEngine} from {@code miot.symptoms.engine.kind}:
 * {@code gps} reads the GPS database ({@link GpsDatabase}) in read-only transactions, {@code demo} serves
 * fixed data, anything else is unavailable.
 */
@ApplicationScoped
@IfBuildProperty(name = "miot.component.symptoms.enabled", stringValue = "true")
public class SymptomEngineProducer {

    private static final Logger LOG = Logger.getLogger(SymptomEngineProducer.class);

    private final GpsDatabase gps;
    private final String kind;
    private final Optional<List<String>> clients;

    SymptomEngineProducer(GpsDatabase gps,
            @ConfigProperty(name = "miot.symptoms.engine.kind", defaultValue = "none") String kind,
            @ConfigProperty(name = "miot.symptoms.engine.clients") Optional<List<String>> clients) {
        this.gps = gps;
        this.kind = kind;
        this.clients = clients;
    }

    @Produces
    @ApplicationScoped
    SymptomEngine engine() {
        if ("demo".equals(kind)) {
            LOG.info("Symptom engine: demo data");
            return new DemoSymptomEngine();
        }
        if ("gps".equals(kind) && gps.configured()) {
            LOG.info("Symptom engine: GPS database, read only");
            return new GpsSymptomEngine(gps::pool, EngineTenants.parse(clients));
        }
        LOG.infof("Symptom engine: none (miot.symptoms.engine.kind=%s)", kind);
        return new UnavailableSymptomEngine();
    }
}
