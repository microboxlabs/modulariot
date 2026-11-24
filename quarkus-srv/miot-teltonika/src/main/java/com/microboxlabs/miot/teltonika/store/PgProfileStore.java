package com.microboxlabs.miot.teltonika.store;

import com.microboxlabs.miot.teltonika.inputs.InputMapping;
import com.microboxlabs.miot.teltonika.inputs.InputProfile;
import com.microboxlabs.miot.teltonika.profile.ConfigProfile;
import com.microboxlabs.miot.teltonika.profile.ProfileStore;
import io.quarkus.arc.properties.IfBuildProperty;
import io.vertx.mutiny.sqlclient.Pool;
import io.vertx.mutiny.sqlclient.Row;
import io.vertx.mutiny.sqlclient.Tuple;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.inject.Instance;
import jakarta.inject.Inject;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.function.Supplier;

/** {@link ProfileStore} on the modulith database, schema {@code miot_teltonika}. */
@ApplicationScoped
@IfBuildProperty(name = "miot.component.teltonika.enabled", stringValue = "true")
public class PgProfileStore implements ProfileStore {

    private static final String CONFIG_COLUMNS =
            "id, tenant_code, name, description, guide_family, params, created_at, created_by, updated_at, updated_by";
    private static final String INPUT_COLUMNS =
            "id, tenant_code, name, description, created_at, created_by, updated_at, updated_by";

    private final PgSupport pg;
    private final String config;
    private final String input;
    private final String mapping;
    private final String device;

    @Inject
    PgProfileStore(Instance<Pool> pool) {
        this(pool::get, PgSupport.DEFAULT_SCHEMA);
    }

    public PgProfileStore(Supplier<Pool> pool, String schema) {
        this.pg = new PgSupport(pool, schema);
        this.config = pg.table("config_profile");
        this.input = pg.table("input_profile");
        this.mapping = pg.table("input_mapping");
        this.device = pg.table("device");
    }

    @Override
    public List<ConfigProfile> configProfiles(String tenantCode) {
        List<ConfigProfile> out = new ArrayList<>();
        pg.query("SELECT " + CONFIG_COLUMNS + " FROM " + config + " WHERE tenant_code = $1 ORDER BY name",
                Tuple.of(tenantCode)).forEach(r -> out.add(config(r)));
        return out;
    }

    @Override
    public Optional<ConfigProfile> configProfile(UUID id) {
        var it = pg.query("SELECT " + CONFIG_COLUMNS + " FROM " + config + " WHERE id = $1", Tuple.of(id)).iterator();
        return it.hasNext() ? Optional.of(config(it.next())) : Optional.empty();
    }

    @Override
    public void saveConfig(ConfigProfile p) {
        pg.query("INSERT INTO " + config + " (" + CONFIG_COLUMNS + ") VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)"
                        + " ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, description = EXCLUDED.description,"
                        + " guide_family = EXCLUDED.guide_family, params = EXCLUDED.params,"
                        + " updated_at = EXCLUDED.updated_at, updated_by = EXCLUDED.updated_by",
                Tuple.tuple().addUUID(p.id()).addString(p.tenantCode()).addString(p.name()).addString(p.description())
                        .addString(p.guideFamily()).addString(p.encoded()).addOffsetDateTime(p.createdAt())
                        .addString(p.createdBy()).addOffsetDateTime(p.updatedAt()).addString(p.updatedBy()));
    }

    @Override
    public boolean deleteConfig(String tenantCode, UUID id) {
        return pg.query("DELETE FROM " + config + " WHERE id = $1 AND tenant_code = $2", Tuple.of(id, tenantCode))
                .rowCount() > 0;
    }

    @Override
    public List<InputProfile> inputProfiles(String tenantCode) {
        Map<UUID, List<InputMapping>> mappings = new HashMap<>();
        pg.query("SELECT m." + PgDeviceStore.MAPPING_COLUMNS.replace(", ", ", m.") + " FROM " + mapping + " m JOIN "
                        + input + " p ON p.id = m.profile_id WHERE p.tenant_code = $1 ORDER BY m.source",
                Tuple.of(tenantCode))
                .forEach(r -> mappings.computeIfAbsent(r.getUUID("profile_id"), k -> new ArrayList<>())
                        .add(PgDeviceStore.mapping(r)));
        List<InputProfile> out = new ArrayList<>();
        pg.query("SELECT " + INPUT_COLUMNS + " FROM " + input + " WHERE tenant_code = $1 ORDER BY name",
                Tuple.of(tenantCode)).forEach(r -> out.add(input(r, mappings.getOrDefault(r.getUUID("id"), List.of()))));
        return out;
    }

    @Override
    public Optional<InputProfile> inputProfile(UUID id) {
        var it = pg.query("SELECT " + INPUT_COLUMNS + " FROM " + input + " WHERE id = $1", Tuple.of(id)).iterator();
        if (!it.hasNext()) {
            return Optional.empty();
        }
        Row r = it.next();
        List<InputMapping> mappings = new ArrayList<>();
        pg.query("SELECT " + PgDeviceStore.MAPPING_COLUMNS + " FROM " + mapping + " WHERE profile_id = $1"
                + " ORDER BY source", Tuple.of(id)).forEach(m -> mappings.add(PgDeviceStore.mapping(m)));
        return Optional.of(input(r, mappings));
    }

    @Override
    public void saveInput(InputProfile p) {
        pg.inTransaction(client -> {
            PgSupport.query(client, "INSERT INTO " + input + " (" + INPUT_COLUMNS + ") VALUES ($1, $2, $3, $4, $5, $6,"
                            + " $7, $8) ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name,"
                            + " description = EXCLUDED.description, updated_at = EXCLUDED.updated_at,"
                            + " updated_by = EXCLUDED.updated_by",
                    Tuple.tuple().addUUID(p.id()).addString(p.tenantCode()).addString(p.name())
                            .addString(p.description()).addOffsetDateTime(p.createdAt()).addString(p.createdBy())
                            .addOffsetDateTime(p.updatedAt()).addString(p.updatedBy()));
            PgSupport.query(client, "DELETE FROM " + mapping + " WHERE profile_id = $1", Tuple.of(p.id()));
            for (InputMapping m : p.mappings()) {
                PgSupport.query(client, "INSERT INTO " + mapping + " (" + PgDeviceStore.MAPPING_COLUMNS + ")"
                                + " VALUES ($1, $2, $3, $4, $5, $6, $7, $8)",
                        Tuple.tuple().addUUID(p.id()).addString(m.source()).addString(m.meaning())
                                .addString(m.label()).addBoolean(m.activeHigh()).addDouble(m.thresholdV())
                                .addBoolean(m.eventOn()).addBoolean(m.eventOff()));
            }
            return null;
        });
    }

    @Override
    public boolean deleteInput(String tenantCode, UUID id) {
        return pg.query("DELETE FROM " + input + " WHERE id = $1 AND tenant_code = $2", Tuple.of(id, tenantCode))
                .rowCount() > 0;
    }

    @Override
    public int devicesUsing(UUID profileId) {
        return pg.query("SELECT count(*) AS n FROM " + device + " WHERE config_profile_id = $1 OR input_profile_id = $1",
                Tuple.of(profileId)).iterator().next().getInteger("n");
    }

    private static ConfigProfile config(Row r) {
        return new ConfigProfile(r.getUUID("id"), r.getString("tenant_code"), r.getString("name"),
                r.getString("description"), r.getString("guide_family"), ConfigProfile.decode(r.getString("params")),
                r.getOffsetDateTime("created_at"), r.getString("created_by"), r.getOffsetDateTime("updated_at"),
                r.getString("updated_by"));
    }

    private static InputProfile input(Row r, List<InputMapping> mappings) {
        return new InputProfile(r.getUUID("id"), r.getString("tenant_code"), r.getString("name"),
                r.getString("description"), mappings, r.getOffsetDateTime("created_at"), r.getString("created_by"),
                r.getOffsetDateTime("updated_at"), r.getString("updated_by"));
    }
}
