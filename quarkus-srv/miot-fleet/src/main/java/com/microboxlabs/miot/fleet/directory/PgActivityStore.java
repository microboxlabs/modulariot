package com.microboxlabs.miot.fleet.directory;

import io.smallrye.mutiny.Uni;
import io.vertx.mutiny.sqlclient.Pool;
import io.vertx.mutiny.sqlclient.Row;
import io.vertx.mutiny.sqlclient.RowSet;
import io.vertx.mutiny.sqlclient.Tuple;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.util.Collection;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.function.Supplier;
import java.util.stream.StreamSupport;

/** {@link ActivityStore} on the modulith database, schema {@code miot_fleet}. */
public class PgActivityStore implements ActivityStore {

    private static final Duration QUERY_TIMEOUT = Duration.ofSeconds(60);

    private static final String DELETE_HOURS =
            "DELETE FROM miot_fleet.asset_activity_hour WHERE hour >= $1 AND hour < $2";

    private static final String INSERT_HOUR = """
            INSERT INTO miot_fleet.asset_activity_hour (asset_id, hour, signals, engine_s, idle_s, moving_s, km)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            ON CONFLICT (asset_id, hour) DO UPDATE SET signals = EXCLUDED.signals, engine_s = EXCLUDED.engine_s,
                idle_s = EXCLUDED.idle_s, moving_s = EXCLUDED.moving_s, km = EXCLUDED.km""";

    private static final String DELETE_DAYS =
            "DELETE FROM miot_fleet.asset_activity_day WHERE day >= $1 AND day <= $2";

    // $1 and $2 bound the local days that contain the saved hours, as UTC instants.
    private static final String REBUILD_DAYS = """
            INSERT INTO miot_fleet.asset_activity_day (asset_id, day, signals, engine_s, idle_s, moving_s, km)
            SELECT asset_id, (hour AT TIME ZONE $3)::date, sum(signals), sum(engine_s), sum(idle_s), sum(moving_s),
                   sum(km)
            FROM miot_fleet.asset_activity_hour
            WHERE hour >= $1 AND hour < $2
            GROUP BY 1, 2
            ON CONFLICT (asset_id, day) DO UPDATE SET signals = EXCLUDED.signals, engine_s = EXCLUDED.engine_s,
                idle_s = EXCLUDED.idle_s, moving_s = EXCLUDED.moving_s, km = EXCLUDED.km""";

    private static final String DAYS = """
            SELECT day, signals, engine_s, idle_s, moving_s, km::float8 AS km FROM miot_fleet.asset_activity_day
            WHERE asset_id = $1 AND day >= $2 AND day <= $3
            ORDER BY day""";

    private static final String TOTALS = """
            SELECT asset_id, sum(km)::float8 AS km, sum(engine_s)::bigint AS engine_s, sum(idle_s)::bigint AS idle_s,
                   sum(moving_s)::bigint AS moving_s, count(*) FILTER (WHERE moving_s > 0)::int AS active_days
            FROM miot_fleet.asset_activity_day
            WHERE asset_id = ANY($1) AND day >= $2 AND day <= $3
            GROUP BY asset_id""";

    private static final String CURSOR = "SELECT value FROM miot_fleet.activity_cursor WHERE name = $1";

    private static final String SET_CURSOR = """
            INSERT INTO miot_fleet.activity_cursor (name, value) VALUES ($1, $2)
            ON CONFLICT (name) DO UPDATE SET value = EXCLUDED.value""";

    private static final String PRUNE_HOURS = "DELETE FROM miot_fleet.asset_activity_hour WHERE hour < $1";

    private static final String PRUNE_DAYS = "DELETE FROM miot_fleet.asset_activity_day WHERE day < $1";

    private final Supplier<Pool> pool;

    public PgActivityStore(Supplier<Pool> pool) {
        this.pool = pool;
    }

    @Override
    public void saveHours(Instant from, Instant to, List<ActivityHour> hours, ZoneId zone) {
        LocalDate firstDay = from.atZone(zone).toLocalDate();
        LocalDate lastDay = to.minusSeconds(1).atZone(zone).toLocalDate();
        Instant dayStart = firstDay.atStartOfDay(zone).toInstant();
        Instant dayEnd = lastDay.plusDays(1).atStartOfDay(zone).toInstant();
        List<Tuple> rows = hours.stream()
                .map(h -> Tuple.tuple().addValue(h.assetId()).addValue(time(h.hour())).addValue(h.signals())
                        .addValue(h.engineSeconds()).addValue(h.idleSeconds()).addValue(h.movingSeconds())
                        .addValue(h.km()))
                .toList();
        pool.get().withTransaction(tx -> {
            Uni<?> chain = tx.preparedQuery(DELETE_HOURS).execute(Tuple.of(time(from), time(to)));
            if (!rows.isEmpty()) {
                chain = chain.chain(() -> tx.preparedQuery(INSERT_HOUR).executeBatch(rows));
            }
            return chain
                    .chain(() -> tx.preparedQuery(DELETE_DAYS).execute(Tuple.of(firstDay, lastDay)))
                    .chain(() -> tx.preparedQuery(REBUILD_DAYS)
                            .execute(Tuple.of(time(dayStart), time(dayEnd), zone.getId())))
                    .replaceWithVoid();
        }).await().atMost(QUERY_TIMEOUT);
    }

    @Override
    public List<ActivityDay> days(String assetId, LocalDate from, LocalDate to) {
        return StreamSupport.stream(query(DAYS, Tuple.of(assetId, from, to)).spliterator(), false)
                .map(r -> new ActivityDay(r.getLocalDate("day"), r.getInteger("signals"), r.getInteger("engine_s"),
                        r.getInteger("idle_s"), r.getInteger("moving_s"), r.getDouble("km")))
                .toList();
    }

    @Override
    public Map<String, ActivityTotals> totals(Collection<String> assetIds, LocalDate from, LocalDate to) {
        Map<String, ActivityTotals> found = new HashMap<>();
        if (assetIds.isEmpty()) {
            return found;
        }
        for (Row r : query(TOTALS, Tuple.of(assetIds.toArray(String[]::new), from, to))) {
            found.put(r.getString("asset_id"), new ActivityTotals(r.getDouble("km"), r.getLong("engine_s"),
                    r.getLong("idle_s"), r.getLong("moving_s"), r.getInteger("active_days")));
        }
        return found;
    }

    @Override
    public Optional<Instant> cursor(String name) {
        var rows = query(CURSOR, Tuple.of(name)).iterator();
        return rows.hasNext() ? Optional.of(rows.next().getOffsetDateTime("value").toInstant()) : Optional.empty();
    }

    @Override
    public void cursor(String name, Instant value) {
        query(SET_CURSOR, Tuple.of(name, time(value)));
    }

    @Override
    public void prune(Instant hoursBefore, LocalDate daysBefore) {
        query(PRUNE_HOURS, Tuple.of(time(hoursBefore)));
        query(PRUNE_DAYS, Tuple.of(daysBefore));
    }

    private RowSet<Row> query(String sql, Tuple params) {
        return pool.get().preparedQuery(sql).execute(params).await().atMost(QUERY_TIMEOUT);
    }

    private static OffsetDateTime time(Instant at) {
        return OffsetDateTime.ofInstant(at, ZoneOffset.UTC);
    }
}
