package com.microboxlabs.miot.symptoms.engine;

import com.microboxlabs.miot.symptoms.process.StreamhubSymptomsGpsClient;
import io.quarkus.arc.properties.IfBuildProperty;
import io.vertx.mutiny.core.Vertx;
import io.vertx.mutiny.pgclient.PgBuilder;
import io.vertx.mutiny.sqlclient.Pool;
import io.vertx.pgclient.PgConnectOptions;
import io.vertx.sqlclient.PoolOptions;
import jakarta.annotation.PreDestroy;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.inject.Produces;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import org.eclipse.microprofile.config.inject.ConfigProperty;
import org.jboss.logging.Logger;

/**
 * Picks the {@link SymptomEngine} from {@code miot.symptoms.engine.kind}:
 * {@code gps} reads the GPS database through {@code miot.symptoms.gps.*}
 * with read-only sessions, {@code demo} serves fixed data, anything else is
 * unavailable.
 */
@ApplicationScoped
@IfBuildProperty(name = "miot.component.symptoms.enabled", stringValue = "true")
public class SymptomEngineProducer {

    private static final Logger LOG = Logger.getLogger(SymptomEngineProducer.class);

    private final Vertx vertx;
    private final String kind;
    private final Optional<String> url;
    private final Optional<String> username;
    private final Optional<String> password;
    private final Optional<List<String>> clients;
    private Pool pool;

    SymptomEngineProducer(Vertx vertx,
            @ConfigProperty(name = "miot.symptoms.engine.kind", defaultValue = "none") String kind,
            @ConfigProperty(name = "miot.symptoms.gps.reactive-url") Optional<String> url,
            @ConfigProperty(name = "miot.symptoms.gps.username") Optional<String> username,
            @ConfigProperty(name = "miot.symptoms.gps.password") Optional<String> password,
            @ConfigProperty(name = "miot.symptoms.engine.clients") Optional<List<String>> clients) {
        this.vertx = vertx;
        this.kind = kind;
        this.url = url.filter(s -> !s.isBlank());
        this.username = username;
        this.password = password;
        this.clients = clients;
    }

    @Produces
    @ApplicationScoped
    SymptomEngine engine() {
        if ("demo".equals(kind)) {
            LOG.info("Symptom engine: demo data");
            return new DemoSymptomEngine();
        }
        if ("gps".equals(kind) && url.isPresent()) {
            LOG.info("Symptom engine: GPS database, read only");
            return new GpsSymptomEngine(this::pool, EngineTenants.parse(clients));
        }
        LOG.infof("Symptom engine: none (miot.symptoms.engine.kind=%s)", kind);
        return new UnavailableSymptomEngine();
    }

    private synchronized Pool pool() {
        if (pool == null) {
            StreamhubSymptomsGpsClient.ParsedUrl parsed = StreamhubSymptomsGpsClient.parseUrl(url.orElseThrow());
            PgConnectOptions connect = new PgConnectOptions()
                    .setHost(parsed.host())
                    .setPort(parsed.port())
                    .setDatabase(parsed.database())
                    .setUser(username.orElse(""))
                    .setPassword(password.orElse(""))
                    .setProperties(Map.of(
                            "application_name", "miot-symptoms-engine",
                            "default_transaction_read_only", "on"));
            pool = PgBuilder.pool().with(new PoolOptions().setMaxSize(2)).connectingTo(connect).using(vertx).build();
        }
        return pool;
    }

    @PreDestroy
    synchronized void close() {
        if (pool != null) {
            pool.closeAndAwait();
        }
    }
}
