package com.microboxlabs.miot.symptoms.signal;

import cl.streamhub.gps.model.EnvelopedMessage;
import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.SerializationFeature;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import com.microboxlabs.miot.core.gps.GpsDatabase;
import com.microboxlabs.miot.symptoms.signal.ReferenceCache.Share;
import com.microboxlabs.miot.symptoms.signal.ReferenceCache.Trip;
import io.micrometer.core.instrument.Counter;
import io.micrometer.core.instrument.MeterRegistry;
import io.quarkus.arc.properties.IfBuildProperty;
import io.quarkus.runtime.StartupEvent;
import io.quarkus.scheduler.Scheduled;
import io.smallrye.mutiny.Multi;
import io.smallrye.mutiny.Uni;
import io.smallrye.reactive.messaging.pulsar.PulsarOutgoingMessageMetadata;
import io.vertx.core.json.JsonObject;
import io.vertx.mutiny.sqlclient.Row;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.event.Observes;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.OffsetDateTime;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.CompletableFuture;
import org.eclipse.microprofile.config.inject.ConfigProperty;
import org.eclipse.microprofile.reactive.messaging.Incoming;
import org.eclipse.microprofile.reactive.messaging.Message;
import org.eclipse.microprofile.reactive.messaging.Outgoing;
import org.jboss.logging.Logger;

/**
 * The signal builder: reads GPS frames ({@code gps-frames}), joins the trip and
 * the vehicle's clients, and publishes {@code miot.gps.signal@1} keyed by
 * vehicle id ({@code gps-signals}). The reference rows are loaded from the GPS
 * database at start and every {@code reload-every}, and kept current between
 * loads from their Debezium topics ({@code signal-live-trip},
 * {@code signal-asset-client-map}). Off unless
 * {@code miot.symptoms.signal-builder.enabled}; the channels are disabled with
 * it. Frames are never logged, only counted.
 */
@ApplicationScoped
@IfBuildProperty(name = "miot.component.symptoms.enabled", stringValue = "true")
public class SignalStream {

    private static final Logger LOG = Logger.getLogger(SignalStream.class);

    /** Absent values are left out, so {@code has()} in a rule is true only for a value the device sent. */
    static final ObjectMapper JSON = new ObjectMapper().registerModule(new JavaTimeModule())
            .disable(SerializationFeature.WRITE_DATES_AS_TIMESTAMPS)
            .setSerializationInclusion(JsonInclude.Include.NON_NULL);

    private static final String TRIPS = """
            SELECT trip_id, asset_id, trip_type, status, start_time, end_time, double_driver FROM live_trip
            """;
    private static final String SHARES = """
            SELECT asset_id, shared_client_id, active, valid_from, valid_to FROM asset_client_map WHERE active
            """;

    private final boolean enabled;
    private final GpsDatabase gps;
    private final ReferenceCache refs = new ReferenceCache();
    private final SignalBuilder builder;
    private final Counter built;
    private final Counter skipped;
    private final CompletableFuture<Void> ready = new CompletableFuture<>();

    SignalStream(@ConfigProperty(name = "miot.symptoms.signal-builder.enabled", defaultValue = "false") boolean enabled,
            @ConfigProperty(name = "miot.symptoms.signal-builder.zone", defaultValue = "America/Santiago") String zone,
            GpsDatabase gps, MeterRegistry meters) {
        this.enabled = enabled;
        this.gps = gps;
        this.builder = new SignalBuilder(refs, ZoneId.of(zone));
        this.built = meters.counter("miot.symptoms.signal.built");
        this.skipped = meters.counter("miot.symptoms.signal.skipped");
    }

    /**
     * Frames wait for the first reference load, so a vehicle's first frames are not published without its trip
     * and shared clients. The first load is retried until the GPS database answers.
     */
    void onStart(@Observes StartupEvent ignored) {
        if (!enabled) {
            return;
        }
        if (!gps.configured()) {
            LOG.warn("Signal builder: the GPS database is not configured; signals have no trip and no shared clients");
            ready.complete(null);
            return;
        }
        reload().onFailure().invoke(e -> LOG.errorf(e, "Signal builder: reference load failed; frames wait"))
                .onFailure().retry().withBackOff(Duration.ofSeconds(1), Duration.ofMinutes(1)).indefinitely()
                .subscribe().with(x -> ready.complete(null));
    }

    @Scheduled(every = "${miot.symptoms.signal-builder.reload-every:10m}", delayed = "10m",
            concurrentExecution = Scheduled.ConcurrentExecution.SKIP)
    Uni<Void> scheduledReload() {
        if (!enabled || !gps.configured() || !ready.isDone()) {
            return Uni.createFrom().voidItem();
        }
        return reload().onFailure().invoke(e -> LOG.errorf(e, "Signal builder: reference load failed"))
                .onFailure().recoverWithNull();
    }

    private Uni<Void> reload() {
        return Uni.createFrom().deferred(() -> {
            refs.beginReload();
            return gps.readPool().query(TRIPS).execute();
        }).chain(trips -> gps.readPool().query(SHARES).execute().map(shares -> {
            List<Trip> t = new ArrayList<>();
            trips.forEach(r -> t.add(new Trip(r.getString("trip_id"), r.getString("asset_id"),
                    r.getString("trip_type"), r.getString("status"), instant(r, "start_time"),
                    instant(r, "end_time"), Boolean.TRUE.equals(r.getBoolean("double_driver")))));
            List<Share> s = new ArrayList<>();
            shares.forEach(r -> s.add(new Share(r.getString("asset_id"), r.getString("shared_client_id"),
                    Boolean.TRUE.equals(r.getBoolean("active")), instant(r, "valid_from"),
                    instant(r, "valid_to"))));
            refs.load(t, s);
            LOG.infof("Signal builder: loaded %d trips, %d shares", t.size(), s.size());
            return t.size();
        })).replaceWithVoid();
    }

    @Incoming("gps-frames")
    @Outgoing("gps-signals")
    public Multi<Message<String>> build(Message<byte[]> in) {
        if (ready.isDone()) {
            return buildNow(in);
        }
        return Uni.createFrom().completionStage(ready::copy).onItem().transformToMulti(x -> buildNow(in));
    }

    private Multi<Message<String>> buildNow(Message<byte[]> in) {
        GpsSignal signal;
        try {
            signal = builder.build(EnvelopedMessage.fromJson(new String(in.getPayload(), StandardCharsets.UTF_8)))
                    .orElse(null);
        } catch (RuntimeException e) {
            LOG.debugf("Signal builder: frame not read (%s)", rootCause(e));
            signal = null;
        }
        if (signal == null) {
            skipped.increment();
            return Uni.createFrom().completionStage(in::ack).onItem().transformToMulti(x -> Multi.createFrom().empty());
        }
        String json;
        try {
            json = JSON.writeValueAsString(signal);
        } catch (Exception e) {
            LOG.debugf("Signal builder: signal not written (%s)", rootCause(e));
            skipped.increment();
            return Uni.createFrom().completionStage(in::ack).onItem().transformToMulti(x -> Multi.createFrom().empty());
        }
        built.increment();
        return Multi.createFrom().item(in.withPayload(json)
                .addMetadata(PulsarOutgoingMessageMetadata.builder().withKey(signal.assetId()).build()));
    }

    @Incoming("signal-live-trip")
    public Uni<Void> onTrip(Message<byte[]> in) {
        apply(in, true);
        return Uni.createFrom().completionStage(in::ack);
    }

    @Incoming("signal-asset-client-map")
    public Uni<Void> onShare(Message<byte[]> in) {
        apply(in, false);
        return Uni.createFrom().completionStage(in::ack);
    }

    private void apply(Message<byte[]> in, boolean trip) {
        if (in.getPayload() == null || in.getPayload().length == 0) {
            return; // Debezium's tombstone after a delete
        }
        try {
            JsonObject change = new JsonObject(new String(in.getPayload(), StandardCharsets.UTF_8));
            if (trip) {
                refs.applyTrip(change);
            } else {
                refs.applyShare(change);
            }
        } catch (RuntimeException e) {
            LOG.warnf("Signal builder: change event skipped (%s)", e.getClass().getSimpleName());
        }
    }

    /** The innermost exception's type and the first frame in our code: never the frame's content. */
    static String rootCause(Throwable e) {
        Throwable root = e;
        while (root.getCause() != null && root.getCause() != root) {
            root = root.getCause();
        }
        StackTraceElement at = java.util.Arrays.stream(root.getStackTrace())
                .filter(f -> f.getClassName().startsWith("com.microboxlabs") || f.getClassName().startsWith("cl.streamhub"))
                .findFirst().orElse(null);
        return root.getClass().getSimpleName() + (at == null ? "" : " at " + at.getClassName() + ":" + at.getLineNumber());
    }

    private static java.time.Instant instant(Row r, String column) {
        OffsetDateTime t = r.getOffsetDateTime(column);
        return t == null ? null : t.toInstant();
    }
}
