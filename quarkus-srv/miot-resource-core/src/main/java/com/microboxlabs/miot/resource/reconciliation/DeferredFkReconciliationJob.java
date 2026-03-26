package com.microboxlabs.miot.resource.reconciliation;

import com.microboxlabs.miot.resource.event.EntityEvent;
import com.microboxlabs.miot.resource.event.EntityEventService;
import com.microboxlabs.miot.resource.event.EntityType;
import io.quarkus.hibernate.reactive.panache.common.WithSession;
import io.quarkus.hibernate.reactive.panache.common.WithTransaction;
import io.quarkus.scheduler.Scheduled;
import io.smallrye.mutiny.Uni;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import org.hibernate.reactive.mutiny.Mutiny;
import org.jboss.logging.Logger;

@ApplicationScoped
public class DeferredFkReconciliationJob {

    private static final Logger LOG = Logger.getLogger(DeferredFkReconciliationJob.class);

    @Inject
    EntityEventService eventService;

    @Inject
    Mutiny.SessionFactory sessionFactory;

    @Scheduled(cron = "{miot.reconciliation.cron}", concurrentExecution = Scheduled.ConcurrentExecution.SKIP)
    public Uni<Void> reconcile() {
        LOG.info("Running deferred FK reconciliation...");

        return sessionFactory.withTransaction(session ->
            // Find all unresolved DEFERRED_FK events (no corresponding FK_RESOLVED event)
            session.createQuery(
                "FROM EntityEvent e WHERE e.eventType = 'DEFERRED_FK' " +
                "AND NOT EXISTS (SELECT 1 FROM EntityEvent r WHERE r.entityType = e.entityType " +
                "AND r.entityId = e.entityId AND r.eventType = 'FK_RESOLVED' " +
                "AND r.payload LIKE CONCAT('%', CAST(FUNCTION('jsonb_extract_path_text', e.payload, 'external_ref') AS string), '%'))",
                EntityEvent.class)
                .setMaxResults(100)
                .getResultList()
                .flatMap(events -> {
                    if (events.isEmpty()) {
                        LOG.info("No deferred FKs to reconcile");
                        return Uni.createFrom().voidItem();
                    }

                    LOG.infof("Found %d deferred FK(s) to reconcile", events.size());

                    return resolveEvents(session, events, 0);
                })
        );
    }

    private Uni<Void> resolveEvents(Mutiny.Session session, java.util.List<EntityEvent> events, int index) {
        if (index >= events.size()) {
            return Uni.createFrom().voidItem();
        }

        EntityEvent event = events.get(index);
        return resolveOne(session, event)
                .flatMap(v -> resolveEvents(session, events, index + 1));
    }

    private Uni<Void> resolveOne(Mutiny.Session session, EntityEvent event) {
        // Parse the deferred FK payload to get the external reference
        String payload = event.payload;
        if (payload == null) return Uni.createFrom().voidItem();

        try {
            var mapper = new com.fasterxml.jackson.databind.ObjectMapper();
            var node = mapper.readTree(payload);
            String field = node.has("field") ? node.get("field").asText() : null;
            String externalRef = node.has("external_ref") ? node.get("external_ref").asText() : null;
            String refType = node.has("ref_type") ? node.get("ref_type").asText() : null;

            if (field == null || externalRef == null || refType == null) {
                return Uni.createFrom().voidItem();
            }

            if ("CARRIER".equals(refType) && "carrier_id".equals(field)) {
                // Try to resolve carrier
                return session.createQuery(
                        "SELECT c.id FROM Carrier c WHERE c.clientId = :clientId AND c.externalId = :externalId",
                                Long.class)
                        .setParameter("clientId", event.clientId)
                        .setParameter("externalId", externalRef)
                        .getSingleResultOrNull()
                        .flatMap(carrierId -> {
                            if (carrierId == null) {
                                return Uni.createFrom().voidItem(); // Still unresolved
                            }

                            LOG.infof("Resolved carrier FK: %s -> %d for entity %s", externalRef, carrierId, event.entityId);

                            // Update the driver's carrier_id
                            return session.createQuery(
                                    "UPDATE Driver d SET d.carrierId = :carrierId, d.updatedAt = CURRENT_TIMESTAMP " +
                                    "WHERE d.entityId = :entityId AND d.clientId = :clientId")
                                    .setParameter("carrierId", carrierId)
                                    .setParameter("entityId", event.entityId)
                                    .setParameter("clientId", event.clientId)
                                    .executeUpdate()
                                    .flatMap(updated -> {
                                        // Write FK_RESOLVED event
                                        EntityEvent resolved = new EntityEvent();
                                        resolved.clientId = event.clientId;
                                        resolved.entityType = event.entityType;
                                        resolved.entityId = event.entityId;
                                        resolved.eventType = "FK_RESOLVED";
                                        resolved.eventSource = "reconciliation";
                                        resolved.actor = "system";
                                        resolved.payload = "{\"field\":\"carrier_id\",\"external_ref\":\"" + externalRef +
                                                "\",\"resolved_id\":" + carrierId + "}";
                                        return session.persist(resolved);
                                    });
                        });
            }

            return Uni.createFrom().voidItem();
        } catch (Exception e) {
            LOG.warnf("Failed to parse deferred FK event %d: %s", event.id, e.getMessage());
            return Uni.createFrom().voidItem();
        }
    }
}
