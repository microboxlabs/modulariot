package com.microboxlabs.miot.resource.sync;

import io.quarkus.hibernate.reactive.panache.common.WithSession;
import io.quarkus.hibernate.reactive.panache.common.WithTransaction;
import io.smallrye.mutiny.Uni;
import jakarta.enterprise.context.ApplicationScoped;
import java.time.Instant;

@ApplicationScoped
public class SyncCursorService {

    @WithSession
    public Uni<SyncCursor> get(String clientId, String sourceSystem, String entityType) {
        return SyncCursor.find("clientId = ?1 and sourceSystem = ?2 and entityType = ?3",
                clientId, sourceSystem, entityType).firstResult();
    }

    @WithTransaction
    public Uni<SyncCursor> advance(String clientId, String sourceSystem, String entityType,
                                   String cursorType, String cursorValue,
                                   Integer entitiesSynced, Integer errors) {
        return SyncCursor.<SyncCursor>find("clientId = ?1 and sourceSystem = ?2 and entityType = ?3",
                        clientId, sourceSystem, entityType).firstResult()
                .flatMap(existing -> {
                    if (existing != null) {
                        existing.cursorValue = cursorValue;
                        existing.lastSyncAt = Instant.now();
                        existing.entitiesSynced = entitiesSynced;
                        existing.errorsLastSync = errors != null ? errors : 0;
                        return Uni.createFrom().item(existing);
                    } else {
                        SyncCursor cursor = new SyncCursor();
                        cursor.clientId = clientId;
                        cursor.sourceSystem = sourceSystem;
                        cursor.entityType = entityType;
                        cursor.cursorType = cursorType;
                        cursor.cursorValue = cursorValue;
                        cursor.lastSyncAt = Instant.now();
                        cursor.entitiesSynced = entitiesSynced;
                        cursor.errorsLastSync = errors != null ? errors : 0;
                        return cursor.persist();
                    }
                });
    }
}
