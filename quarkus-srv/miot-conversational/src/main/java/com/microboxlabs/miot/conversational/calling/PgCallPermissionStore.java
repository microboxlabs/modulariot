package com.microboxlabs.miot.conversational.calling;

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
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)""";

    private final Supplier<Pool> pool;

    @Inject
    PgCallPermissionStore(Instance<Pool> pool) {
        this.pool = pool::get;
    }

    @Override
    public Optional<CallPermission> find(String businessPhoneNumberId, String contactE164) {
        RowSet<Row> rows = query(FIND, Tuple.of(businessPhoneNumberId, contactE164));
        return rows.size() == 0 ? Optional.empty() : Optional.of(permission(rows.iterator().next()));
    }

    @Override
    public void save(CallPermission p) {
        query(SAVE, Tuple.tuple().addString(p.businessPhoneNumberId()).addString(p.contactE164())
                .addString(p.status().name()).addOffsetDateTime(time(p.expiresAt()))
                .addOffsetDateTime(time(p.respondedAt())).addString(p.responseSource())
                .addInteger(p.consecutiveUnanswered()).addOffsetDateTime(time(p.lastConnectedCallAt())));
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

    private RowSet<Row> query(String sql, Tuple params) {
        return pool.get().preparedQuery(sql).execute(params).await().indefinitely();
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
