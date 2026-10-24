package com.microboxlabs.miot.conversational.persistence;

import com.microboxlabs.miot.conversational.domain.ContextKind;
import com.microboxlabs.miot.conversational.domain.Conversation;
import com.microboxlabs.miot.conversational.domain.ConversationStatus;
import io.vertx.core.json.JsonObject;
import io.vertx.mutiny.sqlclient.Pool;
import io.vertx.mutiny.sqlclient.Row;
import io.vertx.mutiny.sqlclient.RowSet;
import io.vertx.mutiny.sqlclient.Tuple;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.inject.Instance;
import java.time.OffsetDateTime;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Persistence for {@link Conversation}: one row per context and participant. Provides the
 * lookups that choose a conversation for a send or an inbound message, plus the touches applied
 * when a message is stored.
 */
@ApplicationScoped
public class ConversationRepository {

    private static final String COLUMNS = """
            id, tenant_code, phone_e164, wa_contact_name, driver_id,
            context_service_code, context_process_instance_id, context_task_id,
            status, last_inbound_at, last_outbound_at, last_message_at,
            session_expires_at, last_message_preview, unread_count, created_at, updated_at,
            context_kind, context_key, participant_address, participant_contact_id,
            participant_role, display_name, channel_state
            """;

    private static final String SELECT_FROM = "SELECT " + COLUMNS + " FROM miot_conversational.wa_conversation ";

    private static final String SELECT_BY_CONTEXT_AND_ADDRESS = SELECT_FROM + """
            WHERE tenant_code = $1 AND context_kind = $2 AND context_key = $3 AND participant_address = $4
            """;

    // The unique partial index allows one such row; ORDER BY keeps the pick stable if a race
    // ever produced two.
    private static final String SELECT_OPEN_UNASSIGNED_BY_ADDRESS = SELECT_FROM + """
            WHERE tenant_code = $1 AND participant_address = $2
              AND context_kind IS NULL AND status = 'OPEN'
            ORDER BY created_at DESC
            LIMIT 1
            """;

    private static final String SELECT_LATEST_OPEN_BY_ADDRESS = SELECT_FROM + """
            WHERE tenant_code = $1 AND participant_address = $2 AND status = 'OPEN'
            ORDER BY last_message_at DESC NULLS LAST, created_at DESC
            LIMIT 1
            """;

    private static final String SELECT_BY_TENANT_AND_ID =
            SELECT_FROM + "WHERE tenant_code = $1 AND id = $2";

    private static final String SELECT_BY_ID = SELECT_FROM + "WHERE id = $1";

    // The conversation where a WAITING run last sent to this address. Only real sends count: a test run's
    // SIMULATED messages and failed sends never reached the person replying. A send from the platform's number
    // is answered there, not on the organization's own number, so it does not count either.
    private static final String SELECT_WITH_WAITING_RUN = "SELECT " + COLUMNS + """
            , w.run_id
            FROM miot_conversational.wa_conversation
            JOIN (SELECT m.conversation_id, r.id AS run_id, MAX(m.created_at) AS last_at
                  FROM miot_conversational.conv_run r
                  JOIN miot_conversational.wa_message m ON m.run_id = r.id
                  WHERE r.tenant_code = $1 AND r.status = 'WAITING' AND NOT r.test
                    AND m.direction = 'OUTBOUND' AND m.address = $2
                    AND m.status NOT IN ('SIMULATED', 'FAILED')
                    AND m.metadata->>'connectionTenant' IS DISTINCT FROM '_platform'
                  GROUP BY m.conversation_id, r.id) w ON w.conversation_id = id
            WHERE tenant_code = $1 AND participant_address = $2
            ORDER BY w.last_at DESC
            LIMIT 1
            """;

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
                session_expires_at, last_message_preview, unread_count, created_at, updated_at,
                context_kind, context_key, participant_address, participant_contact_id,
                participant_role, display_name, channel_state
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17,
                      $18, $19, $20, $21, $22, $23, $24)
            ON CONFLICT DO NOTHING
            RETURNING\s""" + COLUMNS;

    // Outbound touch: bump activity timestamps and preview. The context ($8 kind, $9 key, $2
    // service code) is set only on a conversation that has none yet, so an open conversation
    // without context is adopted by the first send about a service and a context never changes
    // afterwards. Process, task and driver take the newest value the send carried.
    private static final String UPDATE_OUTBOUND = """
            UPDATE miot_conversational.wa_conversation
            SET context_kind = COALESCE(context_kind, $8),
                context_key = CASE WHEN context_kind IS NULL THEN $9 ELSE context_key END,
                context_service_code = CASE WHEN context_kind IS NULL THEN $2 ELSE context_service_code END,
                context_process_instance_id = COALESCE($3, context_process_instance_id),
                context_task_id = COALESCE($4, context_task_id),
                driver_id = COALESCE($5, driver_id),
                participant_role = COALESCE(participant_role, CASE WHEN $5 IS NOT NULL THEN 'driver' END),
                last_outbound_at = $6,
                last_message_at = $6,
                last_message_preview = $7,
                updated_at = $6
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

    protected ConversationRepository(Instance<Pool> clientInstance) {
        this.clientInstance = clientInstance;
    }

    /** The conversation about this context with this participant, or null. */
    public Conversation findByContextAndAddress(
            String tenantCode, ContextKind kind, String contextKey, String address) {
        if (kind == null || contextKey == null || contextKey.isBlank() || address == null) {
            return null;
        }
        return first(client().preparedQuery(SELECT_BY_CONTEXT_AND_ADDRESS)
                .execute(Tuple.of(tenantCode, kind.dbValue(), contextKey, address))
                .await().indefinitely());
    }

    /** The open conversation without context for an address, or null. */
    public Conversation findOpenUnassignedByAddress(String tenantCode, String address) {
        return first(client().preparedQuery(SELECT_OPEN_UNASSIGNED_BY_ADDRESS)
                .execute(Tuple.of(tenantCode, address))
                .await().indefinitely());
    }

    /** The most recently active OPEN conversation for an address, any context, or null. */
    public Conversation findLatestOpenByAddress(String tenantCode, String address) {
        return first(client().preparedQuery(SELECT_LATEST_OPEN_BY_ADDRESS)
                .execute(Tuple.of(tenantCode, address))
                .await().indefinitely());
    }

    /** A conversation with the run that waits on it. */
    public record WithWaitingRun(Conversation conversation, String runId) {
    }

    /** The conversation where a WAITING run last messaged this address, or null. */
    public WithWaitingRun findWithWaitingRun(String tenantCode, String address) {
        var rows = client().preparedQuery(SELECT_WITH_WAITING_RUN)
                .execute(Tuple.of(tenantCode, address))
                .await().indefinitely()
                .iterator();
        if (!rows.hasNext()) {
            return null;
        }
        Row row = rows.next();
        return new WithWaitingRun(mapRow(row), row.getUUID("run_id").toString());
    }

    /** A participant about a context; {@code phoneE164} is null for an email address. */
    public record ContextParticipant(ContextKind kind, String contextKey, String address, String phoneE164,
            String displayName, String role, String contactId) {
    }

    /**
     * The conversation about this context with this participant, created when there is none. Without a context:
     * the participant's open conversation without context, else a new one.
     */
    public Conversation findOrCreateForContext(String tenantCode, ContextParticipant p, OffsetDateTime now) {
        ContextKind kind = p.kind();
        String contextKey = p.contextKey();
        String address = p.address();
        boolean hasContext = kind != null && contextKey != null && !contextKey.isBlank();
        Conversation found = hasContext
                ? findByContextAndAddress(tenantCode, kind, contextKey, address)
                : findOpenUnassignedByAddress(tenantCode, address);
        if (found != null) {
            return found;
        }
        String serviceCode = hasContext && kind == ContextKind.SERVICE ? contextKey : null;
        return create(new Conversation(UUID.randomUUID().toString(), tenantCode, p.phoneE164(), null, null,
                serviceCode, null, null, ConversationStatus.OPEN, null, null, null, null, null, 0, now, now,
                hasContext ? kind : null, hasContext ? contextKey : null, address, p.contactId(), p.role(),
                p.displayName(), Map.of()));
    }

    public Conversation findByTenantAndId(String tenantCode, String conversationId) {
        UUID id = parseUuidOrNull(conversationId);
        if (id == null) {
            return null;
        }
        return first(client().preparedQuery(SELECT_BY_TENANT_AND_ID)
                .execute(Tuple.of(tenantCode, id))
                .await().indefinitely());
    }

    /** Any tenant's conversation; for routing a reply on the platform's number by the message it answers. */
    public Conversation findById(String conversationId) {
        UUID id = parseUuidOrNull(conversationId);
        if (id == null) {
            return null;
        }
        return first(client().preparedQuery(SELECT_BY_ID)
                .execute(Tuple.of(id))
                .await().indefinitely());
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
                .map(ConversationRepository::mapRow)
                .toList();
    }

    /**
     * Stores a new conversation. When a concurrent create already stored one with the same identity, returns
     * that one instead of failing on the unique index.
     */
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
                .addOffsetDateTime(conversation.updatedAt())
                .addString(conversation.contextKind() == null ? null : conversation.contextKind().dbValue())
                .addString(conversation.contextKey())
                .addString(conversation.participantAddress())
                .addString(conversation.participantContactId())
                .addString(conversation.participantRole())
                .addString(conversation.displayName())
                .addJsonObject(new JsonObject(
                        conversation.channelState() == null ? Map.of() : conversation.channelState()));
        Conversation created = first(client().preparedQuery(INSERT)
                .execute(params)
                .await().indefinitely());
        return created != null ? created : concurrentlyCreated(conversation);
    }

    /**
     * The conversation a concurrent create stored first with the same identity: the one about the same
     * context and participant, or the participant's open conversation without context.
     */
    private Conversation concurrentlyCreated(Conversation conversation) {
        Conversation winner = conversation.contextKind() != null
                ? findByContextAndAddress(conversation.tenantCode(), conversation.contextKind(),
                        conversation.contextKey(), conversation.participantAddress())
                : findOpenUnassignedByAddress(conversation.tenantCode(), conversation.participantAddress());
        if (winner == null) {
            throw new IllegalStateException("Conversation " + conversation.id() + " was not stored");
        }
        return winner;
    }

    /**
     * What an outbound message writes on its conversation. {@code contextKind} / {@code contextKey} /
     * {@code contextServiceCode} are written only when the conversation has no context yet.
     */
    public record OutboundTouch(
            ContextKind contextKind,
            String contextKey,
            String contextServiceCode,
            String contextProcessInstanceId,
            String contextTaskId,
            String driverId,
            OffsetDateTime occurredAt,
            String lastMessagePreview) {

        /** A touch that carries only the context, as rule-started messages do. */
        public static OutboundTouch ofContext(ContextKind kind, String key, OffsetDateTime at, String preview) {
            return new OutboundTouch(kind, key, kind == ContextKind.SERVICE ? key : null, null, null, null, at,
                    preview);
        }
    }

    public Conversation updateOutbound(String conversationId, OutboundTouch touch) {
        Tuple params = Tuple.tuple()
                .addUUID(UUID.fromString(conversationId))
                .addString(touch.contextServiceCode())
                .addString(touch.contextProcessInstanceId())
                .addString(touch.contextTaskId())
                .addString(touch.driverId())
                .addOffsetDateTime(touch.occurredAt())
                .addString(touch.lastMessagePreview())
                .addString(touch.contextKind() == null ? null : touch.contextKind().dbValue())
                .addString(touch.contextKey());
        return mapRow(client().preparedQuery(UPDATE_OUTBOUND)
                .execute(params)
                .await().indefinitely()
                .iterator().next());
    }

    /**
     * What an inbound message writes on its conversation: activity timestamps, preview, the
     * WhatsApp session window, the contact name and one more unread. Applied by
     * {@link MessageRepository#appendInbound} in the statement that stores the message.
     */
    public record InboundTouch(
            OffsetDateTime occurredAt,
            String lastMessagePreview,
            OffsetDateTime sessionExpiresAt,
            String contactName) {
    }

    public Conversation resetUnread(String conversationId) {
        return first(client().preparedQuery(RESET_UNREAD)
                .execute(Tuple.of(UUID.fromString(conversationId)))
                .await().indefinitely());
    }

    private Pool client() {
        return clientInstance.get();
    }

    private static Conversation first(RowSet<Row> rows) {
        var iterator = rows.iterator();
        return iterator.hasNext() ? mapRow(iterator.next()) : null;
    }

    private static Conversation mapRow(Row row) {
        JsonObject channelState = row.getJsonObject("channel_state");
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
                row.getOffsetDateTime("updated_at"),
                ContextKind.fromDb(row.getString("context_kind")),
                row.getString("context_key"),
                row.getString("participant_address"),
                row.getString("participant_contact_id"),
                row.getString("participant_role"),
                row.getString("display_name"),
                channelState == null ? Map.of() : new LinkedHashMap<>(channelState.getMap()));
    }
}
