package com.microboxlabs.miot.symptoms.lostsignal;

import com.microboxlabs.miot.symptoms.lostsignal.CoverageDay.CellDay;
import com.microboxlabs.miot.symptoms.lostsignal.CoverageDay.SenderDay;
import io.smallrye.mutiny.Uni;
import io.vertx.mutiny.sqlclient.Pool;
import io.vertx.mutiny.sqlclient.Row;
import io.vertx.mutiny.sqlclient.SqlConnection;
import io.vertx.mutiny.sqlclient.Tuple;
import java.time.Duration;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.function.Function;
import java.util.function.Supplier;

/**
 * {@link CoverageStore} in the symptoms database. Rows are written in chunks with {@code unnest}; the shadow map reads
 * the cell rows summed in SQL, one row per sender and cell instead of one per day.
 */
public class PgCoverageStore implements CoverageStore {

    private static final Duration QUERY_TIMEOUT = Duration.ofSeconds(60);
    static final int CHUNK = 5000;

    private static final String INSERT_CELLS = """
            INSERT INTO miot_symptoms.coverage_day (sender, cell, day, frames, delayed, missing)
            SELECT s, c, $3, f, d, m
            FROM unnest($1::text[], $2::text[], $4::int[], $5::int[], $6::float8[]) AS t(s, c, f, d, m)
            """;

    private static final String INSERT_SENDERS = """
            INSERT INTO miot_symptoms.coverage_sender_day
                (sender, day, frames, delayed, missing, median_delay_s, median_interval_s, anomalous)
            SELECT s, $2, f, d, m, md, mi, false
            FROM unnest($1::text[], $3::int[], $4::int[], $5::float8[], $6::float8[], $7::float8[])
                AS t(s, f, d, m, md, mi)
            """;

    private static final String RUN = """
            INSERT INTO miot_symptoms.coverage_run (day, frames, finished_at) VALUES ($1, $2, now())
            ON CONFLICT (day) DO UPDATE SET frames = EXCLUDED.frames, finished_at = EXCLUDED.finished_at
            """;

    private static final String READ_SENDERS = """
            SELECT sender, day, frames, delayed, missing, median_delay_s, median_interval_s, anomalous
            FROM miot_symptoms.coverage_sender_day WHERE day >= $1
            """;

    /**
     * The cell rows summed by sender and cell: each day with its weight ($1, $2), without the dropped sender-days
     * ($3, $4), keeping sums of at least $5 weighted frames. Same as {@link ShadowMap#sum}.
     */
    static final String SUM_CELLS = """
            SELECT c.sender, c.cell, sum(w.w * c.frames) AS frames, sum(w.w * c.delayed) AS delayed,
                   sum(w.w * c.missing) AS missing
            FROM miot_symptoms.coverage_day c
            JOIN unnest($1::date[], $2::float8[]) AS w(day, w) ON w.day = c.day
            WHERE NOT EXISTS (
                SELECT 1 FROM unnest($3::text[], $4::date[]) AS d(sender, day)
                WHERE d.sender = c.sender AND d.day = c.day)
            GROUP BY c.sender, c.cell
            HAVING sum(w.w * c.frames) >= $5
            """;

    private final Supplier<Pool> pool;

    public PgCoverageStore(Supplier<Pool> pool) {
        this.pool = pool;
    }

    @Override
    public Set<LocalDate> done(LocalDate from) {
        Set<LocalDate> out = new HashSet<>();
        for (Row r : pool.get().preparedQuery("SELECT day FROM miot_symptoms.coverage_run WHERE day >= $1")
                .execute(Tuple.of(from)).await().atMost(QUERY_TIMEOUT)) {
            out.add(r.getLocalDate("day"));
        }
        return out;
    }

    @Override
    public void replace(LocalDate day, List<CellDay> cells, List<SenderDay> senders, long frames) {
        pool.get().withTransaction(conn -> {
            Uni<?> chain = conn.preparedQuery("DELETE FROM miot_symptoms.coverage_day WHERE day = $1")
                    .execute(Tuple.of(day))
                    .flatMap(x -> conn.preparedQuery("DELETE FROM miot_symptoms.coverage_sender_day WHERE day = $1")
                            .execute(Tuple.of(day)));
            for (int i = 0; i < cells.size(); i += CHUNK) {
                List<CellDay> part = cells.subList(i, Math.min(cells.size(), i + CHUNK));
                chain = chain.flatMap(x -> insertCells(conn, day, part));
            }
            for (int i = 0; i < senders.size(); i += CHUNK) {
                List<SenderDay> part = senders.subList(i, Math.min(senders.size(), i + CHUNK));
                chain = chain.flatMap(x -> insertSenders(conn, day, part));
            }
            return chain.flatMap(x -> conn.preparedQuery(RUN).execute(Tuple.of(day, frames)));
        }).await().atMost(QUERY_TIMEOUT);
    }

    private static Uni<?> insertCells(SqlConnection conn, LocalDate day, List<CellDay> rows) {
        int n = rows.size();
        String[] s = new String[n];
        String[] c = new String[n];
        Integer[] f = new Integer[n];
        Integer[] d = new Integer[n];
        Double[] m = new Double[n];
        for (int i = 0; i < n; i++) {
            CellDay r = rows.get(i);
            s[i] = r.sender();
            c[i] = r.cell();
            f[i] = (int) r.frames();
            d[i] = (int) r.delayed();
            m[i] = r.missing();
        }
        return conn.preparedQuery(INSERT_CELLS).execute(Tuple.tuple().addArrayOfString(s).addArrayOfString(c)
                .addLocalDate(day).addArrayOfInteger(f).addArrayOfInteger(d).addArrayOfDouble(m));
    }

    private static Uni<?> insertSenders(SqlConnection conn, LocalDate day, List<SenderDay> rows) {
        int n = rows.size();
        String[] s = new String[n];
        Integer[] f = new Integer[n];
        Integer[] d = new Integer[n];
        Double[] m = new Double[n];
        Double[] md = new Double[n];
        Double[] mi = new Double[n];
        for (int i = 0; i < n; i++) {
            SenderDay r = rows.get(i);
            s[i] = r.sender();
            f[i] = (int) r.frames();
            d[i] = (int) r.delayed();
            m[i] = r.missing();
            md[i] = r.medianDelayS();
            mi[i] = r.medianIntervalS();
        }
        return conn.preparedQuery(INSERT_SENDERS).execute(Tuple.tuple().addArrayOfString(s).addLocalDate(day)
                .addArrayOfInteger(f).addArrayOfInteger(d).addArrayOfDouble(m).addArrayOfDouble(md)
                .addArrayOfDouble(mi));
    }

    /** One repeatable-read transaction gives both reads the same state, also during a daily replacement. */
    @Override
    public Window window(LocalDate from, Function<List<SenderDay>, ShadowMap.Plan> plan) {
        return pool.get().withTransaction(conn -> conn
                .query("SET TRANSACTION ISOLATION LEVEL REPEATABLE READ, READ ONLY").execute()
                .flatMap(x -> conn.preparedQuery(READ_SENDERS).execute(Tuple.of(from)))
                .flatMap(rows -> {
                    List<SenderDay> senders = new ArrayList<>();
                    rows.forEach(r -> senders.add(sender(r)));
                    ShadowMap.Plan p = plan.apply(senders);
                    return conn.preparedQuery(SUM_CELLS).execute(sumArgs(p)).map(sums -> {
                        List<ShadowMap.CellSum> cells = new ArrayList<>();
                        sums.forEach(r -> cells.add(new ShadowMap.CellSum(r.getString("sender"), r.getString("cell"),
                                r.getDouble("frames"), r.getDouble("delayed"), r.getDouble("missing"))));
                        return new Window(p, cells);
                    });
                }))
                .await().atMost(QUERY_TIMEOUT);
    }

    private static Tuple sumArgs(ShadowMap.Plan p) {
        LocalDate[] days = p.weights().keySet().toArray(LocalDate[]::new);
        Double[] weights = new Double[days.length];
        for (int i = 0; i < days.length; i++) {
            weights[i] = p.weights().get(days[i]);
        }
        List<SenderDay> dropped = p.dropped();
        return Tuple.tuple().addArrayOfLocalDate(days).addArrayOfDouble(weights)
                .addArrayOfString(dropped.stream().map(SenderDay::sender).toArray(String[]::new))
                .addArrayOfLocalDate(dropped.stream().map(SenderDay::day).toArray(LocalDate[]::new))
                .addDouble(p.minFrames());
    }

    @Override
    public List<CellDay> cells(LocalDate from) {
        List<CellDay> out = new ArrayList<>();
        for (Row r : pool.get().preparedQuery("""
                SELECT sender, cell, day, frames, delayed, missing FROM miot_symptoms.coverage_day WHERE day >= $1
                """).execute(Tuple.of(from)).await().atMost(QUERY_TIMEOUT)) {
            out.add(cell(r));
        }
        return out;
    }

    @Override
    public List<SenderDay> senders(LocalDate from) {
        List<SenderDay> out = new ArrayList<>();
        for (Row r : pool.get().preparedQuery(READ_SENDERS).execute(Tuple.of(from)).await().atMost(QUERY_TIMEOUT)) {
            out.add(sender(r));
        }
        return out;
    }

    private static CellDay cell(Row r) {
        return new CellDay(r.getString("sender"), r.getString("cell"), r.getLocalDate("day"),
                r.getInteger("frames"), r.getInteger("delayed"), r.getDouble("missing"));
    }

    private static SenderDay sender(Row r) {
        return new SenderDay(r.getString("sender"), r.getLocalDate("day"), r.getInteger("frames"),
                r.getInteger("delayed"), r.getDouble("missing"), r.getDouble("median_delay_s"),
                r.getDouble("median_interval_s"), r.getBoolean("anomalous"));
    }

    @Override
    public void flag(List<SenderDay> senders) {
        for (int i = 0; i < senders.size(); i += CHUNK) {
            List<SenderDay> part = senders.subList(i, Math.min(senders.size(), i + CHUNK));
            String[] s = part.stream().map(SenderDay::sender).toArray(String[]::new);
            LocalDate[] d = part.stream().map(SenderDay::day).toArray(LocalDate[]::new);
            Boolean[] a = part.stream().map(SenderDay::anomalous).toArray(Boolean[]::new);
            pool.get().preparedQuery("""
                    UPDATE miot_symptoms.coverage_sender_day c SET anomalous = t.a
                    FROM unnest($1::text[], $2::date[], $3::boolean[]) AS t(s, d, a)
                    WHERE c.sender = t.s AND c.day = t.d AND c.anomalous IS DISTINCT FROM t.a
                    """).execute(Tuple.tuple().addArrayOfString(s).addArrayOfLocalDate(d).addArrayOfBoolean(a))
                    .await().atMost(QUERY_TIMEOUT);
        }
    }

    @Override
    public void purge(LocalDate before) {
        Tuple args = Tuple.of(before);
        pool.get().withTransaction(conn -> conn.preparedQuery("DELETE FROM miot_symptoms.coverage_day WHERE day < $1")
                .execute(args)
                .flatMap(x -> conn.preparedQuery("DELETE FROM miot_symptoms.coverage_sender_day WHERE day < $1")
                        .execute(args))
                .flatMap(x -> conn.preparedQuery("DELETE FROM miot_symptoms.coverage_run WHERE day < $1")
                        .execute(args)))
                .await().atMost(QUERY_TIMEOUT);
    }
}
