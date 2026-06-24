package com.microboxlabs.miot.conversational.persistence;

import com.microboxlabs.miot.conversational.domain.Conversation;
import com.microboxlabs.miot.conversational.domain.ConversationStatus;
import io.vertx.mutiny.sqlclient.Pool;
import io.vertx.mutiny.sqlclient.Row;
import io.vertx.mutiny.sqlclient.Tuple;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.inject.Instance;
import java.util.UUID;

/**
 * Persistence for {@link Conversation} (the WhatsApp message-pool head row). Thin
 * skeleton for the channel foundation; send/webhook flows extend it in later slices.
 */
@ApplicationScoped
public class ConversationRepository {

    private static final String SELECT_BY_TENANT_AND_PHONE = """
            SELECT id, tenant_code, phone_e164, wa_contact_name, driver_id,
                   context_service_code, context_process_instance_id, context_task_id,
                   status, last_inbound_at, last_outbound_at, last_message_at,
                   session_expires_at, last_message_preview, unread_count, created_at, updated_at
            FROM miot_conversational.wa_conversation
            WHERE tenant_code = $1 AND phone_e164 = $2
            """;

    private static final String INSERT = """
            INSERT INTO miot_conversational.wa_conversation (
                id, tenant_code, phone_e164, wa_contact_name, driver_id,
                context_service_code, context_process_instance_id, context_task_id,
                status, last_inbound_at, last_outbound_at, last_message_at,
                session_expires_at, last_message_preview, unread_count, created_at, updated_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
            RETURNING id, tenant_code, phone_e164, wa_contact_name, driver_id,
                      context_service_code, context_process_instance_id, context_task_id,
                      status, last_inbound_at, last_outbound_at, last_message_at,
                      session_expires_at, last_message_preview, unread_count, created_at, updated_at
            """;

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
