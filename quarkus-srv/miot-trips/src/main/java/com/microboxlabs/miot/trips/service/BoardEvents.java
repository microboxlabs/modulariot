package com.microboxlabs.miot.trips.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.microboxlabs.miot.trips.store.BoardChannel;
import io.quarkus.arc.properties.IfBuildProperty;
import io.quarkus.runtime.ShutdownEvent;
import io.quarkus.runtime.StartupEvent;
import io.smallrye.mutiny.Multi;
import io.smallrye.mutiny.operators.multi.processors.BroadcastProcessor;
import io.vertx.mutiny.core.Vertx;
import io.vertx.mutiny.pgclient.PgConnection;
import io.vertx.mutiny.sqlclient.Pool;
import io.vertx.mutiny.sqlclient.SqlConnection;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.event.Observes;
import jakarta.enterprise.inject.Instance;
import jakarta.inject.Inject;
import java.time.Duration;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.function.Supplier;
import org.eclipse.microprofile.config.inject.ConfigProperty;
import org.jboss.logging.Logger;

/**
 * Trip changes for the board's live updates. One connection per pod listens on {@link BoardChannel}; each notice goes
 * to the browsers of its tenant. A browser that is not connected misses nothing it cannot read again: the board is
 * read from the API, the stream only says which trip to read.
 */
@ApplicationScoped
@IfBuildProperty(name = "miot.component.trips.enabled", stringValue = "true")
public class BoardEvents {

    /** {@code trip}: the trip changed. {@code ping}: keeps proxies from closing an idle stream. */
    public record Change(String type, String tripId) {
    }

    private static final Logger LOG = Logger.getLogger(BoardEvents.class);
    private static final ObjectMapper JSON = new ObjectMapper();
    private static final long RETRY_MS = 5_000;
    private static final Duration PING = Duration.ofSeconds(25);

    private final Supplier<Pool> pool;
    private final Vertx vertx;
    private final boolean enabled;
    private final Map<String, BroadcastProcessor<Change>> tenants = new ConcurrentHashMap<>();
    private volatile SqlConnection listening;
    private volatile boolean stopped;

    @Inject
    BoardEvents(Instance<Pool> pool, Vertx vertx,
            @ConfigProperty(name = "miot.trips.board-events.enabled", defaultValue = "true") boolean enabled) {
        this(pool::get, vertx, enabled);
    }

    public BoardEvents(Supplier<Pool> pool, Vertx vertx, boolean enabled) {
        this.pool = pool;
        this.vertx = vertx;
        this.enabled = enabled;
    }

    void start(@Observes StartupEvent event) {
        start();
    }

    void stop(@Observes ShutdownEvent event) {
        stop();
    }

    public void start() {
        if (enabled) {
            listen();
        }
    }

    public void stop() {
        stopped = true;
        SqlConnection connection = listening;
        if (connection != null) {
            connection.closeAndForget();
        }
    }

    /** The tenant's trip changes, with a ping every 25 seconds. */
    public Multi<Change> stream(String tenantCode) {
        Multi<Change> changes = tenants.computeIfAbsent(tenantCode, t -> BroadcastProcessor.create());
        Multi<Change> pings = Multi.createFrom().ticks().every(PING).map(tick -> new Change("ping", null));
        return Multi.createBy().merging().streams(changes, pings);
    }

    void dispatch(String payload) {
        try {
            JsonNode notice = JSON.readTree(payload);
            BroadcastProcessor<Change> tenant = tenants.get(notice.path("tenant").asText());
            if (tenant != null) {
                tenant.onNext(new Change("trip", notice.path("tripId").asText()));
            }
        } catch (Exception e) {
            LOG.debugf("Board notice ignored: %s", e.getMessage());
        }
    }

    private void listen() {
        pool.get().getConnection().subscribe().with(connection -> {
            listening = connection;
            PgConnection pg = PgConnection.cast(connection);
            pg.notificationHandler(notice -> dispatch(notice.getPayload()));
            pg.closeHandler(this::retry);
            pg.query("LISTEN " + BoardChannel.CHANNEL).execute().subscribe().with(
                    rows -> LOG.debug("Listening for trip board changes"),
                    failure -> {
                        LOG.warnf("Trip board LISTEN failed: %s", failure.getMessage());
                        connection.closeAndForget();
                    });
        }, failure -> {
            LOG.warnf("Trip board listener has no connection: %s", failure.getMessage());
            retry();
        });
    }

    private void retry() {
        listening = null;
        if (!stopped) {
            vertx.setTimer(RETRY_MS, id -> listen());
        }
    }
}
