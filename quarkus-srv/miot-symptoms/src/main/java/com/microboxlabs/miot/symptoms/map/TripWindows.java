package com.microboxlabs.miot.symptoms.map;

import io.quarkus.arc.properties.IfBuildProperty;
import io.vertx.mutiny.sqlclient.Pool;
import io.vertx.mutiny.sqlclient.Row;
import io.vertx.mutiny.sqlclient.Tuple;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.inject.Instance;
import jakarta.inject.Inject;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.util.Optional;
import java.util.UUID;

/**
 * The time range of a trips-module trip on one of its trucks, for its map: from the departure until the trip ended, or
 * now while it runs, at most {@link #AT_MOST} after the departure. The GPS database's trips have numeric ids and are
 * read there instead.
 */
@ApplicationScoped
@IfBuildProperty(name = "miot.component.symptoms.enabled", stringValue = "true")
public class TripWindows {

    static final Duration AT_MOST = Duration.ofDays(7);

    /** The truck was assigned to the trip at some time. */
    static final String TRIP = """
            SELECT coalesce((SELECT m.confirmed_at FROM miot_trips.trip_milestone m
                              WHERE m.tenant_code = t.tenant_code AND m.trip_id = t.id
                                AND m.milestone = 'departure' AND m.status = 'confirmed'),
                            (SELECT min(s.actual_start) FROM miot_trips.stage s
                              WHERE s.tenant_code = t.tenant_code AND s.subject_type = 'trip'
                                AND s.subject_id = t.id AND s.stage_type IN ('transit', 'stop')
                                AND s.version_of IS NULL AND s.is_active)) AS actual_start,
                   t.actual_end
              FROM miot_trips.trip t
             WHERE t.tenant_code = $1 AND t.id = $2 AND t.version_of IS NULL AND t.is_active
               AND EXISTS (SELECT 1 FROM miot_trips.trip_resource_assignment a
                             JOIN miot_fleet.truck k ON k.id::text = a.resource_id::text
                                                    AND k.tenant_code = a.tenant_code AND k.version_of IS NULL
                            WHERE a.tenant_code = t.tenant_code AND a.trip_id = t.id AND a.resource_type = 'truck'
                              AND a.version_of IS NULL AND a.is_active AND k.license_plate = $3)
            """;

    /** {@code from} is null while the trip has not departed: it has no positions yet. */
    public record Window(Instant from, Instant to) {
    }

    /** The trip's departure and end, or empty when the trip is not the tenant's or the truck was never on it. */
    @FunctionalInterface
    public interface Trips {
        Optional<Instant[]> times(String tenantCode, UUID tripId, String assetId);
    }

    private final Trips trips;
    private final Clock clock;

    @Inject
    TripWindows(Instance<Pool> pool) {
        this((tenant, trip, asset) -> read(pool.get(), tenant, trip, asset), Clock.systemUTC());
    }

    public TripWindows(Trips trips, Clock clock) {
        this.trips = trips;
        this.clock = clock;
    }

    /** A trips-module trip id is a UUID; the GPS database's are numbers. */
    public static Optional<UUID> tripsModuleId(String tripId) {
        if (tripId == null) {
            return Optional.empty();
        }
        try {
            return Optional.of(UUID.fromString(tripId.trim()));
        } catch (IllegalArgumentException e) {
            return Optional.empty();
        }
    }

    public Optional<Window> find(String tenantCode, UUID tripId, String assetId) {
        if (assetId == null || assetId.isBlank()) {
            throw new IllegalArgumentException("assetId is required");
        }
        return trips.times(tenantCode, tripId, assetId.trim()).map(t -> window(t[0], t[1], clock.instant()));
    }

    static Window window(Instant departed, Instant ended, Instant now) {
        if (departed == null) {
            return new Window(null, null);
        }
        Instant end = ended != null ? ended : now;
        Instant cap = departed.plus(AT_MOST);
        Instant to = end.isAfter(cap) ? cap : end;
        return new Window(departed, to.isBefore(departed) ? departed : to);
    }

    private static Optional<Instant[]> read(Pool pool, String tenantCode, UUID tripId, String assetId) {
        var rows = pool.preparedQuery(TRIP).execute(Tuple.of(tenantCode, tripId, assetId))
                .await().atMost(Duration.ofSeconds(10)).iterator();
        if (!rows.hasNext()) {
            return Optional.empty();
        }
        Row r = rows.next();
        return Optional.of(new Instant[] {instant(r.getOffsetDateTime("actual_start")),
                instant(r.getOffsetDateTime("actual_end"))});
    }

    private static Instant instant(OffsetDateTime t) {
        return t == null ? null : t.toInstant();
    }
}
