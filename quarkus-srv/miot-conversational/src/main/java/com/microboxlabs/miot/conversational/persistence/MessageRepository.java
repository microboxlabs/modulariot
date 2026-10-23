package com.microboxlabs.miot.conversational.persistence;

import com.microboxlabs.miot.conversational.domain.Channel;
import com.microboxlabs.miot.conversational.domain.Message;
import com.microboxlabs.miot.conversational.domain.MessageDirection;
import com.microboxlabs.miot.conversational.domain.MessageRole;
import com.microboxlabs.miot.conversational.domain.MessageStatus;
import com.microboxlabs.miot.conversational.domain.MessageType;
import io.vertx.core.json.JsonObject;
import io.vertx.mutiny.sqlclient.Pool;
import io.vertx.mutiny.sqlclient.Row;
import io.vertx.mutiny.sqlclient.Tuple;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.inject.Instance;
import java.time.OffsetDateTime;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/** Persistence for {@link Message} rows in a conversation timeline, on any channel. */
@ApplicationScoped
public class MessageRepository {

    private static final String COLUMNS = """
            id, conversation_id, direction, role, msg_type, body, template_name,
            media_ref, media_mime_type, media_file_name, provider_message_id, status,
            error_message, sent_by_user_id, service_code, process_instance_id, metadata,
            sent_at, delivered_at, read_at, created_at, channel, address, in_reply_to, run_id, step
            """;

    private static final String SELECT = "SELECT " + COLUMNS;

    private static final String INSERT = """
            INSERT INTO miot_conversational.wa_message (
                id, conversation_id, direction, role, msg_type, body, template_name,
                media_ref, media_mime_type, media_file_name, provider_message_id, status,
                error_message, sent_by_user_id, service_code, process_instance_id, metadata,
                sent_at, delivered_at, read_at, created_at, channel, address, in_reply_to, run_id, step
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21,
                      $22, $23, $24, $25, $26)
            RETURNING\s""" + COLUMNS;

    // Inbound idempotency and the conversation touch live in this one atomic statement: the
    // (channel, provider id) partial unique index is the dedup, so a redelivered event inserts
    // nothing, the touch is skipped (no double unread count) and RETURNING yields no row
    // (appendInbound returns null). A failure rolls back both writes, so a redelivery after a
    // transient error stores the message and touches the conversation.
    //
    // Touch ($27 occurred at, $28 preview, $29 session expiry, $30 contact name): advance the
    // "latest" fields only forward. Meta delivery is not strictly ordered, so GREATEST keeps the
    // newest timestamp and session window, and the preview changes only when this event is the
    // newest seen. GREATEST ignores NULLs, so a new conversation takes $27/$29 as they are.
    private static final String INSERT_INBOUND_AND_TOUCH = """
            WITH inserted AS (
                INSERT INTO miot_conversational.wa_message (
                    id, conversation_id, direction, role, msg_type, body, template_name,
                    media_ref, media_mime_type, media_file_name, provider_message_id, status,
                    error_message, sent_by_user_id, service_code, process_instance_id, metadata,
                    sent_at, delivered_at, read_at, created_at, channel, address, in_reply_to, run_id, step
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19,
                          $20, $21, $22, $23, $24, $25, $26)
                ON CONFLICT (channel, provider_message_id) WHERE provider_message_id IS NOT NULL DO NOTHING
                RETURNING\s""" + COLUMNS + """
            ),
            touched AS (
                UPDATE miot_conversational.wa_conversation
                SET last_inbound_at = GREATEST(last_inbound_at, $27),
                    last_message_at = GREATEST(last_message_at, $27),
                    last_message_preview = CASE
                        WHEN last_message_at IS NULL OR $27 >= last_message_at THEN $28
                        ELSE last_message_preview END,
                    session_expires_at = GREATEST(session_expires_at, $29),
                    wa_contact_name = COALESCE($30, wa_contact_name),
                    display_name = COALESCE(display_name, $30),
                    unread_count = unread_count + 1,
                    updated_at = now()
                WHERE id = $2 AND EXISTS (SELECT 1 FROM inserted)
                RETURNING id
            )
            SELECT * FROM inserted
            """;

    private static final String SELECT_BY_CONVERSATION = SELECT + """
            FROM miot_conversational.wa_message
            WHERE conversation_id = $1
            ORDER BY created_at, id
            LIMIT $2
            """;

    // Status mirroring and reply attachment look up a row by the provider id stored on send (the
    // partial unique index makes this a point lookup).
    private static final String SELECT_BY_PROVIDER_MESSAGE_ID = SELECT + """
            FROM miot_conversational.wa_message
            WHERE channel = $1 AND provider_message_id = $2
            LIMIT 1
            """;

    private static final String SELECT_BY_ID = SELECT + """
            FROM miot_conversational.wa_message
            WHERE id = $1
            """;

    // Advance the lifecycle (SENT→DELIVERED→READ, or →FAILED). COALESCE keeps any timestamp /
    // error already recorded by an earlier callback, so out-of-order delivery never erases state.
    // The advance-only guard itself lives in the service.
    private static final String MARK_STATUS = """
            UPDATE miot_conversational.wa_message
            SET status = $2,
                delivered_at = COALESCE($3, delivered_at),
                read_at = COALESCE($4, read_at),
                error_message = COALESCE($5, error_message)
            WHERE id = $1
            RETURNING\s""" + COLUMNS;

    private final Instance<Pool> clientInstance;

    protected MessageRepository(Instance<Pool> clientInstance) {
        this.clientInstance = clientInstance;
    }

    public Message append(Message message) {
        return mapRow(client().preparedQuery(INSERT)
                .execute(toParams(message))
                .await().indefinitely()
                .iterator().next());
    }

    /**
     * Inserts an inbound message, deduping on (channel, provider id), and applies the inbound
     * touch to its conversation in the same statement. Returns the persisted row, or {@code null}
     * when the id was already stored (a Meta redelivery); the conversation is then left as it was.
     */
    public Message appendInbound(Message message, ConversationRepository.InboundTouch touch) {
        Tuple params = toParams(message)
                .addOffsetDateTime(touch.occurredAt())
                .addString(touch.lastMessagePreview())
                .addOffsetDateTime(touch.sessionExpiresAt())
                .addString(touch.contactName());
        var rows = client().preparedQuery(INSERT_INBOUND_AND_TOUCH)
                .execute(params)
                .await().indefinitely();
        var iterator = rows.iterator();
        return iterator.hasNext() ? mapRow(iterator.next()) : null;
    }

    private Tuple toParams(Message message) {
        return Tuple.tuple()
                .addUUID(UUID.fromString(message.id()))
                .addUUID(UUID.fromString(message.conversationId()))
                .addString(message.direction().name())
                .addString(message.role().name())
                .addString(message.type().name())
                .addString(message.body())
                .addString(message.templateName())
                .addString(message.mediaRef())
                .addString(message.mediaMimeType())
                .addString(message.mediaFileName())
                .addString(message.providerMessageId())
                .addString(message.status().name())
                .addString(message.errorMessage())
                .addString(message.sentByUserId())
                .addString(message.serviceCode())
                .addString(message.processInstanceId())
                .addJsonObject(toJson(message.metadata()))
                .addOffsetDateTime(message.sentAt())
                .addOffsetDateTime(message.deliveredAt())
                .addOffsetDateTime(message.readAt())
                .addOffsetDateTime(message.createdAt())
                .addString(channelOf(message).dbValue())
                .addString(message.address())
                .addUUID(message.inReplyTo() == null ? null : UUID.fromString(message.inReplyTo()))
                .addUUID(message.runId() == null ? null : UUID.fromString(message.runId()))
                .addInteger(message.step());
    }

    private static Channel channelOf(Message message) {
        return message.channel() == null ? Channel.WHATSAPP : message.channel();
    }

    public List<Message> listByConversation(String conversationId, int limit) {
        return client().preparedQuery(SELECT_BY_CONVERSATION)
                .execute(Tuple.of(UUID.fromString(conversationId), limit))
                .await().indefinitely()
                .stream()
                .map(this::mapRow)
                .toList();
    }

    /** The row with this provider id on this channel, or null if we never stored it. */
    public Message findByProviderMessageId(Channel channel, String providerMessageId) {
        if (channel == null || providerMessageId == null || providerMessageId.isBlank()) {
            return null;
        }
        var rows = client().preparedQuery(SELECT_BY_PROVIDER_MESSAGE_ID)
                .execute(Tuple.of(channel.dbValue(), providerMessageId))
                .await().indefinitely();
        var iterator = rows.iterator();
        return iterator.hasNext() ? mapRow(iterator.next()) : null;
    }

    /** The row with this id, or null for an unknown or non-UUID id. */
    public Message findById(String messageId) {
        UUID id = parseUuidOrNull(messageId);
        if (id == null) {
            return null;
        }
        var rows = client().preparedQuery(SELECT_BY_ID)
                .execute(Tuple.of(id))
                .await().indefinitely();
        var iterator = rows.iterator();
        return iterator.hasNext() ? mapRow(iterator.next()) : null;
    }

    static UUID parseUuidOrNull(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }
        try {
            return UUID.fromString(value.trim());
        } catch (IllegalArgumentException e) {
            return null;
        }
    }

    public Message markStatus(
            String messageId,
            MessageStatus status,
            OffsetDateTime deliveredAt,
            OffsetDateTime readAt,
            String errorMessage) {
        var rows = client().preparedQuery(MARK_STATUS)
                .execute(Tuple.of(UUID.fromString(messageId), status.name(), deliveredAt, readAt, errorMessage))
                .await().indefinitely();
        var iterator = rows.iterator();
        return iterator.hasNext() ? mapRow(iterator.next()) : null;
    }

    private Pool client() {
        return clientInstance.get();
    }

    private Message mapRow(Row row) {
        return new Message(
                row.getUUID("id").toString(),
                row.getUUID("conversation_id").toString(),
                MessageDirection.valueOf(row.getString("direction")),
                MessageRole.valueOf(row.getString("role")),
                MessageType.valueOf(row.getString("msg_type")),
                row.getString("body"),
                row.getString("template_name"),
                row.getString("media_ref"),
                row.getString("media_mime_type"),
                row.getString("media_file_name"),
                row.getString("provider_message_id"),
                MessageStatus.valueOf(row.getString("status")),
                row.getString("error_message"),
                row.getString("sent_by_user_id"),
                row.getString("service_code"),
                row.getString("process_instance_id"),
                toMap(row.getJsonObject("metadata")),
                row.getOffsetDateTime("sent_at"),
                row.getOffsetDateTime("delivered_at"),
                row.getOffsetDateTime("read_at"),
                row.getOffsetDateTime("created_at"),
                Channel.fromDb(row.getString("channel")),
                row.getString("address"),
                uuidString(row.getUUID("in_reply_to")),
                uuidString(row.getUUID("run_id")),
                row.getInteger("step"));
    }

    private static String uuidString(UUID value) {
        return value == null ? null : value.toString();
    }

    private JsonObject toJson(Map<String, Object> value) {
        return new JsonObject(value == null ? Map.of() : value);
    }

    private Map<String, Object> toMap(JsonObject value) {
        return value == null ? Map.of() : new LinkedHashMap<>(value.getMap());
    }
}
