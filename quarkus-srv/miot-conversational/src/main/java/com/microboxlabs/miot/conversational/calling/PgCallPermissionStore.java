package com.microboxlabs.miot.conversational.calling;

import com.microboxlabs.miot.integrations.service.ManagedConnectionLock;
import com.microboxlabs.miot.integrations.persistence.ManagedProvisioningTransaction;
import io.vertx.mutiny.sqlclient.Pool;
import io.vertx.mutiny.sqlclient.Row;
import io.vertx.mutiny.sqlclient.RowSet;
import io.vertx.mutiny.sqlclient.Tuple;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.inject.Instance;
import jakarta.inject.Inject;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import java.util.function.Supplier;

/** {@link CallPermissionStore} on {@code conv_call_permission} and {@code conv_call_permission_request}. */
@ApplicationScoped
public class PgCallPermissionStore implements CallPermissionStore {

    private static final String FIND = """
            SELECT business_phone_number_id, contact_e164, status, expires_at, responded_at, response_source,
                   consecutive_unanswered, last_connected_call_at
            FROM miot_conversational.conv_call_permission
            WHERE business_phone_number_id = $1 AND contact_e164 = $2""";
    private static final String SAVE = """
            INSERT INTO miot_conversational.conv_call_permission
                (business_phone_number_id, contact_e164, status, expires_at, responded_at, response_source,
                 consecutive_unanswered, last_connected_call_at, updated_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, now())
            ON CONFLICT (business_phone_number_id, contact_e164) DO UPDATE SET
                status = EXCLUDED.status, expires_at = EXCLUDED.expires_at, responded_at = EXCLUDED.responded_at,
                response_source = EXCLUDED.response_source,
                consecutive_unanswered = EXCLUDED.consecutive_unanswered,
                last_connected_call_at = EXCLUDED.last_connected_call_at, updated_at = now()""";
    private static final String REQUESTS = """
            SELECT sent_at FROM miot_conversational.conv_call_permission_request
            WHERE business_phone_number_id = $1 AND contact_e164 = $2 AND sent_at >= $3
            ORDER BY sent_at""";
    private static final String RECORD = """
            INSERT INTO miot_conversational.conv_call_permission_request
                (id, tenant_code, business_phone_number_id, contact_e164, origin, wamid, requested_by, sent_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8) ON CONFLICT DO NOTHING""";

    private static final ThreadLocal<java.util.Set<String>> HELD = ThreadLocal.withInitial(java.util.HashSet::new);
    private final Supplier<Pool> pool;
    private final ManagedConnectionLock lock;

    @Inject
    PgCallPermissionStore(Instance<Pool> pool, ManagedConnectionLock lock) {
        this(pool::get, lock);
    }

    public PgCallPermissionStore(Supplier<Pool> pool, ManagedConnectionLock lock) {
        this.pool = pool;
        this.lock = lock;
    }

    @Override
    public <T> T locked(String number, String contact, Supplier<T> work) {
        String key = "wa-call:" + number + ":" + contact;
        try {
            if (HELD.get().contains(key)) return work.get();
            return lock.locked(key, () -> {
                // ManagedConnectionLock executes work on a worker thread, so read its value here.
                HELD.get().add(key);
                try { return work.get(); }
                finally {
                    HELD.get().remove(key);
                    if (HELD.get().isEmpty()) HELD.remove();
                }
            });
        } finally {
            // Also release the caller's empty value if acquiring the database lock fails.
            if (HELD.get().isEmpty()) HELD.remove();
        }
    }

    @Override
    public CallPermission checkpoint(String number, String contact) {
        String table = "miot_conversational.conv_call_permission_checkpoint";
        CallPermission initial = find(number, contact).orElse(CallPermission.none(number, contact));
        String sql = SAVE.substring(0, SAVE.indexOf("ON CONFLICT"))
                .replace("miot_conversational.conv_call_permission", table) + "ON CONFLICT DO NOTHING";
        query(sql, params(initial));
        return permission(query(FIND.replace("miot_conversational.conv_call_permission", table),
                Tuple.of(number, contact)).iterator().next());
    }

    @Override
    public void recordEvent(PermissionEvent event) {
        query("INSERT INTO miot_conversational.conv_call_permission_event "
                + "(business_phone_number_id, contact_e164, event_id, occurred_at, payload) "
                + "VALUES ($1, $2, $3, $4, $5::text::jsonb) ON CONFLICT DO NOTHING",
                Tuple.of(event.number(), event.contact(), event.id(), time(event.occurredAt()), event.json()));
    }

    @Override
    public List<PermissionEvent> events(String number, String contact) {
        List<PermissionEvent> events = new ArrayList<>();
        query("SELECT event_id, occurred_at, payload::text AS payload "
                + "FROM miot_conversational.conv_call_permission_event "
                + "WHERE business_phone_number_id = $1 AND contact_e164 = $2", Tuple.of(number, contact))
                .forEach(row -> events.add(PermissionEvent.read(row.getString("event_id"),
                        instant(row, "occurred_at"), row.getString("payload"))));
        return events;
    }

    @Override
    public Optional<CallPermission> find(String businessPhoneNumberId, String contactE164) {
        RowSet<Row> rows = query(FIND, Tuple.of(businessPhoneNumberId, contactE164));
        return rows.size() == 0 ? Optional.empty() : Optional.of(permission(rows.iterator().next()));
    }

    @Override
    public void save(CallPermission p) {
        query(SAVE, params(p));
    }

    private static Tuple params(CallPermission p) {
        return Tuple.tuple().addString(p.businessPhoneNumberId()).addString(p.contactE164())
                .addString(p.status().name()).addOffsetDateTime(time(p.expiresAt()))
                .addOffsetDateTime(time(p.respondedAt())).addString(p.responseSource())
                .addInteger(p.consecutiveUnanswered()).addOffsetDateTime(time(p.lastConnectedCallAt()));
    }

    @Override
    public List<Instant> requestsSince(String businessPhoneNumberId, String contactE164, Instant since) {
        List<Instant> out = new ArrayList<>();
        query(REQUESTS, Tuple.of(businessPhoneNumberId, contactE164, time(since)))
                .forEach(r -> out.add(r.getOffsetDateTime("sent_at").toInstant()));
        return out;
    }

    @Override
    public void recordRequest(String tenantCode, String businessPhoneNumberId, String contactE164, String origin,
            String wamid, String requestedBy, Instant sentAt) {
        query(RECORD, Tuple.tuple().addUUID(UUID.randomUUID()).addString(tenantCode)
                .addString(businessPhoneNumberId).addString(contactE164).addString(origin).addString(wamid)
                .addString(requestedBy).addOffsetDateTime(time(sentAt)));
    }

    protected RowSet<Row> query(String sql, Tuple params) {
        return ManagedProvisioningTransaction.client(pool.get()).preparedQuery(sql).execute(params).await().indefinitely();
    }

    private static CallPermission permission(Row r) {
        return new CallPermission(r.getString("business_phone_number_id"), r.getString("contact_e164"),
                CallPermissionStatus.valueOf(r.getString("status")), instant(r, "expires_at"),
                instant(r, "responded_at"), r.getString("response_source"), r.getInteger("consecutive_unanswered"),
                instant(r, "last_connected_call_at"));
    }

    private static OffsetDateTime time(Instant at) {
        return at == null ? null : at.atOffset(ZoneOffset.UTC);
    }

    private static Instant instant(Row row, String column) {
        OffsetDateTime t = row.getOffsetDateTime(column);
        return t == null ? null : t.toInstant();
    }
}
