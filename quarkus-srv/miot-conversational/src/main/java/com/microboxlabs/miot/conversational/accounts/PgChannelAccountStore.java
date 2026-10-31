package com.microboxlabs.miot.conversational.accounts;

import io.vertx.mutiny.sqlclient.Pool;
import io.vertx.mutiny.sqlclient.Row;
import io.vertx.mutiny.sqlclient.RowSet;
import io.vertx.mutiny.sqlclient.Tuple;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.inject.Instance;
import jakarta.inject.Inject;
import java.time.OffsetDateTime;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.function.Supplier;

/** {@link ChannelAccountStore} on {@code miot_conversational.conv_channel_account}. */
@ApplicationScoped
public class PgChannelAccountStore implements ChannelAccountStore {

    private static final String FIND = """
            SELECT channel, mode, updated_by, updated_at FROM miot_conversational.conv_channel_account
            WHERE tenant_code = $1""";
    private static final String SAVE = """
            INSERT INTO miot_conversational.conv_channel_account (tenant_code, channel, mode, updated_by, updated_at)
            VALUES ($1, $2, $3, $4, now())
            ON CONFLICT (tenant_code, channel) DO UPDATE SET
                mode = EXCLUDED.mode, updated_by = EXCLUDED.updated_by, updated_at = EXCLUDED.updated_at
            RETURNING channel, mode, updated_by, updated_at""";

    private final Supplier<Pool> pool;

    @Inject
    PgChannelAccountStore(Instance<Pool> pool) {
        this.pool = pool::get;
    }

    @Override
    public Map<String, ChannelAccountsService.Setting> find(String tenantCode) {
        Map<String, ChannelAccountsService.Setting> out = new LinkedHashMap<>();
        query(FIND, Tuple.of(tenantCode)).forEach(r -> out.put(r.getString("channel"), setting(r)));
        return out;
    }

    @Override
    public ChannelAccountsService.Setting save(String tenantCode, String channel, ChannelMode mode,
            String updatedBy) {
        return setting(query(SAVE, Tuple.of(tenantCode, channel, mode.name(), updatedBy)).iterator().next());
    }

    private RowSet<Row> query(String sql, Tuple params) {
        return pool.get().preparedQuery(sql).execute(params).await().indefinitely();
    }

    private static ChannelAccountsService.Setting setting(Row r) {
        OffsetDateTime at = r.getOffsetDateTime("updated_at");
        return new ChannelAccountsService.Setting(ChannelMode.valueOf(r.getString("mode")),
                r.getString("updated_by"), at == null ? null : at.toInstant());
    }
}
