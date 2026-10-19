package com.microboxlabs.miot.symptoms.map;

import com.microboxlabs.miot.core.gps.GpsDatabase;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import io.smallrye.mutiny.Uni;
import io.vertx.mutiny.sqlclient.Pool;
import io.vertx.mutiny.sqlclient.Row;
import io.vertx.mutiny.sqlclient.RowSet;
import io.vertx.mutiny.sqlclient.Tuple;
import java.time.Duration;
import java.util.Optional;
import java.util.function.Supplier;

/**
 * {@link TreatmentReads} over the GPS database. Each read is one transaction that first sets the PostgREST claims to
 * the organization's client id, so {@code api_request_symptoms_client_id()} returns the id its symptoms are stored
 * under, as it does for the symptom list.
 */
public class PgTreatmentReads implements TreatmentReads {

    private static final Duration QUERY_TIMEOUT = Duration.ofSeconds(30);
    private static final ObjectMapper JSON = new ObjectMapper();

    /** Read only, and stops a query that runs longer than 25 s. */
    private static final String READ_ONLY = GpsDatabase.READ_ONLY + "; SET LOCAL statement_timeout = 25000";
    private static final String CLAIMS =
            "SELECT set_config('request.jwt.claims', json_build_object('sub', $1::text)::text, true)";

    static final String TREATMENT = """
            SELECT public.api_modular_treatments_info_general(
                p_client_id := $1::varchar, p_symptom_id := $2::bigint::int, p_dev_env := 1)::text AS answer
            FROM public.symptoms s
            WHERE s.id = $2 AND s.client_id = public.api_request_symptoms_client_id()""";

    static final String SIGNALS = """
            SELECT public.api_modular_treatment_symptoms_signals_map(
                p_client_id := $1::varchar, p_symptom_id := $2::bigint)::text AS answer
            FROM public.symptoms s
            WHERE s.id = $2 AND s.client_id = public.api_request_symptoms_client_id()""";

    // The asset must be mapped to the client when the trip started, or the client must have a symptom on the trip.
    // A trip still in live_trip runs until now; the window is at most 7 days. The points are sampled evenly, keeping
    // the first and the last. asset_data is indexed on ("timestamp", asset_id).
    static final String TRIP_POSITIONS = """
            WITH me AS (SELECT public.api_request_symptoms_client_id()::text AS stored),
            trip AS (
                SELECT t.start_time, least(t.end_time, t.start_time + interval '7 days', now()) AS end_time
                FROM (
                    SELECT start_time, now() AS end_time, 1 AS pick
                    FROM public.live_trip WHERE trip_id = $1 AND asset_id = $2
                    UNION ALL
                    SELECT start_time, coalesce(end_time, closed_timestamp, now()), 2
                    FROM public.historical_trip WHERE trip_id = $1 AND asset_id = $2
                ) t CROSS JOIN me
                WHERE EXISTS (SELECT 1 FROM public.asset_client_map m
                              WHERE m.asset_id = $2 AND m.shared_client_id IN ($3::text, me.stored)
                                AND (m.valid_from IS NULL OR m.valid_from <= t.start_time)
                                AND (m.valid_to IS NULL OR m.valid_to >= t.start_time))
                   OR EXISTS (SELECT 1 FROM public.symptoms y
                              WHERE y.client_id = me.stored AND y.trip_id = $1 AND y.asset_id = $2)
                ORDER BY t.pick
                LIMIT 1
            ),
            pts AS (
                SELECT a.asset_id, a."timestamp", a.speed, a.heading, a.location,
                       row_number() OVER (ORDER BY a."timestamp") AS rn, count(*) OVER () AS n
                FROM public.asset_data a JOIN trip ON a."timestamp" >= trip.start_time AND a."timestamp" <= trip.end_time
                WHERE a.asset_id = $2
            ),
            kept AS (
                SELECT * FROM pts
                WHERE (rn - 1) % greatest(1, ceil((n - 1)::numeric / ($4::int - 1)))::bigint = 0 OR rn = n
            )
            SELECT (SELECT count(*) FROM trip)::int AS found,
                   (SELECT coalesce(json_agg(json_build_object(
                        'assetid', p.asset_id, 'timestamp', p."timestamp", 'speed', p.speed, 'heading', p.heading,
                        'location', p.location::text,
                        'longitude', ST_X(p.location::geometry), 'latitude', ST_Y(p.location::geometry))
                        ORDER BY p."timestamp"), '[]'::json) FROM kept p)::text AS positions""";

    private final Supplier<Pool> pool;

    public PgTreatmentReads(Supplier<Pool> pool) {
        this.pool = pool;
    }

    @Override
    public Uni<Optional<JsonNode>> treatment(String clientId, long symptomId) {
        return asClient(clientId, TREATMENT, Tuple.of(clientId, symptomId))
                .map(row -> row.map(r -> parse(r.getString("answer"))));
    }

    @Override
    public Uni<Optional<JsonNode>> signals(String clientId, long symptomId) {
        return asClient(clientId, SIGNALS, Tuple.of(clientId, symptomId))
                .map(row -> row.map(r -> parse(r.getString("answer"))));
    }

    @Override
    public Uni<Optional<JsonNode>> tripPositions(String tripId, String assetId, String clientId, int limit) {
        if (limit < 2) {
            throw new IllegalArgumentException("limit must be at least 2");
        }
        return asClient(clientId, TRIP_POSITIONS, Tuple.of(tripId, assetId, clientId, limit))
                .map(row -> row.filter(r -> r.getInteger("found") > 0).map(r -> parse(r.getString("positions"))));
    }

    private Uni<Optional<Row>> asClient(String clientId, String sql, Tuple args) {
        return pool.get().withTransaction(conn -> conn.query(READ_ONLY).execute()
                        .flatMap(ignored -> conn.preparedQuery(CLAIMS).execute(Tuple.of(clientId)))
                        .flatMap(ignored -> conn.preparedQuery(sql).execute(args)))
                .ifNoItem().after(QUERY_TIMEOUT).fail()
                .map(PgTreatmentReads::first);
    }

    private static Optional<Row> first(RowSet<Row> rows) {
        var it = rows.iterator();
        return it.hasNext() ? Optional.of(it.next()) : Optional.empty();
    }

    private static JsonNode parse(String json) {
        if (json == null) {
            return null;
        }
        try {
            return JSON.readTree(json);
        } catch (JsonProcessingException e) {
            throw new IllegalStateException("The GPS database answered with invalid JSON", e);
        }
    }
}
