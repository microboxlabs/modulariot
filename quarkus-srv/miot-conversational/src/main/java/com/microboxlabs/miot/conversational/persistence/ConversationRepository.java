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

    // A thread's identity is the service it is about (context_service_code); outbound find-or-create
    // keys on it.
    private static final String SELECT_BY_TENANT_AND_SERVICE =
            SELECT_FROM + "WHERE tenant_code = $1 AND context_service_code = $2";

    // Inbound attribution: a driver runs one service at a time, so the newest thread for the phone is
    // the current service.
    private static final String SELECT_LATEST_BY_TENANT_AND_PHONE = SELECT_FROM + """
            WHERE tenant_code = $1 AND phone_e164 = $2
            ORDER BY last_message_at DESC NULLS LAST, created_at DESC
            LIMIT 1
            """;

    // The single open no-service thread for a phone — a cold-inbound home that the next service
    // outbound adopts (its context_service_code goes NULL → the service code).
    // The partial unique index already guarantees at most one such row; ORDER BY keeps the pick
    // deterministic even if a brief race ever produced two.
    private static final String SELECT_OPEN_UNASSIGNED_BY_PHONE = SELECT_FROM + """
            WHERE tenant_code = $1 AND phone_e164 = $2
              AND context_service_code IS NULL AND status = 'OPEN'
            ORDER BY created_at DESC
            LIMIT 1
            """;

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

    // Inbound touch: increment the unread badge, refresh the contact name, and advance the
    // "latest" fields — but only forward. Meta delivery isn't strictly ordered, so GREATEST keeps
    // the newest timestamp/session window and the preview only changes when this event is the
    // newest seen (an older event still counts as unread but doesn't reorder the inbox backwards).
    // GREATEST ignores NULLs, so a freshly-created row (all-NULL) takes $2/$4 as-is.
    private static final String UPDATE_INBOUND = """
            UPDATE miot_conversational.wa_conversation
            SET last_inbound_at = GREATEST(last_inbound_at, $2),
                last_message_at = GREATEST(last_message_at, $2),
                last_message_preview = CASE
                    WHEN last_message_at IS NULL OR $2 >= last_message_at THEN $3
                    ELSE last_message_preview END,
                session_expires_at = GREATEST(session_expires_at, $4),
                wa_contact_name = COALESCE($5, wa_contact_name),
                unread_count = unread_count + 1,
                updated_at = now()
            WHERE id = $1
            RETURNING\s""" + COLUMNS;

    // Clear the unread badge when an agent opens the thread.
    private static final String RESET_UNREAD = """
            UPDATE miot_conversational.wa_conversation
            SET unread_count = 0,
                updated_at = now()
            WHERE id = $1
            RETURNING\s""" + COLUMNS;

    private final Instance<Pool> clientInstance;

    ConversationRepository(Instance<Pool> clientInstance) {
        this.clientInstance = clientInstance;
    }

    /** The thread for a service (its immutable identity), or null. Used by the outbound send path. */
    public Conversation findByTenantAndService(String tenantCode, String serviceCode) {
        if (serviceCode == null || serviceCode.isBlank()) {
            return null;
        }
        var rows = client().preparedQuery(SELECT_BY_TENANT_AND_SERVICE)
                .execute(Tuple.of(tenantCode, serviceCode))
                .await().indefinitely();
        var iterator = rows.iterator();
        return iterator.hasNext() ? mapRow(iterator.next()) : null;
    }

    /** The newest thread for a phone (the driver's current service), or null. Inbound attaches here. */
    public Conversation findLatestByTenantAndPhone(String tenantCode, String phoneE164) {
        var rows = client().preparedQuery(SELECT_LATEST_BY_TENANT_AND_PHONE)
                .execute(Tuple.of(tenantCode, phoneE164))
                .await().indefinitely();
        var iterator = rows.iterator();
        return iterator.hasNext() ? mapRow(iterator.next()) : null;
    }

    /** The one open no-service thread for a phone, or null — the target a new service adopts. */
    public Conversation findOpenUnassignedByPhone(String tenantCode, String phoneE164) {
        var rows = client().preparedQuery(SELECT_OPEN_UNASSIGNED_BY_PHONE)
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

    public Conversation resetUnread(String conversationId) {
        var rows = client().preparedQuery(RESET_UNREAD)
                .execute(Tuple.of(UUID.fromString(conversationId)))
                .await().indefinitely();
        return rows.iterator().hasNext() ? mapRow(rows.iterator().next()) : null;
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
