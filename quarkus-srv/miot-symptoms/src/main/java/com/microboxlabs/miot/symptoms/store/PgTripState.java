package com.microboxlabs.miot.symptoms.store;

import com.microboxlabs.miot.symptoms.lostsignal.TripEnds;
import io.smallrye.mutiny.Uni;
import io.vertx.mutiny.sqlclient.Row;
import io.vertx.mutiny.sqlclient.SqlConnection;
import io.vertx.mutiny.sqlclient.Tuple;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.UUID;

/** Authoritative trip facts and the lock shared by openings and trip-end closure, including deleted trips. */
final class PgTripState {
    private static final String CHECK_TRIP = """
            SELECT status, actual_start, actual_end, updated_at FROM miot_trips.trip
             WHERE tenant_code = $1 AND id = $2 FOR SHARE
            """;

    record Window(boolean managed, boolean ended, Instant start, Instant end, boolean intervalKnown) {
        Window(boolean managed, boolean ended, Instant start, Instant end) {
            this(managed, ended, start, end, start != null && end != null);
        }

        boolean contains(Instant at) {
            return intervalKnown && start != null && end != null && !at.isBefore(start) && !at.isAfter(end);
        }
    }

    private PgTripState() { }

    static Uni<Window> lock(SqlConnection conn, String tenant, String tripId) {
        UUID trip = TripEnds.uuid(tripId);
        if (trip == null) {
            return Uni.createFrom().item(new Window(false, false, null, null));
        }
        return conn.preparedQuery("SELECT pg_advisory_xact_lock(hashtextextended($1, 0))")
                .execute(Tuple.of("miot.symptoms.trip:" + tenant + ":" + trip))
                .flatMap(ignored -> conn.query("SELECT to_regclass('miot_trips.trip') IS NOT NULL AS enabled").execute())
                .flatMap(enabled -> {
                    if (!Boolean.TRUE.equals(enabled.iterator().next().getBoolean("enabled"))) {
                        return Uni.createFrom().item(new Window(false, false, null, null));
                    }
                    return conn.preparedQuery(CHECK_TRIP).execute(Tuple.of(tenant, trip))
                            .flatMap(rows -> {
                                var iterator = rows.iterator();
                                Row live = iterator.hasNext() ? iterator.next() : null;
                                Window current = live != null ? window(live)
                                        : new Window(true, true, null, null);
                                return conn.preparedQuery("""
                                        SELECT started_at, ended_at, interval_known FROM miot_symptoms.trip_end_state
                                         WHERE tenant_code = $1 AND trip_id = $2 FOR SHARE
                                        """).execute(Tuple.of(tenant, trip)).map(saved -> history(live, current, saved));
                            });
                });
    }

    /** Keeps the interval after the trips module removes its completed trip. Unknown starts stay unknown. */
    static Uni<Void> remember(SqlConnection conn, String tenant, String tripId, Instant at, Window window) {
        if (!window.managed() || !window.ended()) return Uni.createFrom().voidItem();
        return conn.preparedQuery("""
                INSERT INTO miot_symptoms.trip_end_state (tenant_code, trip_id, started_at, ended_at, interval_known)
                VALUES ($1, $2, $3, $4, $5) ON CONFLICT (tenant_code, trip_id) DO UPDATE
                    SET started_at = COALESCE(EXCLUDED.started_at, trip_end_state.started_at),
                        ended_at = EXCLUDED.ended_at, interval_known = EXCLUDED.interval_known
                """).execute(Tuple.of(tenant, TripEnds.uuid(tripId), utc(window.start()),
                        utc(window.end() == null ? at : window.end()), window.intervalKnown())).replaceWithVoid();
    }

    private static Window history(Row live, Window current, Iterable<Row> saved) {
        var history = saved.iterator();
        if (!history.hasNext()) return current;
        Row row = history.next();
        if (live != null && live.getOffsetDateTime("actual_end") != null) {
            Instant start = current.start() == null ? instant(row.getOffsetDateTime("started_at")) : current.start();
            return new Window(true, true, start, current.end(), start != null);
        }
        return new Window(true, true, instant(row.getOffsetDateTime("started_at")),
                instant(row.getOffsetDateTime("ended_at")), Boolean.TRUE.equals(row.getBoolean("interval_known")));
    }

    private static Window window(Row row) {
        String status = row.getString("status");
        boolean ended = "completed".equals(status) || "cancelled".equals(status);
        Instant end = instant(row.getOffsetDateTime("actual_end"));
        boolean intervalKnown = end != null && row.getOffsetDateTime("actual_start") != null;
        if (ended && end == null) end = instant(row.getOffsetDateTime("updated_at"));
        return new Window(true, ended || end != null, instant(row.getOffsetDateTime("actual_start")), end, intervalKnown);
    }

    private static Instant instant(OffsetDateTime at) {
        return at == null ? null : at.toInstant();
    }

    private static OffsetDateTime utc(Instant at) {
        return at == null ? null : at.atOffset(ZoneOffset.UTC);
    }
}
