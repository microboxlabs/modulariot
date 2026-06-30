package com.microboxlabs.miot.conversational.persistence;

import com.microboxlabs.miot.conversational.domain.Conversation;
import com.microboxlabs.miot.conversational.domain.ConversationStatus;
import io.vertx.mutiny.sqlclient.Pool;
import io.vertx.mutiny.sqlclient.Row;
import io.vertx.mutiny.sqlclient.Tuple;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.inject.Instance;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

/**
 * Persistence for {@link Conversation} (the WhatsApp message-pool head row). Provides
 * find-or-create lookups plus the outbound touch used when a message is sent.
 */
@ApplicationScoped
public class ConversationRepository {

    private static final String COLUMNS = """
            id, tenant_code, phone_e164, wa_contact_name, driver_id,
            context_service_code, context_process_instance_id, context_task_id,
            status, last_inbound_at, last_outbound_at, last_message_at,
            session_expires_at, last_message_preview, unread_count, created_at, updated_at
            """;

    private static final String SELECT_FROM = "SELECT " + COLUMNS + " FROM miot_conversational.wa_conversation ";

    private static final String SELECT_BY_TENANT_AND_PHONE =
            SELECT_FROM + "WHERE tenant_code = $1 AND phone_e164 = $2";

    private static final String SELECT_BY_TENANT_AND_ID =
            SELECT_FROM + "WHERE tenant_code = $1 AND id = $2";

    private static final String SELECT_BY_TENANT = SELECT_FROM + """
            WHERE tenant_code = $1
            ORDER BY last_message_at DESC NULLS LAST, created_at DESC
            LIMIT $2
            """;

    private static final String INSERT = """
            INSERT INTO miot_conversational.wa_conversation (
                id, tenant_code, phone_e164, wa_contact_name, driver_id,
                context_service_code, context_process_instance_id, context_task_id,
                status, last_inbound_at, last_outbound_at, last_message_at,
                session_expires_at, last_message_preview, unread_count, created_at, updated_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
            RETURNING\s""" + COLUMNS;

    // Outbound touch: bump activity timestamps + preview, and fill trip context only when
    // the send carried it (COALESCE keeps prior context for ad-hoc sends).
    private static final String UPDATE_OUTBOUND = """
            UPDATE miot_conversational.wa_conversation
            SET context_service_code = COALESCE($2, context_service_code),
                context_process_instance_id = COALESCE($3, context_process_instance_id),
                context_task_id = COALESCE($4, context_task_id),
                driver_id = COALESCE($5, driver_id),
                last_outbound_at = $6,
                last_message_at = $6,
                last_message_preview = $7,
                updated_at = $6
            WHERE id = $1
            RETURNING\s""" + COLUMNS;

    // Inbound touch: bump activity timestamps + preview, increment the unread badge, and refresh
    // the 24h session window. wa_contact_name is filled only when Meta gave us one (COALESCE keeps
    // a previously-learned name).
    private static final String UPDATE_INBOUND = """
            UPDATE miot_conversational.wa_conversation
            SET last_inbound_at = $2,
                last_message_at = $2,
                last_message_preview = $3,
                session_expires_at = $4,
                wa_contact_name = COALESCE($5, wa_contact_name),
                unread_count = unread_count + 1,
                updated_at = $2
            WHERE id = $1
            RETURNING\s""" + COLUMNS;

    private final Instance<Pool> clientInstance;

    ConversationRepository(Instance<Pool> clientInstance) {
        this.clientInstance = clientInstance;
    }

    public Conversation findByTenantAndPhone(String tenantCode, String phoneE164) {
        var rows = client().preparedQuery(SELECT_BY_TENANT_AND_PHONE)
                .execute(Tuple.of(tenantCode, phoneE164))
                .await().indefinitely();
        var iterator = rows.iterator();
        return iterator.hasNext() ? mapRow(iterator.next()) : null;
    }

    public Conversation findByTenantAndId(String tenantCode, String conversationId) {
        UUID id = parseUuidOrNull(conversationId);
        if (id == null) {
            return null;
        }
        var rows = client().preparedQuery(SELECT_BY_TENANT_AND_ID)
                .execute(Tuple.of(tenantCode, id))
                .await().indefinitely();
        var iterator = rows.iterator();
        return iterator.hasNext() ? mapRow(iterator.next()) : null;
    }

    private static UUID parseUuidOrNull(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }
        try {
            return UUID.fromString(value);
        } catch (IllegalArgumentException e) {
            return null;
        }
    }

    public List<Conversation> listByTenant(String tenantCode, int limit) {
        return client().preparedQuery(SELECT_BY_TENANT)
                .execute(Tuple.of(tenantCode, limit))
                .await().indefinitely()
                .stream()
                .map(this::mapRow)
                .toList();
    }

    public Conversation create(Conversation conversation) {
        Tuple params = Tuple.tuple()
                .addUUID(UUID.fromString(conversation.id()))
                .addString(conversation.tenantCode())
                .addString(conversation.phoneE164())
                .addString(conversation.waContactName())
                .addString(conversation.driverId())
                .addString(conversation.contextServiceCode())
                .addString(conversation.contextProcessInstanceId())
                .addString(conversation.contextTaskId())
                .addString(conversation.status().name())
                .addOffsetDateTime(conversation.lastInboundAt())
                .addOffsetDateTime(conversation.lastOutboundAt())
                .addOffsetDateTime(conversation.lastMessageAt())
                .addOffsetDateTime(conversation.sessionExpiresAt())
                .addString(conversation.lastMessagePreview())
                .addInteger(conversation.unreadCount())
                .addOffsetDateTime(conversation.createdAt())
                .addOffsetDateTime(conversation.updatedAt());
        return mapRow(client().preparedQuery(INSERT)
                .execute(params)
                .await().indefinitely()
                .iterator().next());
    }

    public Conversation updateOutbound(
            String conversationId,
            String contextServiceCode,
            String contextProcessInstanceId,
            String contextTaskId,
            String driverId,
            OffsetDateTime occurredAt,
            String lastMessagePreview) {
        Tuple params = Tuple.tuple()
                .addUUID(UUID.fromString(conversationId))
                .addString(contextServiceCode)
                .addString(contextProcessInstanceId)
                .addString(contextTaskId)
                .addString(driverId)
                .addOffsetDateTime(occurredAt)
                .addString(lastMessagePreview);
        return mapRow(client().preparedQuery(UPDATE_OUTBOUND)
                .execute(params)
                .await().indefinitely()
                .iterator().next());
    }

    public Conversation updateInbound(
            String conversationId,
            OffsetDateTime occurredAt,
            String lastMessagePreview,
            OffsetDateTime sessionExpiresAt,
            String waContactName) {
        Tuple params = Tuple.tuple()
                .addUUID(UUID.fromString(conversationId))
                .addOffsetDateTime(occurredAt)
                .addString(lastMessagePreview)
                .addOffsetDateTime(sessionExpiresAt)
                .addString(waContactName);
        return mapRow(client().preparedQuery(UPDATE_INBOUND)
                .execute(params)
                .await().indefinitely()
                .iterator().next());
    }

    private Pool client() {
        return clientInstance.get();
    }

    private Conversation mapRow(Row row) {
        return new Conversation(
                row.getUUID("id").toString(),
                row.getString("tenant_code"),
                row.getString("phone_e164"),
                row.getString("wa_contact_name"),
                row.getString("driver_id"),
                row.getString("context_service_code"),
                row.getString("context_process_instance_id"),
                row.getString("context_task_id"),
                ConversationStatus.valueOf(row.getString("status")),
                row.getOffsetDateTime("last_inbound_at"),
                row.getOffsetDateTime("last_outbound_at"),
                row.getOffsetDateTime("last_message_at"),
                row.getOffsetDateTime("session_expires_at"),
                row.getString("last_message_preview"),
                row.getInteger("unread_count"),
                row.getOffsetDateTime("created_at"),
                row.getOffsetDateTime("updated_at"));
    }
}
