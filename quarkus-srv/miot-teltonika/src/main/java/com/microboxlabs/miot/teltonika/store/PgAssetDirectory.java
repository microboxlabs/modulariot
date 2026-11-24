package com.microboxlabs.miot.teltonika.store;

import com.microboxlabs.miot.teltonika.device.AssetDirectory;
import io.quarkus.arc.properties.IfBuildProperty;
import io.vertx.mutiny.sqlclient.Pool;
import io.vertx.mutiny.sqlclient.Row;
import io.vertx.mutiny.sqlclient.Tuple;
import io.vertx.pgclient.PgException;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.inject.Instance;
import jakarta.inject.Inject;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.function.Supplier;
import org.jboss.logging.Logger;

/**
 * {@link AssetDirectory} on the tracking component's asset sharing table
 * ({@code miot_tracking.asset_client_map}, the one that decides which client sees each asset): an
 * asset actively mapped to other clients and not to this one is refused. Read only. When the
 * tracking schema is not in this database every asset is allowed, and that is logged once.
 */
@ApplicationScoped
@IfBuildProperty(name = "miot.component.teltonika.enabled", stringValue = "true")
public class PgAssetDirectory implements AssetDirectory {

    private static final Logger LOG = Logger.getLogger(PgAssetDirectory.class);
    private static final String UNDEFINED_TABLE = "42P01";

    private final Supplier<Pool> pool;
    private final String table;
    private final AtomicBoolean warned = new AtomicBoolean();

    @Inject
    PgAssetDirectory(Instance<Pool> pool) {
        this(pool::get, "miot_tracking.asset_client_map");
    }

    public PgAssetDirectory(Supplier<Pool> pool, String table) {
        this.pool = pool;
        this.table = table;
    }

    @Override
    public boolean mayAssign(String tenantCode, String assetId) {
        try {
            Row r = PgSupport.query(pool.get(), "SELECT count(*) AS mapped,"
                            + " count(*) FILTER (WHERE shared_client_id = $1) AS own FROM " + table
                            + " WHERE asset_id = $2 AND active AND (valid_to IS NULL OR valid_to > now())",
                    Tuple.of(tenantCode, assetId)).iterator().next();
            return r.getLong("mapped") == 0 || r.getLong("own") > 0;
        } catch (PgException e) {
            if (UNDEFINED_TABLE.equals(e.getSqlState())) {
                if (warned.compareAndSet(false, true)) {
                    LOG.warnf("%s not found: assets are not checked against other organizations", table);
                }
                return true;
            }
            throw e;
        }
    }
}
