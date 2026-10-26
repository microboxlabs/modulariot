package com.microboxlabs.miot.integrations.events;

import io.quarkus.arc.properties.IfBuildProperty;
import io.quarkus.runtime.ShutdownEvent;
import io.quarkus.runtime.StartupEvent;
import io.smallrye.mutiny.Multi;
import io.smallrye.mutiny.operators.multi.processors.BroadcastProcessor;
import io.vertx.core.json.JsonObject;
import io.vertx.mutiny.core.Vertx;
import io.vertx.mutiny.pgclient.PgConnection;
import io.vertx.mutiny.sqlclient.Pool;
import io.vertx.mutiny.sqlclient.SqlConnection;
import io.vertx.mutiny.sqlclient.Tuple;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.event.Observes;
import jakarta.enterprise.inject.Instance;
import jakarta.inject.Inject;
import jakarta.ws.rs.ServiceUnavailableException;
import java.time.Duration;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicReference;
import java.util.function.Supplier;
import org.eclipse.microprofile.config.inject.ConfigProperty;
import org.jboss.logging.Logger;

/**
 * Job transitions for the console's live updates, across pods. A frame is published with {@code pg_notify} by the
 * pod that changed the job (often the worker); each pod listens on {@value #CHANNEL} and sends the frames to the
 * browsers of the frame's tenant. A browser that is not connected misses nothing it cannot read again: the console
 * reads the ledger, the stream only says when to read it.
 */
@ApplicationScoped
@IfBuildProperty(name = "miot.component.integrations.enabled", stringValue = "true")
public class JobEventBus {

    public static final String CHANNEL = "miot_integration_jobs";
    /** Frames over this many characters go without their error text; {@code pg_notify} takes at most 8000 bytes. */
    static final int MAX_FRAME = 7000;

    private static final Logger LOG = Logger.getLogger(JobEventBus.class);
    private static final long RETRY_MS = 5_000;
    private static final Duration PING = Duration.ofSeconds(25);
    private static final JsonObject PING_FRAME = new JsonObject().put("eventType", "ping");

    private final Supplier<Pool> pool;
    private final Vertx vertx;
    private final boolean enabled;
    private final Map<String, BroadcastProcessor<JsonObject>> tenants = new ConcurrentHashMap<>();
    private final AtomicReference<SqlConnection> listening = new AtomicReference<>();
    private volatile boolean stopped;

    @Inject
    JobEventBus(Instance<Pool> pool, Vertx vertx,
            @ConfigProperty(name = "miot.integrations.job-events.live.enabled", defaultValue = "true")
            boolean enabled) {
        this(pool::get, vertx, enabled);
    }

    public JobEventBus(Supplier<Pool> pool, Vertx vertx, boolean enabled) {
        this.pool = pool;
        this.vertx = vertx;
        this.enabled = enabled;
    }

    public boolean isEnabled() {
        return enabled;
    }

    void start(@Observes StartupEvent event) {
        if (enabled) {
            listen();
        }
    }

    void stop(@Observes ShutdownEvent event) {
        stop();
    }

    public void stop() {
        stopped = true;
        SqlConnection connection = listening.getAndSet(null);
        if (connection != null) {
            connection.closeAndForget();
        }
    }

    /** Publishes the frame to every pod. Never throws; a failure is logged at DEBUG. */
    public void publish(JsonObject frame) {
        if (!enabled || frame == null) {
            return;
        }
        try {
            pool.get().preparedQuery("SELECT pg_notify($1, $2)").execute(Tuple.of(CHANNEL, fit(frame)))
                    .subscribe().with(rows -> { }, failure ->
                            LOG.debugf("Job event notify failed: %s", failure.getMessage()));
        } catch (Exception e) {
            LOG.debugf("Job event notify failed: %s", e.getMessage());
        }
    }

    /** The tenant's job frames, with a ping frame every 25 seconds. */
    public Multi<JsonObject> stream(String tenantCode) {
        if (!enabled) {
            throw new ServiceUnavailableException("Job live events are disabled");
        }
        Multi<JsonObject> frames = tenants.computeIfAbsent(tenantCode, t -> BroadcastProcessor.create());
        Multi<JsonObject> pings = Multi.createFrom().ticks().every(PING).map(tick -> PING_FRAME);
        return Multi.createBy().merging().streams(frames, pings);
    }

    void dispatch(String text) {
        try {
            JsonObject frame = new JsonObject(text);
            BroadcastProcessor<JsonObject> tenant = tenants.get(frame.getString("tenantId"));
            if (tenant != null) {
                tenant.onNext(frame);
            }
        } catch (Exception e) {
            LOG.debugf("Job event ignored: %s", e.getMessage());
        }
    }

    /** The frame as text, without the job's error when it would not fit in a notification. */
    static String fit(JsonObject frame) {
        String text = frame.encode();
        if (text.length() <= MAX_FRAME) {
            return text;
        }
        JsonObject copy = frame.copy();
        JsonObject payload = copy.getJsonObject("payload");
        if (payload != null) {
            payload.put("lastError", null);
        }
        return copy.encode();
    }

    private void listen() {
        if (stopped) {
            return;
        }
        pool.get().getConnection().subscribe().with(connection -> {
            listening.set(connection);
            if (stopped) {
                if (listening.compareAndSet(connection, null)) {
                    connection.closeAndForget();
                }
                return;
            }
            PgConnection pg = PgConnection.cast(connection);
            pg.notificationHandler(notice -> dispatch(notice.getPayload()));
            pg.closeHandler(() -> retry(connection));
            pg.query("LISTEN " + CHANNEL).execute().subscribe().with(
                    rows -> LOG.debug("Listening for job events"),
                    failure -> {
                        LOG.warnf("Job events LISTEN failed: %s", failure.getMessage());
                        connection.closeAndForget();
                    });
        }, failure -> {
            LOG.warnf("Job events listener has no connection: %s", failure.getMessage());
            retry(null);
        });
    }

    private void retry(SqlConnection connection) {
        if (connection != null) {
            listening.compareAndSet(connection, null);
        }
        if (!stopped) {
            vertx.setTimer(RETRY_MS, id -> listen());
        }
    }
}
