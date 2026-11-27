package com.microboxlabs.miot.teltonika.store;

import com.microboxlabs.miot.teltonika.catalog.DeviceModel;
import com.microboxlabs.miot.teltonika.catalog.ModelCatalog;
import io.quarkus.arc.properties.IfBuildProperty;
import io.vertx.mutiny.sqlclient.Pool;
import io.vertx.mutiny.sqlclient.Tuple;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.inject.Instance;
import jakarta.inject.Inject;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.function.Supplier;

/**
 * {@link ModelCatalog} read from {@code miot_teltonika.device_model}. The table only changes with a
 * migration, so it is read on first use and kept; a failed read is retried on the next call.
 */
@ApplicationScoped
@IfBuildProperty(name = "miot.component.teltonika.enabled", stringValue = "true")
public class PgModelCatalog implements ModelCatalog {

    private final PgSupport pg;
    private final String table;
    private volatile ModelCatalog loaded;

    @Inject
    PgModelCatalog(Instance<Pool> pool) {
        this(pool::get, PgSupport.DEFAULT_SCHEMA);
    }

    public PgModelCatalog(Supplier<Pool> pool, String schema) {
        this.pg = new PgSupport(pool, schema);
        this.table = pg.table("device_model");
    }

    @Override
    public List<DeviceModel> all() {
        return catalog().all();
    }

    @Override
    public Optional<DeviceModel> find(String code) {
        return catalog().find(code);
    }

    private ModelCatalog catalog() {
        ModelCatalog c = loaded;
        if (c == null) {
            List<DeviceModel> models = new ArrayList<>();
            pg.query("SELECT code, brand, model, protocol, via, traccar_port, guide_family, verified, notes FROM "
                    + table, Tuple.tuple()).forEach(r -> models.add(new DeviceModel(r.getString("code"),
                    r.getString("brand"), r.getString("model"), r.getString("protocol"), r.getString("via"),
                    r.getInteger("traccar_port"), r.getString("guide_family"), r.getBoolean("verified"),
                    r.getString("notes"))));
            c = ModelCatalog.of(models);
            loaded = c;
        }
        return c;
    }
}
