package com.microboxlabs.miot.resource.event;

import io.quarkus.hibernate.reactive.panache.common.WithSession;
import io.quarkus.hibernate.reactive.panache.common.WithTransaction;
import io.smallrye.mutiny.Uni;
import jakarta.enterprise.context.ApplicationScoped;
import java.util.List;
import java.util.UUID;

@ApplicationScoped
public class EntityEventService {

    @WithTransaction
    public Uni<EntityEvent> record(String clientId, EntityType entityType, UUID entityId,
                                   String eventType, String eventSource, String actor,
                                   String payload) {
        EntityEvent ev = new EntityEvent();
        ev.clientId = clientId;
        ev.entityType = entityType;
        ev.entityId = entityId;
        ev.eventType = eventType;
        ev.eventSource = eventSource;
        ev.actor = actor;
        ev.payload = payload;
        return ev.persist();
    }

    @WithSession
    public Uni<List<EntityEvent>> listByEntity(EntityType entityType, UUID entityId, int limit) {
        return EntityEvent.find("entityType = ?1 and entityId = ?2 order by createdAt desc",
                entityType, entityId)
                .page(0, limit)
                .list();
    }

    @WithSession
    public Uni<List<EntityEvent>> listByClient(String clientId, EntityType entityType, int limit) {
        return EntityEvent.find("clientId = ?1 and entityType = ?2 order by createdAt desc",
                clientId, entityType)
                .page(0, limit)
                .list();
    }
}
