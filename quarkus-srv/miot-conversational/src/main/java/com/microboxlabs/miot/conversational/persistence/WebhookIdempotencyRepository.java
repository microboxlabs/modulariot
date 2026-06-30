package com.microboxlabs.miot.conversational.persistence;

import io.vertx.mutiny.sqlclient.Pool;
import io.vertx.mutiny.sqlclient.Tuple;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.inject.Instance;

/**
 * Dedup ledger for inbound Meta events. Meta delivers at-least-once, so every event is claimed
 * once by its {@code (source, external_id)} before it is processed; a retry of an already-claimed
 * event is a no-op. The {@code uq_wa_webhook_idempotency} unique constraint makes the claim
 * atomic via {@code ON CONFLICT DO NOTHING}.
 */
@ApplicationScoped
public class WebhookIdempotencyRepository {

    private static final String INSERT_ONCE = """
            INSERT INTO miot_conversational.wa_webhook_idempotency (source, external_id)
            VALUES ($1, $2)
            ON CONFLICT (source, external_id) DO NOTHING
            """;

    private final Instance<Pool> clientInstance;

    WebhookIdempotencyRepository(Instance<Pool> clientInstance) {
        this.clientInstance = clientInstance;
    }

    /**
     * Atomically claims an event the first time it is seen.
     *
     * @return {@code true} if this call recorded the event (process it now); {@code false} if it
     *         was already recorded (a duplicate/retry — skip)
     */
    public boolean recordOnce(String source, String externalId) {
        int inserted = clientInstance.get().preparedQuery(INSERT_ONCE)
                .execute(Tuple.of(source, externalId))
                .await().indefinitely()
                .rowCount();
        return inserted > 0;
    }
}
