package com.microboxlabs.miot.fleet.directory;

import io.vertx.mutiny.sqlclient.Pool;
import io.vertx.mutiny.sqlclient.Row;
import io.vertx.mutiny.sqlclient.RowSet;
import io.vertx.mutiny.sqlclient.Tuple;
import java.time.Duration;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Set;
import java.util.function.Supplier;
import java.util.stream.StreamSupport;

/**
 * {@link FleetData} over the GPS database: {@code last_signal_data}, {@code asset_client_map},
 * {@code live_trip}, {@code historical_trip} and {@code asset_data}. The pool opens read-only sessions.
 *
 * <p>In {@code live_trip}, {@code SCHEDULED} rows are trips in progress and {@code ADDED} rows are planned trips
 * whose origin was not reached yet.
 */
public class GpsFleetData implements FleetData {

    private static final Duration QUERY_TIMEOUT = Duration.ofSeconds(60);

    private static final String CARRIER = "carrier";
    private static final String TRAILER = "trailer";
    private static final String DRIVER = "driver";
    private static final String ORIGIN = "origin";

    private static final String TRIP_COLUMNS = """
            t.trip_id, t.origin_geofence_label, t.destination_geofence_label, t.status, t.start_time,
            t.end_time, t.estimated_arrival_time, t.carrier_name, t.driver_name, t.rampla_plate""";

    private static final String ASSETS = """
            WITH visible AS (
                SELECT asset_id FROM public.asset_client_map
                WHERE shared_client_id = ANY($1) AND active
                  AND (valid_from IS NULL OR valid_from <= now()) AND (valid_to IS NULL OR valid_to > now())
                UNION
                SELECT asset_id FROM public.last_signal_data WHERE client_id = ANY($1)
            ),
            cur AS (
                SELECT DISTINCT ON (t.asset_id) t.asset_id, %1$s
                FROM public.live_trip t JOIN visible v ON v.asset_id = t.asset_id
                WHERE t.status = 'SCHEDULED' OR t.origin_visited
                ORDER BY t.asset_id, t.start_time DESC
            ),
            nxt AS (
                SELECT DISTINCT ON (t.asset_id) t.asset_id, %1$s
                FROM public.live_trip t JOIN visible v ON v.asset_id = t.asset_id
                WHERE t.status = 'ADDED' AND NOT coalesce(t.origin_visited, false)
                  AND t.start_time > now() - interval '1 day'
                ORDER BY t.asset_id, t.start_time
            ),
            recent AS (
                SELECT h.asset_id, nullif(trim(h.carrier_name), '') AS carrier, nullif(trim(h.rampla_plate), '') AS trailer,
                       nullif(trim(h.driver_name), '') AS driver, nullif(trim(h.origin_geofence_label), '') AS origin,
                       h.start_time, coalesce(h.end_time, h.closed_timestamp) AS end_time
                FROM public.historical_trip h JOIN visible v ON v.asset_id = h.asset_id
                WHERE h.start_time >= now() - interval '30 days'
            ),
            stats AS (
                SELECT asset_id, count(*)::int AS trips,
                       coalesce(sum(extract(epoch FROM end_time - start_time)) FILTER (WHERE end_time > start_time), 0)
                           / 3600.0 AS hours
                FROM recent GROUP BY asset_id
            ),
            carrier AS (%2$s),
            trailer AS (%3$s),
            driver AS (%4$s),
            origin AS (%5$s)
            SELECT v.asset_id, s.type, s.year, s."timestamp" AS signal_at,
                   ST_Y(s.location::geometry) AS lat, ST_X(s.location::geometry) AS lon, s.speed,
                   (s.sensors ->> 'engine_status')::boolean AS engine_on,
                   nullif(trim(s.telcom_gps_provider), '') AS provider, s.client_id AS sender,
                   nullif(trim(s.driver_info_name), '') AS signal_driver,
                   cur.trip_id AS c_id, cur.origin_geofence_label AS c_origin, cur.destination_geofence_label AS c_dest,
                   cur.status AS c_status, cur.start_time AS c_start, cur.end_time AS c_end,
                   cur.estimated_arrival_time AS c_eta, cur.carrier_name AS c_carrier, cur.driver_name AS c_driver,
                   cur.rampla_plate AS c_trailer,
                   nxt.trip_id AS n_id, nxt.origin_geofence_label AS n_origin, nxt.destination_geofence_label AS n_dest,
                   nxt.status AS n_status, nxt.start_time AS n_start, nxt.end_time AS n_end,
                   nxt.estimated_arrival_time AS n_eta, nxt.carrier_name AS n_carrier, nxt.driver_name AS n_driver,
                   nxt.rampla_plate AS n_trailer,
                   coalesce(st.trips, 0) AS trips, coalesce(st.hours, 0)::float8 AS trip_hours,
                   carrier.value AS carrier, carrier.n AS carrier_n, trailer.value AS trailer, trailer.n AS trailer_n,
                   driver.value AS driver, driver.n AS driver_n, origin.value AS origin, origin.n AS origin_n
            FROM visible v
            LEFT JOIN public.last_signal_data s ON s.asset_id = v.asset_id
            LEFT JOIN cur ON cur.asset_id = v.asset_id
            LEFT JOIN nxt ON nxt.asset_id = v.asset_id
            LEFT JOIN stats st ON st.asset_id = v.asset_id
            LEFT JOIN carrier ON carrier.asset_id = v.asset_id
            LEFT JOIN trailer ON trailer.asset_id = v.asset_id
            LEFT JOIN driver ON driver.asset_id = v.asset_id
            LEFT JOIN origin ON origin.asset_id = v.asset_id""".formatted(TRIP_COLUMNS, top(CARRIER),
            top(TRAILER), top(DRIVER), top(ORIGIN));

    private static final String PLANNED = "SELECT " + TRIP_COLUMNS + """
             FROM public.live_trip t
            WHERE t.asset_id = $1 AND t.status = 'ADDED' AND NOT coalesce(t.origin_visited, false)
              AND t.start_time > now() - interval '1 day'
            ORDER BY t.start_time
            LIMIT 10""";

    private static final String RECENT = """
            SELECT t.trip_id, t.origin_geofence_label, t.destination_geofence_label, t.status, t.start_time,
                   coalesce(t.end_time, t.closed_timestamp) AS end_time, t.estimated_arrival_time, t.carrier_name,
                   t.driver_name, t.rampla_plate
            FROM public.historical_trip t
            WHERE t.asset_id = $1
            ORDER BY t.start_time DESC
            LIMIT $2""";

    // asset_data is indexed on ("timestamp", asset_id). Each signal covers the time until the next one, at most
    // 10 minutes, in the state it reported; that interval is clipped to the window, so the 10 minutes on each side
    // only bring the neighbours of the edge signals. A segment counts as distance when either end moves and the
    // implied speed stays under 150 km/h; it is split in proportion to the time inside the window.
    private static final String ACTIVITY = """
            WITH pts AS (
                SELECT asset_id, "timestamp" AS ts, coalesce(speed, 0) AS speed,
                       (sensors ->> 'engine_status')::boolean AS eng, location
                FROM public.asset_data
                WHERE "timestamp" >= $1::timestamptz - interval '10 minutes'
                  AND "timestamp" < $2::timestamptz + interval '10 minutes'
            ),
            seq AS (
                SELECT asset_id, ts, speed, eng, location, lead(ts) OVER w AS next_ts,
                       lead(speed) OVER w AS next_speed, lead(location) OVER w AS next_loc
                FROM pts WINDOW w AS (PARTITION BY asset_id ORDER BY ts)
            ),
            seg AS (
                SELECT asset_id, ts, speed, eng,
                       greatest(extract(epoch FROM coalesce(next_ts, ts + interval '10 minutes') - ts), 1) AS span,
                       greatest(extract(epoch FROM least(next_ts, ts + interval '10 minutes', $2::timestamptz)
                           - greatest(ts, $1::timestamptz)), 0) AS secs,
                       CASE WHEN next_ts - ts <= interval '10 minutes' AND (speed >= 3 OR next_speed >= 3)
                            THEN ST_Distance(location, next_loc) / 1000.0 ELSE 0 END AS km
                FROM seq WHERE ts < $2
            )
            SELECT asset_id, $1::timestamptz AS hour, count(*) FILTER (WHERE ts >= $1)::int AS signals,
                   least(coalesce(sum(secs) FILTER (WHERE eng), 0), 3600)::int AS engine_s,
                   least(coalesce(sum(secs) FILTER (WHERE eng AND speed < 3), 0), 3600)::int AS idle_s,
                   least(coalesce(sum(secs) FILTER (WHERE speed >= 3), 0), 3600)::int AS moving_s,
                   coalesce(sum(km * secs / span) FILTER (WHERE km / span * 3600 <= 150), 0)::float8 AS km
            FROM seg
            WHERE ts >= $1 OR secs > 0
            GROUP BY asset_id""";

    private final Supplier<Pool> pool;

    public GpsFleetData(Supplier<Pool> pool) {
        this.pool = pool;
    }

    private static String top(String column) {
        return """
                SELECT DISTINCT ON (asset_id) asset_id, value, n FROM (
                    SELECT asset_id, %1$s AS value, count(*)::int AS n FROM recent
                    WHERE %1$s IS NOT NULL GROUP BY asset_id, %1$s
                ) x ORDER BY asset_id, n DESC, value""".formatted(column);
    }

    @Override
    public List<AssetFacts> assets(Set<String> clientIds) {
        List<AssetFacts> assets = new ArrayList<>();
        if (clientIds.isEmpty()) {
            return assets;
        }
        for (Row r : query(ASSETS, Tuple.of(clientIds.toArray(String[]::new)))) {
            int trips = r.getInteger("trips");
            assets.add(new AssetFacts(r.getString("asset_id"), r.getString("type"), positive(r.getInteger("year")),
                    instant(r.getOffsetDateTime("signal_at")), r.getDouble("lat"), r.getDouble("lon"),
                    r.getDouble("speed"), r.getBoolean("engine_on"), r.getString("provider"), r.getString("sender"),
                    r.getString("signal_driver"), trip(r, "c_"), trip(r, "n_"), trips, r.getDouble("trip_hours"),
                    share(r, CARRIER, trips), share(r, TRAILER, trips), share(r, DRIVER, trips),
                    share(r, ORIGIN, trips)));
        }
        return assets;
    }

    @Override
    public List<TripView> plannedTrips(String assetId) {
        return trips(query(PLANNED, Tuple.of(assetId)));
    }

    @Override
    public List<TripView> recentTrips(String assetId, int limit) {
        return trips(query(RECENT, Tuple.of(assetId, limit)));
    }

    @Override
    public List<ActivityHour> activity(Instant from, Instant to) {
        RowSet<Row> rows = query(ACTIVITY, Tuple.of(OffsetDateTime.ofInstant(from, java.time.ZoneOffset.UTC),
                OffsetDateTime.ofInstant(to, java.time.ZoneOffset.UTC)));
        return StreamSupport.stream(rows.spliterator(), false)
                .map(r -> new ActivityHour(r.getString("asset_id"), instant(r.getOffsetDateTime("hour")),
                        r.getInteger("signals"), r.getInteger("engine_s"), r.getInteger("idle_s"),
                        r.getInteger("moving_s"), r.getDouble("km")))
                .toList();
    }

    private RowSet<Row> query(String sql, Tuple params) {
        return pool.get().preparedQuery(sql).execute(params).await().atMost(QUERY_TIMEOUT);
    }

    private static List<TripView> trips(RowSet<Row> rows) {
        return StreamSupport.stream(rows.spliterator(), false).map(r -> trip(r, "")).toList();
    }

    private static TripView trip(Row r, String prefix) {
        String id = r.getString(prefix.isEmpty() ? "trip_id" : prefix + "id");
        if (id == null) {
            return null;
        }
        if (prefix.isEmpty()) {
            return new TripView(id, r.getString("origin_geofence_label"), r.getString("destination_geofence_label"),
                    r.getString("status"), instant(r.getOffsetDateTime("start_time")),
                    instant(r.getOffsetDateTime("end_time")), instant(r.getOffsetDateTime("estimated_arrival_time")),
                    r.getString("carrier_name"), r.getString("driver_name"), r.getString("rampla_plate"));
        }
        return new TripView(id, r.getString(prefix + ORIGIN), r.getString(prefix + "dest"),
                r.getString(prefix + "status"), instant(r.getOffsetDateTime(prefix + "start")),
                instant(r.getOffsetDateTime(prefix + "end")), instant(r.getOffsetDateTime(prefix + "eta")),
                r.getString(prefix + CARRIER), r.getString(prefix + DRIVER), r.getString(prefix + TRAILER));
    }

    private static Share share(Row r, String column, int total) {
        String value = r.getString(column);
        return value == null ? null : new Share(value, r.getInteger(column + "_n"), total);
    }

    private static Integer positive(Integer value) {
        return value != null && value > 0 ? value : null;
    }

    private static Instant instant(OffsetDateTime value) {
        return value == null ? null : value.toInstant();
    }
}
