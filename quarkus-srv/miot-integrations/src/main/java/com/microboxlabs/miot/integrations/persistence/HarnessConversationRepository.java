package com.microboxlabs.miot.integrations.persistence;

import io.smallrye.mutiny.Uni;
import io.vertx.mutiny.sqlclient.Pool;
import io.vertx.mutiny.sqlclient.Row;
import io.vertx.mutiny.sqlclient.RowSet;
import io.vertx.mutiny.sqlclient.Tuple;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.inject.Instance;
import jakarta.inject.Inject;
import java.time.Duration;
import java.time.OffsetDateTime;
import java.util.Iterator;
import java.util.Optional;

/** Storage for the harness's conversation memory. Unit tests subclass it with no pool. */
@ApplicationScoped
public class HarnessConversationRepository {

    private static final Duration QUERY_TIMEOUT = Duration.ofSeconds(10);

    private static final String FIND = """
            SELECT conversation_key, tenant_id, user_id, conversation_id, model,
                   memory::text AS memory, updated_at
              FROM miot_integrations.harness_conversation
             WHERE conversation_key = $1 AND tenant_id = $2""";

    // The key names the tenant, user and conversation, so a write that
    // disagrees with the row on any of them is a caller bug: it is refused
    // rather than storing one identity's memory under another's.
    private static final String UPSERT = """
            INSERT INTO miot_integrations.harness_conversation (
                conversation_key, tenant_id, user_id, conversation_id, model, memory
            ) VALUES ($1, $2, $3, $4, $5, $6::jsonb)
            ON CONFLICT (conversation_key) DO UPDATE
                SET model = EXCLUDED.model,
                    memory = EXCLUDED.memory,
                    updated_at = now()
                WHERE miot_integrations.harness_conversation.tenant_id = EXCLUDED.tenant_id
                  AND miot_integrations.harness_conversation.user_id IS NOT DISTINCT FROM EXCLUDED.user_id
                  AND miot_integrations.harness_conversation.conversation_id = EXCLUDED.conversation_id""";

    /** One stored conversation; {@code memory} is the harness's JSON document. */
    public record StoredConversation(
            String key,
            String tenantId,
            String userId,
            String conversationId,
            String model,
            String memory,
            OffsetDateTime updatedAt) {
    }

    private final Instance<Pool> clientInstance;

    @Inject
    public HarnessConversationRepository(Instance<Pool> clientInstance) {
        this.clientInstance = clientInstance;
    }

    public Optional<StoredConversation> find(String key, String tenantId) {
        Iterator<Row> rows = execute(FIND, Tuple.of(key, tenantId)).iterator();
        if (!rows.hasNext()) {
            return Optional.empty();
        }
        Row row = rows.next();
        return Optional.of(new StoredConversation(
                row.getString("conversation_key"),
                row.getString("tenant_id"),
                row.getString("user_id"),
                row.getString("conversation_id"),
                row.getString("model"),
                row.getString("memory"),
                row.getOffsetDateTime("updated_at")));
    }

    /** Returns false when the key already belongs to another tenant, user or conversation. */
    public boolean upsert(StoredConversation c) {
        Tuple params = Tuple.tuple()
                .addString(c.key())
                .addString(c.tenantId())
                .addString(c.userId())
                .addString(c.conversationId())
                .addString(c.model())
                .addString(c.memory());
        return execute(UPSERT, params).rowCount() > 0;
    }

    private RowSet<Row> execute(String sql, Tuple params) {
        Uni<RowSet<Row>> query = clientInstance.get().preparedQuery(sql).execute(params);
        return query.await().atMost(QUERY_TIMEOUT);
    }
}
