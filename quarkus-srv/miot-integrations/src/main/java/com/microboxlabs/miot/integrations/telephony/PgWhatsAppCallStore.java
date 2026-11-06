package com.microboxlabs.miot.integrations.telephony;

import com.microboxlabs.miot.integrations.persistence.ManagedProvisioningTransaction;
import io.vertx.mutiny.sqlclient.Pool;
import io.vertx.mutiny.sqlclient.Row;
import io.vertx.mutiny.sqlclient.RowSet;
import io.vertx.mutiny.sqlclient.Tuple;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.inject.Instance;
import jakarta.inject.Inject;
import java.time.Duration;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import java.util.function.Supplier;

/** {@link WhatsAppCallStore} on {@code miot_integrations}. */
@ApplicationScoped
public class PgWhatsAppCallStore implements WhatsAppCallStore {

    private static final Duration TIMEOUT = Duration.ofSeconds(10);
    private static final String LEGS = "miot_integrations.telephony_whatsapp_legs";
    private static final String INBOUND = "miot_integrations.whatsapp_inbound_calls";
    private static final String COLUMNS = """
            id, connection_id, call_control_id, tenant_code, caller_number, caller_name, case_ref, status, call_ref,
            created_at, updated_at""";
    private static final String SELECT = "SELECT " + COLUMNS + " FROM " + INBOUND + " ";

    private final Supplier<Pool> pool;

    @Inject
    public PgWhatsAppCallStore(Instance<Pool> pool) {
        this(pool::get);
    }

    public PgWhatsAppCallStore(Supplier<Pool> pool) {
        this.pool = pool;
    }

    @Override
    public void saveLeg(String callRef, String legCallId) {
        run("INSERT INTO " + LEGS + " (call_ref, leg_call_id) VALUES ($1, $2) ON CONFLICT (call_ref)"
                + " DO UPDATE SET leg_call_id = EXCLUDED.leg_call_id, updated_at = now()",
                Tuple.of(UUID.fromString(callRef), legCallId));
    }

    @Override
    public Optional<String> leg(String callRef) {
        return text("SELECT leg_call_id AS v FROM " + LEGS + " WHERE call_ref = $1", callRef);
    }

    @Override
    public void saveFailure(String callRef, String failure) {
        run("INSERT INTO " + LEGS + " (call_ref, failure) VALUES ($1, $2) ON CONFLICT (call_ref)"
                + " DO UPDATE SET failure = EXCLUDED.failure, updated_at = now()",
                Tuple.of(UUID.fromString(callRef), failure));
    }

    @Override
    public Optional<String> failure(String callRef) {
        return text("SELECT failure AS v FROM " + LEGS + " WHERE call_ref = $1", callRef);
    }

    @Override
    public void insertInbound(InboundWhatsAppCall c) {
        run("INSERT INTO " + INBOUND + " (" + COLUMNS + ") VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)"
                + " ON CONFLICT (call_control_id) DO NOTHING", params(c));
    }

    @Override
    public void updateInbound(InboundWhatsAppCall c) {
        run("UPDATE " + INBOUND + " SET connection_id = $2, call_control_id = $3, tenant_code = $4,"
                + " caller_number = $5, caller_name = $6, case_ref = $7, status = $8, call_ref = $9,"
                + " created_at = $10, updated_at = $11 WHERE id = $1", params(c));
    }

    @Override
    public Optional<InboundWhatsAppCall> inbound(String id) {
        UUID uuid = uuid(id);
        return uuid == null ? Optional.empty() : first(run(SELECT + "WHERE id = $1", Tuple.of(uuid)));
    }

    @Override
    public Optional<InboundWhatsAppCall> inboundByCallControl(String callControlId) {
        return first(run(SELECT + "WHERE call_control_id = $1", Tuple.of(callControlId)));
    }

    @Override
    public Optional<InboundWhatsAppCall> inboundByCallRef(String callRef) {
        UUID uuid = uuid(callRef);
        return uuid == null ? Optional.empty() : first(run(SELECT + "WHERE call_ref = $1", Tuple.of(uuid)));
    }

    @Override
    public List<InboundWhatsAppCall> ringing(String tenantCode) {
        return all(run(SELECT + "WHERE status = 'RINGING' AND tenant_code = $1 ORDER BY created_at",
                Tuple.of(tenantCode)));
    }

    @Override
    public List<InboundWhatsAppCall> ringingBefore(Instant before) {
        return all(run(SELECT + "WHERE status = 'RINGING' AND created_at < $1 ORDER BY created_at",
                Tuple.of(utc(before))));
    }

    protected RowSet<Row> run(String sql, Tuple params) {
        return ManagedProvisioningTransaction.client(pool.get()).preparedQuery(sql).execute(params).await()
                .atMost(TIMEOUT);
    }

    private Optional<String> text(String sql, String callRef) {
        UUID uuid = uuid(callRef);
        if (uuid == null) return Optional.empty();
        var it = run(sql, Tuple.of(uuid)).iterator();
        return it.hasNext() ? Optional.ofNullable(it.next().getString("v")) : Optional.empty();
    }

    private static Tuple params(InboundWhatsAppCall c) {
        return Tuple.tuple().addUUID(UUID.fromString(c.id())).addString(c.connectionId()).addString(c.callControlId())
                .addString(c.tenantCode()).addString(c.callerNumber()).addString(c.callerName())
                .addString(c.caseRef()).addString(c.status()).addUUID(c.callRef() == null ? null : UUID.fromString(c.callRef()))
                .addOffsetDateTime(utc(c.createdAt())).addOffsetDateTime(utc(c.updatedAt()));
    }

    private static List<InboundWhatsAppCall> all(RowSet<Row> rows) {
        List<InboundWhatsAppCall> out = new ArrayList<>();
        rows.forEach(r -> out.add(row(r)));
        return out;
    }

    private static Optional<InboundWhatsAppCall> first(RowSet<Row> rows) {
        var it = rows.iterator();
        return it.hasNext() ? Optional.of(row(it.next())) : Optional.empty();
    }

    private static InboundWhatsAppCall row(Row r) {
        UUID callRef = r.getUUID("call_ref");
        return new InboundWhatsAppCall(r.getUUID("id").toString(), r.getString("connection_id"),
                r.getString("call_control_id"), r.getString("tenant_code"), r.getString("caller_number"),
                r.getString("caller_name"), r.getString("case_ref"), r.getString("status"),
                callRef == null ? null : callRef.toString(), instant(r.getOffsetDateTime("created_at")),
                instant(r.getOffsetDateTime("updated_at")));
    }

    private static OffsetDateTime utc(Instant at) {
        return at == null ? null : at.atOffset(ZoneOffset.UTC);
    }

    private static Instant instant(OffsetDateTime at) {
        return at == null ? null : at.toInstant();
    }

    private static UUID uuid(String id) {
        try {
            return id == null ? null : UUID.fromString(id);
        } catch (IllegalArgumentException e) {
            return null;
        }
    }
}
