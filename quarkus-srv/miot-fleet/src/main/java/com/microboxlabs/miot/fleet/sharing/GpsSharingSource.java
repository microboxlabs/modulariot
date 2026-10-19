package com.microboxlabs.miot.fleet.sharing;

import io.vertx.mutiny.sqlclient.Pool;
import io.vertx.mutiny.sqlclient.Row;
import io.vertx.mutiny.sqlclient.RowSet;
import io.vertx.mutiny.sqlclient.Tuple;
import java.time.Duration;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.function.Supplier;
import java.util.stream.Collectors;
import java.util.stream.Stream;
import java.util.stream.StreamSupport;

/**
 * Organizations from the modulith database; their assets from the GPS database, read only. An organization's assets
 * are those whose last signal came from its client: {@code last_signal_data} keeps one row per asset.
 */
public class GpsSharingSource implements SharingSource {

    private static final Duration QUERY_TIMEOUT = Duration.ofSeconds(30);

    private static final String ORGANIZATIONS = """
            SELECT slug, coalesce(nullif(trim(display_name), ''), name) AS name, tenant_client_id
            FROM miot_core.organizations
            WHERE active
            ORDER BY 2""";

    private static final String COUNTS = """
            SELECT client_id, count(*)::int AS n FROM public.last_signal_data
            WHERE client_id = ANY($1)
            GROUP BY client_id""";

    private static final String OPERATORS = """
            SELECT c AS client_id FROM unnest($1::text[]) c
            WHERE EXISTS (SELECT 1 FROM public.live_trip t WHERE t.created_by_client_id = c)""";

    private static final String ASSETS = """
            SELECT asset_id, type, owner, "timestamp" FROM public.last_signal_data
            WHERE client_id = $1
            ORDER BY asset_id""";

    private final Supplier<Pool> modulith;
    private final Supplier<Pool> gps;

    public GpsSharingSource(Supplier<Pool> modulith, Supplier<Pool> gps) {
        this.modulith = modulith;
        this.gps = gps;
    }

    @Override
    public List<SharingOrg.Ref> organizations() {
        return rows(query(modulith, ORGANIZATIONS, Tuple.tuple()))
                .map(r -> new SharingOrg.Ref(r.getString("slug"), r.getString("name"), r.getString("tenant_client_id")))
                .toList();
    }

    @Override
    public Map<String, Integer> assetCounts(Set<String> clientIds) {
        if (clientIds.isEmpty()) {
            return Map.of();
        }
        return rows(query(gps, COUNTS, Tuple.of(clientIds.toArray(String[]::new))))
                .collect(Collectors.toMap(r -> r.getString("client_id"), r -> r.getInteger("n")));
    }

    @Override
    public Set<String> operators(Set<String> clientIds) {
        if (clientIds.isEmpty()) {
            return Set.of();
        }
        return rows(query(gps, OPERATORS, Tuple.of(clientIds.toArray(String[]::new))))
                .map(r -> r.getString("client_id")).collect(Collectors.toSet());
    }

    @Override
    public List<SharingAsset> assets(String clientId) {
        return rows(query(gps, ASSETS, Tuple.of(clientId)))
                .map(r -> new SharingAsset(r.getString("asset_id"), r.getString("type"), r.getString("owner"),
                        instant(r.getOffsetDateTime("timestamp"))))
                .toList();
    }

    private static Stream<Row> rows(RowSet<Row> rows) {
        return StreamSupport.stream(rows.spliterator(), false);
    }

    private static Instant instant(OffsetDateTime at) {
        return at == null ? null : at.toInstant();
    }

    private static RowSet<Row> query(Supplier<Pool> pool, String sql, Tuple params) {
        return pool.get().preparedQuery(sql).execute(params).await().atMost(QUERY_TIMEOUT);
    }
}
