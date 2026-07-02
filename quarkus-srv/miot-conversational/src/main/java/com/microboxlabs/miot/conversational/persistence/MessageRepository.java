package com.microboxlabs.miot.conversational.persistence;

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

/** Persistence for {@link Message} rows in the WhatsApp message pool timeline. */
@ApplicationScoped
public class MessageRepository {

    private static final String COLUMNS = """
            id, conversation_id, direction, role, msg_type, body, template_name,
            media_ref, media_mime_type, media_file_name, meta_message_id, status,
            error_message, sent_by_user_id, service_code, process_instance_id, metadata,
            sent_at, delivered_at, read_at, created_at
            """;

    private static final String INSERT = """
            INSERT INTO miot_conversational.wa_message (
                id, conversation_id, direction, role, msg_type, body, template_name,
                media_ref, media_mime_type, media_file_name, meta_message_id, status,
                error_message, sent_by_user_id, service_code, process_instance_id, metadata,
                sent_at, delivered_at, read_at, created_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21)
            RETURNING\s""" + COLUMNS;

    // Inbound idempotency lives in this one atomic statement: the wamid partial-unique index is the
    // dedup, so a redelivered event inserts nothing and RETURNING yields no row (appendInbound
    // returns null → caller skips the conversation touch). Unlike a separate pre-write claim, a
    // retry after a failed insert still persists the message — no permanent loss on transient errors.
    private static final String INSERT_IF_NEW = """
            INSERT INTO miot_conversational.wa_message (
                id, conversation_id, direction, role, msg_type, body, template_name,
                media_ref, media_mime_type, media_file_name, meta_message_id, status,
                error_message, sent_by_user_id, service_code, process_instance_id, metadata,
                sent_at, delivered_at, read_at, created_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21)
            ON CONFLICT (meta_message_id) WHERE meta_message_id IS NOT NULL DO NOTHING
            RETURNING\s""" + COLUMNS;

    private static final String SELECT_BY_CONVERSATION = "SELECT " + COLUMNS + """
            FROM miot_conversational.wa_message
            WHERE conversation_id = $1
            ORDER BY created_at, id
            LIMIT $2
            """;

    // Status mirroring looks up the outbound row by the wamid we stored on send (the partial
    // unique index makes this a point lookup).
    private static final String SELECT_BY_META_MESSAGE_ID = "SELECT " + COLUMNS + """
            FROM miot_conversational.wa_message
            WHERE meta_message_id = $1
            LIMIT 1
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

    MessageRepository(Instance<Pool> clientInstance) {
        this.clientInstance = clientInstance;
    }

    public Message append(Message message) {
        return mapRow(client().preparedQuery(INSERT)
                .execute(toParams(message))
                .await().indefinitely()
                .iterator().next());
    }

    /**
     * Inserts an inbound message, deduping on the Meta wamid. Returns the persisted row, or
     * {@code null} when the wamid was already stored (a Meta redelivery) so the caller skips the
     * conversation touch.
     */
    public Message appendInbound(Message message) {
        var rows = client().preparedQuery(INSERT_IF_NEW)
                .execute(toParams(message))
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
                .addString(message.metaMessageId())
                .addString(message.status().name())
                .addString(message.errorMessage())
                .addString(message.sentByUserId())
                .addString(message.serviceCode())
                .addString(message.processInstanceId())
                .addJsonObject(toJson(message.metadata()))
                .addOffsetDateTime(message.sentAt())
                .addOffsetDateTime(message.deliveredAt())
                .addOffsetDateTime(message.readAt())
                .addOffsetDateTime(message.createdAt());
    }

    public List<Message> listByConversation(String conversationId, int limit) {
        return client().preparedQuery(SELECT_BY_CONVERSATION)
                .execute(Tuple.of(UUID.fromString(conversationId), limit))
                .await().indefinitely()
                .stream()
                .map(this::mapRow)
                .toList();
    }

    /** The outbound row a status callback refers to, or null if we never stored that wamid. */
    public Message findByMetaMessageId(String metaMessageId) {
        if (metaMessageId == null || metaMessageId.isBlank()) {
            return null;
        }
        var rows = client().preparedQuery(SELECT_BY_META_MESSAGE_ID)
                .execute(Tuple.of(metaMessageId))
                .await().indefinitely();
        var iterator = rows.iterator();
        return iterator.hasNext() ? mapRow(iterator.next()) : null;
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
                row.getString("meta_message_id"),
                MessageStatus.valueOf(row.getString("status")),
                row.getString("error_message"),
                row.getString("sent_by_user_id"),
                row.getString("service_code"),
                row.getString("process_instance_id"),
                toMap(row.getJsonObject("metadata")),
                row.getOffsetDateTime("sent_at"),
                row.getOffsetDateTime("delivered_at"),
                row.getOffsetDateTime("read_at"),
                row.getOffsetDateTime("created_at"));
    }

    private JsonObject toJson(Map<String, Object> value) {
        return new JsonObject(value == null ? Map.of() : value);
    }

    private Map<String, Object> toMap(JsonObject value) {
        return value == null ? Map.of() : new LinkedHashMap<>(value.getMap());
    }
}
