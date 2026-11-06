package com.microboxlabs.miot.symptoms.signal;

import com.fasterxml.jackson.core.JsonProcessingException;
import io.quarkus.arc.properties.IfBuildProperty;
import io.quarkus.scheduler.Scheduled;
import io.smallrye.mutiny.Uni;
import io.vertx.mutiny.sqlclient.Pool;
import io.vertx.mutiny.sqlclient.Tuple;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.inject.Instance;
import jakarta.inject.Inject;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.HexFormat;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.function.Supplier;
import org.eclipse.microprofile.config.inject.ConfigProperty;
import org.eclipse.microprofile.openapi.annotations.media.Schema;
import org.jboss.logging.Logger;

/**
 * Device events that do not travel in the GPS frames (driver app, fatigue cameras and sensors, load apps), sent to
 * the control tower's device-events endpoint. Each new event becomes a signal of its own ({@value
 * GpsSignal#EVENTS_SCHEMA_ID}) for the organization that sent it: the event as {@code frame.events[0]} and the
 * organization's trip in progress on the vehicle. It is published on the GPS signals topic, keyed by vehicle, so the
 * evaluator reads it in order with the vehicle's frames. An event id already received is not published again
 * ({@code miot_symptoms.device_event}, without payload). Payloads are never logged. Off unless {@code
 * miot.symptoms.device-events.enabled}.
 */
@ApplicationScoped
@IfBuildProperty(name = "miot.component.symptoms.enabled", stringValue = "true")
public class DeviceEvents {

    private static final Logger LOG = Logger.getLogger(DeviceEvents.class);
    public static final int MAX_EVENTS = 100;
    static final int MAX_ID = 128;
    static final int MAX_ASSET = 64;
    static final int MAX_CODE = 64;
    static final int MAX_DESCRIPTION = 500;
    /** An event this far ahead of the server clock is refused. */
    static final Duration MAX_AHEAD = Duration.ofMinutes(5);
    static final Duration KEEP = Duration.ofDays(30);
    private static final Duration TIMEOUT = Duration.ofSeconds(10);
    private static final Set<String> SEVERITIES = Set.of("low", "medium", "high");

    private static final String CLAIM = """
            INSERT INTO miot_symptoms.device_event (tenant_code, event_id, asset_id, event_type, occurred_at)
            VALUES ($1, $2, $3, $4, $5) ON CONFLICT DO NOTHING RETURNING event_id
            """;
    private static final String RELEASE = """
            DELETE FROM miot_symptoms.device_event WHERE tenant_code = $1 AND event_id = $2
            """;
    private static final String PRUNE = "DELETE FROM miot_symptoms.device_event WHERE received_at < $1";
    private static final String ASSET_TRIPS = SignalStream.TRIPS.formatted("AND tl.tenant_code = $1 AND tl.asset_id = $2");

    /** One event as the producer sends it. */
    @Schema(name = "DeviceEvent")
    public record DeviceEvent(
            @Schema(description = "The producer's id for the event; repeats with the same id are ignored. Without "
                    + "one, the id is derived from the vehicle, type, time and code") String eventId,
            @Schema(description = "Vehicle id (plate), as in the GPS frames", required = true) String assetId,
            @Schema(description = "Event type, as the symptom rules read it (e.g. Emergencia, FYS)", required = true)
            String type,
            @Schema(description = "When it happened, ISO 8601 with offset", required = true) OffsetDateTime occurredAt,
            @Schema(description = "The producer's code for the event (e.g. 109)") String code,
            @Schema(description = "low, medium or high") String severity,
            @Schema(description = "Free text, at most 500 characters") String description) {
    }

    public record Request(List<DeviceEvent> events) {
    }

    /** How many events were new and published, and how many had been received before. */
    public record Accepted(int accepted, int duplicates) {
    }

    /** Events are off here, or the signals topic did not take the event. */
    public static class UnavailableException extends RuntimeException {
        public UnavailableException(String message) {
            super(message);
        }
    }

    /** Keeps the ids received. */
    interface Seen {
        /** True when the id is new: it is now kept. */
        boolean claim(String tenant, String eventId, DeviceEvent event);

        void release(String tenant, String eventId);
    }

    /** The organization's {@code trip_live} rows of the vehicle. */
    interface Trips {
        List<ReferenceCache.Trip> of(String tenant, String assetId);
    }

    private final boolean enabled;
    private final Seen seen;
    private final Trips trips;
    private final DeviceSignalChannel channel;
    private final Clock clock;
    private final Supplier<Pool> pool;
    private final SignalBuilder builder = new SignalBuilder(new ReferenceCache(), java.time.ZoneOffset.UTC);

    @Inject
    DeviceEvents(@ConfigProperty(name = "miot.symptoms.device-events.enabled", defaultValue = "false") boolean enabled,
            Instance<Pool> pool, DeviceSignalChannel channel) {
        this(enabled, new PgSeen(pool::get), new PgTrips(pool::get), channel, Clock.systemUTC(), pool::get);
    }

    DeviceEvents(boolean enabled, Seen seen, Trips trips, DeviceSignalChannel channel, Clock clock,
            Supplier<Pool> pool) {
        this.enabled = enabled;
        this.seen = seen;
        this.trips = trips;
        this.channel = channel;
        this.clock = clock;
        this.pool = pool;
    }

    /**
     * Checks every event first, then publishes the new ones in order. An event whose publication fails is
     * forgotten, so the producer can send it again.
     */
    public Accepted accept(String tenant, Request request) {
        if (!enabled) {
            throw new UnavailableException("device events are not enabled");
        }
        List<DeviceEvent> events = request == null || request.events() == null ? List.of() : request.events();
        if (events.isEmpty() || events.size() > MAX_EVENTS) {
            throw new IllegalArgumentException("events must have 1 to " + MAX_EVENTS + " elements");
        }
        Instant now = clock.instant();
        List<DeviceEvent> checked = new ArrayList<>();
        for (int i = 0; i < events.size(); i++) {
            checked.add(check(events.get(i), i, now));
        }
        int accepted = 0;
        Set<String> inRequest = new HashSet<>();
        for (DeviceEvent e : checked) {
            String id = eventId(e);
            if (!inRequest.add(id) || !seen.claim(tenant, id, e)) {
                continue;
            }
            try {
                channel.publish(e.assetId(), signal(tenant, id, e, now));
            } catch (RuntimeException failure) {
                seen.release(tenant, id);
                throw failure instanceof UnavailableException u ? u
                        : new UnavailableException("the event was not published");
            }
            accepted++;
        }
        return new Accepted(accepted, checked.size() - accepted);
    }

    private static DeviceEvent check(DeviceEvent e, int i, Instant now) {
        String at = "events[" + i + "].";
        if (e == null) {
            throw new IllegalArgumentException("events[" + i + "] is required");
        }
        String asset = required(e.assetId(), at + "assetId", MAX_ASSET);
        String type = required(e.type(), at + "type", EventTypes.MAX_LENGTH);
        if (e.occurredAt() == null) {
            throw new IllegalArgumentException(at + "occurredAt is required");
        }
        if (e.occurredAt().toInstant().isAfter(now.plus(MAX_AHEAD))) {
            throw new IllegalArgumentException(at + "occurredAt is in the future");
        }
        String severity = optional(e.severity(), at + "severity", MAX_CODE);
        if (severity != null && !SEVERITIES.contains(severity)) {
            throw new IllegalArgumentException(at + "severity must be low, medium or high");
        }
        return new DeviceEvent(optional(e.eventId(), at + "eventId", MAX_ID), asset, type, e.occurredAt(),
                optional(e.code(), at + "code", MAX_CODE), severity,
                optional(e.description(), at + "description", MAX_DESCRIPTION));
    }

    private static String required(String value, String field, int max) {
        String v = optional(value, field, max);
        if (v == null) {
            throw new IllegalArgumentException(field + " is required");
        }
        return v;
    }

    private static String optional(String value, String field, int max) {
        if (value == null || value.isBlank()) {
            return null;
        }
        String v = value.strip();
        if (v.length() > max) {
            throw new IllegalArgumentException(field + " is longer than " + max + " characters");
        }
        return v;
    }

    /** The producer's id, else one derived from what identifies the event. */
    static String eventId(DeviceEvent e) {
        if (e.eventId() != null) {
            return e.eventId();
        }
        String key = String.join("\n", e.assetId(), e.type(), e.occurredAt().toInstant().toString(),
                e.code() == null ? "" : e.code());
        try {
            byte[] hash = MessageDigest.getInstance("SHA-256").digest(key.getBytes(StandardCharsets.UTF_8));
            return "derived:" + HexFormat.of().formatHex(hash, 0, 16);
        } catch (NoSuchAlgorithmException ex) {
            throw new IllegalStateException(ex);
        }
    }

    /** The event's signal, as JSON: only the sending organization, with its trip when one is in progress. */
    String signal(String tenant, String id, DeviceEvent e, Instant receivedAt) {
        Instant at = e.occurredAt().toInstant();
        ReferenceCache refs = new ReferenceCache();
        refs.load(trips.of(tenant, e.assetId()), List.of());
        Map<String, Object> event = new LinkedHashMap<>();
        event.put("event_type", e.type());
        event.put("timestamp", at.toString());
        putIfPresent(event, "severity", e.severity());
        putIfPresent(event, "code", e.code());
        putIfPresent(event, "description", e.description());
        Map<String, Object> frame = new LinkedHashMap<>();
        frame.put("asset_id", e.assetId());
        frame.put("timestamp", at.toString());
        frame.put("events", List.of(event));
        Map<String, Object> signal = new LinkedHashMap<>();
        signal.put("schema", GpsSignal.EVENTS_SCHEMA_ID);
        signal.put("asset_id", e.assetId());
        signal.put("at", at.toString());
        signal.put("received_at", receivedAt.toString());
        signal.put("event_id", id);
        signal.put("clients", List.of(tenant));
        ReferenceCache.Trip trip = refs.tripsAt(e.assetId(), at, List.of(tenant)).get(tenant);
        if (trip != null) {
            signal.put("trips", Map.of(tenant, builder.trip(trip, at)));
        }
        signal.put("derived", Map.of("power_disconnected", false, "jamming", false));
        signal.put("frame", frame);
        try {
            return SignalStream.JSON.writeValueAsString(signal);
        } catch (JsonProcessingException ex) {
            throw new IllegalStateException("signal not written", ex);
        }
    }

    private static void putIfPresent(Map<String, Object> m, String key, String value) {
        if (value != null) {
            m.put(key, value);
        }
    }

    @Scheduled(every = "6h", delayed = "10m", concurrentExecution = Scheduled.ConcurrentExecution.SKIP)
    Uni<Void> prune() {
        if (!enabled) {
            return Uni.createFrom().voidItem();
        }
        return pool.get().preparedQuery(PRUNE).execute(Tuple.of(OffsetDateTime.now(clock).minus(KEEP)))
                .invoke(r -> LOG.debugf("Device events: %d ids pruned", r.rowCount()))
                .onFailure().invoke(f -> LOG.warnf("Device events: prune failed (%s)", f.getClass().getSimpleName()))
                .onFailure().recoverWithNull().replaceWithVoid();
    }

    static final class PgSeen implements Seen {
        private final Supplier<Pool> pool;

        PgSeen(Supplier<Pool> pool) {
            this.pool = pool;
        }

        @Override
        public boolean claim(String tenant, String eventId, DeviceEvent e) {
            return pool.get().preparedQuery(CLAIM)
                    .execute(Tuple.of(tenant, eventId, e.assetId(), e.type(), e.occurredAt()))
                    .await().atMost(TIMEOUT).rowCount() == 1;
        }

        @Override
        public void release(String tenant, String eventId) {
            try {
                pool.get().preparedQuery(RELEASE).execute(Tuple.of(tenant, eventId)).await().atMost(TIMEOUT);
            } catch (RuntimeException e) {
                LOG.warnf("Device events: id not released (%s)", e.getClass().getSimpleName());
            }
        }
    }

    /** No trips when the modulith has no trips module. */
    static final class PgTrips implements Trips {
        private final Supplier<Pool> pool;

        PgTrips(Supplier<Pool> pool) {
            this.pool = pool;
        }

        @Override
        public List<ReferenceCache.Trip> of(String tenant, String assetId) {
            return pool.get().preparedQuery(ASSET_TRIPS).execute(Tuple.of(tenant, assetId))
                    .map(SignalStream::trips)
                    .onFailure(SignalStream::undefinedTable).recoverWithItem(List.of())
                    .await().atMost(TIMEOUT);
        }
    }
}
