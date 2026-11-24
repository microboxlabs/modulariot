package com.microboxlabs.miot.teltonika.store;

import com.microboxlabs.miot.teltonika.command.CommandStore;
import com.microboxlabs.miot.teltonika.command.DeviceCommand;
import com.microboxlabs.miot.teltonika.command.IntensiveTracking;
import io.quarkus.arc.properties.IfBuildProperty;
import io.vertx.mutiny.sqlclient.Pool;
import io.vertx.mutiny.sqlclient.Row;
import io.vertx.mutiny.sqlclient.Tuple;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.inject.Instance;
import jakarta.inject.Inject;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import java.util.function.Supplier;

/** {@link CommandStore} on the modulith database, schema {@code miot_teltonika}. */
@ApplicationScoped
@IfBuildProperty(name = "miot.component.teltonika.enabled", stringValue = "true")
public class PgCommandStore implements CommandStore {

    private static final String COLUMNS = """
            id, imei, tenant_code, command, purpose, status, response, requested_by, requested_at, sent_at,
            answered_at, expires_at""";

    private final PgSupport pg;
    private final String command;
    private final String intensive;

    @Inject
    PgCommandStore(Instance<Pool> pool) {
        this(pool::get, PgSupport.DEFAULT_SCHEMA);
    }

    public PgCommandStore(Supplier<Pool> pool, String schema) {
        this.pg = new PgSupport(pool, schema);
        this.command = pg.table("device_command");
        this.intensive = pg.table("intensive_tracking");
    }

    @Override
    public void insert(DeviceCommand c) {
        pg.query("INSERT INTO " + command + " (" + COLUMNS + ") VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10,"
                        + " $11, $12)",
                Tuple.tuple().addUUID(c.id()).addString(c.imei()).addString(c.tenantCode()).addString(c.command())
                        .addString(c.purpose()).addString(c.status()).addString(c.response())
                        .addString(c.requestedBy()).addOffsetDateTime(c.requestedAt())
                        .addOffsetDateTime(c.sentAt()).addOffsetDateTime(c.answeredAt())
                        .addOffsetDateTime(c.expiresAt()));
    }

    @Override
    public Optional<DeviceCommand> find(UUID id) {
        var it = pg.query("SELECT " + COLUMNS + " FROM " + command + " WHERE id = $1", Tuple.of(id)).iterator();
        return it.hasNext() ? Optional.of(command(it.next())) : Optional.empty();
    }

    @Override
    public List<DeviceCommand> list(String imei, int limit) {
        List<DeviceCommand> out = new ArrayList<>();
        pg.query("SELECT " + COLUMNS + " FROM " + command + " WHERE imei = $1 ORDER BY seq DESC LIMIT $2",
                Tuple.of(imei, limit)).forEach(r -> out.add(command(r)));
        return out;
    }

    @Override
    public List<DeviceCommand> pending(Collection<String> imeis, OffsetDateTime now, int limit) {
        List<DeviceCommand> out = new ArrayList<>();
        if (imeis.isEmpty()) {
            return out;
        }
        pg.query("SELECT " + COLUMNS + " FROM " + command + " WHERE status = 'pending' AND imei = ANY($1)"
                        + " AND expires_at > $2 ORDER BY seq LIMIT $3",
                Tuple.of(imeis.toArray(String[]::new), now, limit)).forEach(r -> out.add(command(r)));
        return out;
    }

    @Override
    public boolean hasOpen(String imei, String purpose) {
        return pg.query("SELECT 1 FROM " + command + " WHERE imei = $1 AND purpose = $2"
                + " AND status IN ('pending', 'sent') LIMIT 1", Tuple.of(imei, purpose)).iterator().hasNext();
    }

    @Override
    public boolean markSent(UUID id, OffsetDateTime at) {
        return pg.query("UPDATE " + command + " SET status = 'sent', sent_at = $2 WHERE id = $1 AND status = 'pending'",
                Tuple.of(id, at)).rowCount() > 0;
    }

    @Override
    public void release(UUID id) {
        pg.query("UPDATE " + command + " SET status = 'pending', sent_at = NULL WHERE id = $1 AND status = 'sent'",
                Tuple.of(id));
    }

    @Override
    public void markAnswered(UUID id, String response, OffsetDateTime at) {
        pg.query("UPDATE " + command + " SET status = 'answered', response = $2, answered_at = $3 WHERE id = $1",
                Tuple.of(id, response, at));
    }

    @Override
    public void markFailed(UUID id, String reason, OffsetDateTime at) {
        pg.query("UPDATE " + command + " SET status = 'failed', response = $2, answered_at = $3"
                + " WHERE id = $1 AND status IN ('pending', 'sent')", Tuple.of(id, reason, at));
    }

    @Override
    public int expire(OffsetDateTime now) {
        return pg.query("UPDATE " + command + " SET status = 'expired' WHERE status = 'pending' AND expires_at <= $1",
                Tuple.of(now)).rowCount();
    }

    @Override
    public void saveIntensive(IntensiveTracking t) {
        pg.query("INSERT INTO " + intensive + " (imei, tenant_code, started_at, until, reason, requested_by,"
                        + " previous_params, ended_at, restored_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)"
                        + " ON CONFLICT (imei) DO UPDATE SET tenant_code = EXCLUDED.tenant_code,"
                        + " started_at = EXCLUDED.started_at, until = EXCLUDED.until, reason = EXCLUDED.reason,"
                        + " requested_by = EXCLUDED.requested_by, previous_params = EXCLUDED.previous_params,"
                        + " ended_at = EXCLUDED.ended_at, restored_at = EXCLUDED.restored_at",
                Tuple.tuple().addString(t.imei()).addString(t.tenantCode()).addOffsetDateTime(t.startedAt())
                        .addOffsetDateTime(t.until()).addString(t.reason()).addString(t.requestedBy())
                        .addString(t.previousParams()).addOffsetDateTime(t.endedAt())
                        .addOffsetDateTime(t.restoredAt()));
    }

    @Override
    public Optional<IntensiveTracking> intensive(String imei) {
        var it = pg.query("SELECT * FROM " + intensive + " WHERE imei = $1", Tuple.of(imei)).iterator();
        return it.hasNext() ? Optional.of(intensive(it.next())) : Optional.empty();
    }

    @Override
    public List<IntensiveTracking> dueIntensive(OffsetDateTime now) {
        List<IntensiveTracking> out = new ArrayList<>();
        pg.query("SELECT * FROM " + intensive + " WHERE ended_at IS NULL AND until <= $1", Tuple.of(now))
                .forEach(r -> out.add(intensive(r)));
        return out;
    }

    @Override
    public boolean endIntensive(String imei, OffsetDateTime at) {
        return pg.query("UPDATE " + intensive + " SET ended_at = $2 WHERE imei = $1 AND ended_at IS NULL",
                Tuple.of(imei, at)).rowCount() > 0;
    }

    @Override
    public void addPreviousParam(String imei, int paramId, String value) {
        pg.query("UPDATE " + intensive + " SET previous_params = CASE WHEN previous_params IS NULL OR previous_params = ''"
                + " THEN $2 ELSE previous_params || ';' || $2 END WHERE imei = $1",
                Tuple.of(imei, paramId + ":" + value));
    }

    @Override
    public void markRestored(String imei, OffsetDateTime at) {
        pg.query("UPDATE " + intensive + " SET restored_at = $2 WHERE imei = $1 AND restored_at IS NULL",
                Tuple.of(imei, at));
    }

    @Override
    public List<IntensiveTracking> unrestored() {
        List<IntensiveTracking> out = new ArrayList<>();
        pg.query("SELECT * FROM " + intensive + " WHERE ended_at IS NOT NULL AND restored_at IS NULL", Tuple.tuple())
                .forEach(r -> out.add(intensive(r)));
        return out;
    }

    private static DeviceCommand command(Row r) {
        return new DeviceCommand(r.getUUID("id"), r.getString("imei"), r.getString("tenant_code"),
                r.getString("command"), r.getString("purpose"), r.getString("status"), r.getString("response"),
                r.getString("requested_by"), r.getOffsetDateTime("requested_at"), r.getOffsetDateTime("sent_at"),
                r.getOffsetDateTime("answered_at"), r.getOffsetDateTime("expires_at"));
    }

    private static IntensiveTracking intensive(Row r) {
        return new IntensiveTracking(r.getString("imei"), r.getString("tenant_code"),
                r.getOffsetDateTime("started_at"), r.getOffsetDateTime("until"), r.getString("reason"),
                r.getString("requested_by"), r.getString("previous_params"), r.getOffsetDateTime("ended_at"),
                r.getOffsetDateTime("restored_at"));
    }
}
