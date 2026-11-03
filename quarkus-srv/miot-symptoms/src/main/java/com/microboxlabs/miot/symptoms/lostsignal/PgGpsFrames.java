package com.microboxlabs.miot.symptoms.lostsignal;

import io.vertx.mutiny.sqlclient.Pool;
import io.vertx.mutiny.sqlclient.Row;
import io.vertx.mutiny.sqlclient.RowSet;
import io.vertx.mutiny.sqlclient.Tuple;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.List;
import java.util.function.Supplier;

/**
 * {@link GpsFrames} over the GPS database's {@code public.asset_data}, read only. Queries read a range of
 * {@code "timestamp"}, using the index on {@code ("timestamp", asset_id)}. Interval histograms also read the
 * {@value #LOOKBACK_H} hours before the range, for the predecessor of its first frames. The sender is
 * {@code client_id}.
 */
public class PgGpsFrames implements GpsFrames {

    private static final Duration QUERY_TIMEOUT = Duration.ofSeconds(90);
    private static final String STATEMENT_TIMEOUT = "SET LOCAL statement_timeout = 80000";
    /** Values above a week are counted as a week. */
    private static final int CAP_S = 604_800;

    private static final String RANGE = """
            FROM public.asset_data a
            WHERE a."timestamp" >= $1 AND a."timestamp" < $2
              AND a.client_id IS NOT NULL AND a.request_timestamp IS NOT NULL AND a.location IS NOT NULL
            """;

    static final String DELAYS = """
            SELECT a.client_id AS sender,
                   least(greatest(0, floor(extract(epoch FROM a.request_timestamp - a."timestamp"))), %d)::int AS s,
                   count(*) AS n
            """.formatted(CAP_S) + RANGE + "GROUP BY 1, 2";

    /**
     * The predecessor of a frame early in the range is looked for at most {@value #LOOKBACK_H} hours back, in the
     * same index range scan. A per-asset "latest frame before the range" lookup walks the {@code ("timestamp",
     * asset_id)} index backwards until it finds that asset, which for an asset silent for days reads most of the
     * table and timed out whole days in production. An interval longer than the lookback that crosses the start is
     * not counted.
     */
    static final int LOOKBACK_H = 2;

    static final String INTERVALS = """
            SELECT x.sender, least(floor(x.dt), %d)::int AS s, count(*) AS n
            FROM (
                SELECT a.client_id AS sender, a."timestamp" AS at,
                       extract(epoch FROM a."timestamp" - lag(a."timestamp")
                           OVER (PARTITION BY a.asset_id, a.client_id ORDER BY a."timestamp")) AS dt
                FROM public.asset_data a
                WHERE a."timestamp" >= $1::timestamptz - interval '%d hours' AND a."timestamp" < $2
                  AND a.client_id IS NOT NULL AND a.request_timestamp IS NOT NULL AND a.location IS NOT NULL
            ) x
            WHERE x.at >= $1 AND x.at < $2 AND x.dt > 0
              -- Keep longer intervals when their predecessor is inside the requested range.
              AND (x.dt <= %d OR x.dt <= extract(epoch FROM x.at - $1))
            GROUP BY 1, 2""".formatted(CAP_S, LOOKBACK_H, LOOKBACK_H * 3600);

    static final String FRAMES = """
            SELECT a.asset_id, a.client_id AS sender,
                   (extract(epoch FROM a."timestamp") * 1000)::bigint AS at_ms,
                   greatest(0, extract(epoch FROM a.request_timestamp - a."timestamp"))::float8 AS delay_s,
                   ST_Y(a.location::geometry) AS lat, ST_X(a.location::geometry) AS lon
            """ + RANGE + """
            ORDER BY a.asset_id, a.client_id, a."timestamp"
            """;

    private final Supplier<Pool> pool;

    public PgGpsFrames(Supplier<Pool> pool) {
        this.pool = pool;
    }

    @Override
    public List<Count> delays(Instant from, Instant to) {
        return counts(DELAYS, from, to);
    }

    @Override
    public List<Count> intervals(Instant from, Instant to) {
        return counts(INTERVALS, from, to);
    }

    @Override
    public List<GpsFrames.GpsRow> frames(Instant from, Instant to) {
        List<GpsFrames.GpsRow> out = new ArrayList<>();
        for (Row r : query(FRAMES, from, to)) {
            Double lat = r.getDouble("lat");
            Double lon = r.getDouble("lon");
            if (lat != null && lon != null) {
                out.add(new GpsFrames.GpsRow(r.getString("asset_id"), r.getString("sender"), r.getLong("at_ms"),
                        r.getDouble("delay_s"), lat, lon));
            }
        }
        return out;
    }

    private List<Count> counts(String sql, Instant from, Instant to) {
        List<Count> out = new ArrayList<>();
        for (Row r : query(sql, from, to)) {
            out.add(new Count(r.getString("sender"), r.getInteger("s"), r.getLong("n")));
        }
        return out;
    }

    private RowSet<Row> query(String sql, Instant from, Instant to) {
        Tuple args = Tuple.of(from.atOffset(ZoneOffset.UTC), to.atOffset(ZoneOffset.UTC));
        return pool.get().withTransaction(conn -> conn.query(STATEMENT_TIMEOUT).execute()
                        .flatMap(ignored -> conn.preparedQuery(sql).execute(args)))
                .await().atMost(QUERY_TIMEOUT);
    }
}
