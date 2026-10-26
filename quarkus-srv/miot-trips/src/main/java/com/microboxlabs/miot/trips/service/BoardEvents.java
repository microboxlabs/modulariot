package com.microboxlabs.miot.trips.service;

import com.microboxlabs.miot.core.db.PgNotificationListener;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.microboxlabs.miot.trips.store.BoardChannel;
import io.quarkus.arc.properties.IfBuildProperty;
import io.quarkus.runtime.ShutdownEvent;
import io.quarkus.runtime.StartupEvent;
import io.smallrye.mutiny.Multi;
import io.smallrye.mutiny.operators.multi.processors.BroadcastProcessor;
import io.vertx.mutiny.core.Vertx;
import io.vertx.mutiny.sqlclient.Pool;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.event.Observes;
import jakarta.enterprise.inject.Instance;
import jakarta.inject.Inject;
import jakarta.ws.rs.ServiceUnavailableException;
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
    private static final Duration PING = Duration.ofSeconds(25);

    private final boolean enabled;
    private final Map<String, BroadcastProcessor<Change>> tenants = new ConcurrentHashMap<>();
    private final PgNotificationListener listener;

    @Inject
    BoardEvents(Instance<Pool> pool, Vertx vertx,
            @ConfigProperty(name = "miot.trips.board-events.enabled", defaultValue = "true") boolean enabled) {
        this(pool::get, vertx, enabled);
    }

    public BoardEvents(Supplier<Pool> pool, Vertx vertx, boolean enabled) {
        this.listener = new PgNotificationListener(pool, vertx, BoardChannel.CHANNEL, this::dispatch);
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
            listener.start();
        }
    }

    public void stop() {
        listener.close();
    }

    /** The tenant's trip changes, with a ping every 25 seconds. */
    public Multi<Change> stream(String tenantCode) {
        if (!enabled) {
            throw new ServiceUnavailableException("Trip board live events are disabled");
        }
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

}
