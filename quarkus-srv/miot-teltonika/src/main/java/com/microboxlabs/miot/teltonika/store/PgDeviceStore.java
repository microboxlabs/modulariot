package com.microboxlabs.miot.teltonika.store;

import com.microboxlabs.miot.teltonika.device.Assignment;
import com.microboxlabs.miot.teltonika.device.Device;
import com.microboxlabs.miot.teltonika.device.DeviceStore;
import com.microboxlabs.miot.teltonika.device.RegisteredDevice;
import com.microboxlabs.miot.teltonika.inputs.InputMapping;
import io.quarkus.arc.properties.IfBuildProperty;
import io.vertx.mutiny.sqlclient.Pool;
import io.vertx.mutiny.sqlclient.Row;
import io.vertx.mutiny.sqlclient.Tuple;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.inject.Instance;
import jakarta.inject.Inject;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.function.Supplier;

/** {@link DeviceStore} on the modulith database, schema {@code miot_teltonika}. */
@ApplicationScoped
@IfBuildProperty(name = "miot.component.teltonika.enabled", stringValue = "true")
public class PgDeviceStore implements DeviceStore {

    private static final String DEVICE_COLUMNS = """
            imei, tenant_code, model, label, is_active, activation_code, activated_at, claim_expires_at,
            capture_until, created_at, created_by, updated_at, updated_by, config_profile_id, input_profile_id""";
    static final String MAPPING_COLUMNS =
            "profile_id, source, meaning, label, active_high, threshold_v, event_on, event_off";
    private static final String ASSIGNMENT_COLUMNS = "imei, asset_id, valid_from, valid_until, created_at, created_by";

    private final PgSupport pg;
    private final String device;
    private final String assignment;
    private final String mapping;

    @Inject
    PgDeviceStore(Instance<Pool> pool) {
        this(pool::get, PgSupport.DEFAULT_SCHEMA);
    }

    /** On {@code schema} instead of {@code miot_teltonika}: tests use a scratch schema. */
    public PgDeviceStore(Supplier<Pool> pool, String schema) {
        this.pg = new PgSupport(pool, schema);
        this.device = pg.table("device");
        this.assignment = pg.table("device_assignment");
        this.mapping = pg.table("input_mapping");
    }

    @Override
    public Optional<Device> find(String imei) {
        var it = pg.query("SELECT " + DEVICE_COLUMNS + " FROM " + device + " WHERE imei = $1", Tuple.of(imei))
                .iterator();
        return it.hasNext() ? Optional.of(device(it.next())) : Optional.empty();
    }

    @Override
    public List<Device> list(String tenantCode, Boolean active) {
        String sql = "SELECT " + DEVICE_COLUMNS + " FROM " + device + " WHERE tenant_code = $1"
                + (active == null ? "" : " AND is_active = " + active) + " ORDER BY imei";
        List<Device> out = new ArrayList<>();
        pg.query(sql, Tuple.of(tenantCode)).forEach(r -> out.add(device(r)));
        return out;
    }

    @Override
    public void register(Device d, String assetId, OffsetDateTime assignedFrom, String actor) {
        pg.inTransaction(client -> {
            PgSupport.query(client, "INSERT INTO " + device + " (" + DEVICE_COLUMNS + ") VALUES ($1, $2, $3, $4, $5,"
                    + " $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)", deviceTuple(d));
            PgSupport.query(client, "INSERT INTO " + assignment + " (imei, asset_id, valid_from, created_by)"
                    + " VALUES ($1, $2, $3, $4)", Tuple.of(d.imei(), assetId, assignedFrom, actor));
            return null;
        });
    }

    @Override
    public void deleteExpiredClaim(String imei) {
        pg.query("DELETE FROM " + device + " WHERE imei = $1 AND activated_at IS NULL AND claim_expires_at <= now()",
                Tuple.of(imei));
    }

    @Override
    public boolean update(Device d) {
        return pg.query("UPDATE " + device + " SET model = $2, label = $3, is_active = $4, activated_at = $5,"
                        + " capture_until = $6, updated_at = $7, updated_by = $8, config_profile_id = $9,"
                        + " input_profile_id = $10 WHERE imei = $1",
                Tuple.tuple().addString(d.imei()).addString(d.model()).addString(d.label())
                        .addBoolean(d.active()).addOffsetDateTime(d.activatedAt())
                        .addOffsetDateTime(d.captureUntil()).addOffsetDateTime(d.updatedAt())
                        .addString(d.updatedBy()).addUUID(d.configProfileId()).addUUID(d.inputProfileId()))
                .rowCount() > 0;
    }

    @Override
    public List<Assignment> assignments(String imei) {
        List<Assignment> out = new ArrayList<>();
        pg.query("SELECT " + ASSIGNMENT_COLUMNS + " FROM " + assignment + " WHERE imei = $1 ORDER BY valid_from DESC",
                Tuple.of(imei)).forEach(r -> out.add(assignment(r)));
        return out;
    }

    @Override
    public void reassign(String imei, String assetId, OffsetDateTime at, String actor) {
        pg.inTransaction(client -> {
            PgSupport.query(client, "UPDATE " + assignment + " SET valid_until = $2"
                    + " WHERE imei = $1 AND valid_until IS NULL", Tuple.of(imei, at));
            PgSupport.query(client, "INSERT INTO " + assignment + " (imei, asset_id, valid_from, created_by)"
                    + " VALUES ($1, $2, $3, $4)", Tuple.of(imei, assetId, at, actor));
            return null;
        });
    }

    @Override
    public void closeAssignment(String imei, OffsetDateTime at) {
        pg.query("UPDATE " + assignment + " SET valid_until = $2 WHERE imei = $1 AND valid_until IS NULL",
                Tuple.of(imei, at));
    }

    @Override
    public List<RegisteredDevice> activeDevices() {
        Map<String, List<Assignment>> byImei = new HashMap<>();
        pg.query("SELECT a.imei, a.asset_id, a.valid_from, a.valid_until, a.created_at, a.created_by FROM "
                        + assignment + " a JOIN " + device + " d ON d.imei = a.imei WHERE d.is_active", Tuple.tuple())
                .forEach(r -> byImei.computeIfAbsent(r.getString("imei"), k -> new ArrayList<>()).add(assignment(r)));
        Map<UUID, List<InputMapping>> byProfile = new HashMap<>();
        pg.query("SELECT " + MAPPING_COLUMNS + " FROM " + mapping + " WHERE profile_id IN (SELECT input_profile_id FROM "
                        + device + " WHERE is_active) ORDER BY source", Tuple.tuple())
                .forEach(r -> byProfile.computeIfAbsent(r.getUUID("profile_id"), k -> new ArrayList<>()).add(mapping(r)));
        List<RegisteredDevice> out = new ArrayList<>();
        pg.query("SELECT " + DEVICE_COLUMNS + " FROM " + device + " WHERE is_active", Tuple.tuple())
                .forEach(r -> {
                    Device d = device(r);
                    out.add(RegisteredDevice.of(d, byImei.getOrDefault(d.imei(), List.of()),
                            d.inputProfileId() == null ? List.of() : byProfile.getOrDefault(d.inputProfileId(), List.of())));
                });
        return out;
    }

    @Override
    public List<InputMapping> inputMappings(UUID inputProfileId) {
        if (inputProfileId == null) {
            return List.of();
        }
        List<InputMapping> out = new ArrayList<>();
        pg.query("SELECT " + MAPPING_COLUMNS + " FROM " + mapping + " WHERE profile_id = $1 ORDER BY source",
                Tuple.of(inputProfileId)).forEach(r -> out.add(mapping(r)));
        return out;
    }

    @Override
    public List<Device> pendingClaims() {
        List<Device> out = new ArrayList<>();
        pg.query("SELECT " + DEVICE_COLUMNS + " FROM " + device + " WHERE is_active AND activated_at IS NULL"
                + " ORDER BY created_at", Tuple.tuple()).forEach(r -> out.add(device(r)));
        return out;
    }

    /** Also used by the profile store. */
    static InputMapping mapping(Row r) {
        Double threshold = r.getDouble("threshold_v");
        return new InputMapping(r.getString("source"), r.getString("meaning"), r.getString("label"),
                r.getBoolean("active_high"), threshold, r.getBoolean("event_on"), r.getBoolean("event_off"));
    }

    private static Tuple deviceTuple(Device d) {
        return Tuple.tuple().addString(d.imei()).addString(d.tenantCode()).addString(d.model())
                .addString(d.label()).addBoolean(d.active()).addString(d.activationCode())
                .addOffsetDateTime(d.activatedAt()).addOffsetDateTime(d.claimExpiresAt())
                .addOffsetDateTime(d.captureUntil()).addOffsetDateTime(d.createdAt()).addString(d.createdBy())
                .addOffsetDateTime(d.updatedAt()).addString(d.updatedBy()).addUUID(d.configProfileId())
                .addUUID(d.inputProfileId());
    }

    private static Device device(Row r) {
        return new Device(r.getString("imei"), r.getString("tenant_code"), r.getString("model"),
                r.getString("label"), r.getBoolean("is_active"), r.getString("activation_code"),
                r.getOffsetDateTime("activated_at"), r.getOffsetDateTime("claim_expires_at"),
                r.getOffsetDateTime("capture_until"), r.getOffsetDateTime("created_at"), r.getString("created_by"),
                r.getOffsetDateTime("updated_at"), r.getString("updated_by"), r.getUUID("config_profile_id"),
                r.getUUID("input_profile_id"));
    }

    private static Assignment assignment(Row r) {
        return new Assignment(r.getString("imei"), r.getString("asset_id"), r.getOffsetDateTime("valid_from"),
                r.getOffsetDateTime("valid_until"), r.getOffsetDateTime("created_at"), r.getString("created_by"));
    }
}
