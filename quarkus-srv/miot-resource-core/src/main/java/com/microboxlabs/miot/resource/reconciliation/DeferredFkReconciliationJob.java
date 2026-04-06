package com.microboxlabs.miot.resource.reconciliation;

import com.microboxlabs.miot.resource.event.EntityEvent;
import com.microboxlabs.miot.resource.event.EventTypes;
import com.microboxlabs.miot.resource.util.JsonUtil;
import io.quarkus.scheduler.Scheduled;
import io.smallrye.mutiny.Uni;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.inject.Instance;
import jakarta.inject.Inject;
import java.time.Instant;
import java.util.Map;
import org.eclipse.microprofile.config.inject.ConfigProperty;
import org.hibernate.reactive.mutiny.Mutiny;
import org.jboss.logging.Logger;

@ApplicationScoped
public class DeferredFkReconciliationJob {

    private static final Logger LOG = Logger.getLogger(DeferredFkReconciliationJob.class);

    @Inject
    Instance<Mutiny.SessionFactory> sessionFactoryInstance;

    @ConfigProperty(name = "quarkus.hibernate-orm.active", defaultValue = "true")
    boolean hibernateActive;

    @Scheduled(cron = "{miot.reconciliation.cron}", concurrentExecution = Scheduled.ConcurrentExecution.SKIP)
    public Uni<Void> reconcile() {
        if (!hibernateActive) {
            return Uni.createFrom().voidItem();
        }
        LOG.info("Running deferred FK reconciliation...");

        return sessionFactoryInstance.get().withTransaction(session ->
            // Find DEFERRED_FK events that have no matching FK_RESOLVED event for the same entity
            session.createNativeQuery(
                "SELECT e.* FROM miot_resource.rd_entity_events e " +
                "WHERE e.event_type = :deferred " +
                "AND NOT EXISTS (" +
                "  SELECT 1 FROM miot_resource.rd_entity_events r " +
                "  WHERE r.entity_type = e.entity_type " +
                "  AND r.entity_id = e.entity_id " +
                "  AND r.event_type = :resolved " +
                "  AND r.payload->>'field' = e.payload->>'field'" +
                ") LIMIT 100",
                EntityEvent.class)
                .setParameter("deferred", EventTypes.DEFERRED_FK)
                .setParameter("resolved", EventTypes.FK_RESOLVED)
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
        return resolveOne(session, events.get(index))
                .flatMap(v -> resolveEvents(session, events, index + 1));
    }

    private Uni<Void> resolveOne(Mutiny.Session session, EntityEvent event) {
        if (event.payload == null) return Uni.createFrom().voidItem();

        try {
            var node = new com.fasterxml.jackson.databind.ObjectMapper().readTree(event.payload);
            String field = node.has("field") ? node.get("field").asText() : null;
            String externalRef = node.has("external_ref") ? node.get("external_ref").asText() : null;
            String refType = node.has("ref_type") ? node.get("ref_type").asText() : null;

            if (field == null || externalRef == null || refType == null) {
                return Uni.createFrom().voidItem();
            }

            if ("CARRIER".equals(refType) && "carrier_id".equals(field)) {
                return session.createNativeQuery(
                        "SELECT id FROM miot_fleet.rd_carriers WHERE client_id = :clientId AND external_id = :externalId",
                        Long.class)
                    .setParameter("clientId", event.clientId)
                    .setParameter("externalId", externalRef)
                    .getSingleResultOrNull()
                    .flatMap(carrierId -> {
                        if (carrierId == null) return Uni.createFrom().voidItem();

                        LOG.infof("Resolved carrier FK: %s -> %d for entity %s", externalRef, carrierId, event.entityId);

                        return session.createNativeQuery(
                                "UPDATE miot_driver.rd_drivers SET carrier_id = :carrierId, updated_at = :now " +
                                "WHERE entity_id = :entityId AND client_id = :clientId")
                            .setParameter("carrierId", carrierId)
                            .setParameter("now", Instant.now())
                            .setParameter("entityId", event.entityId)
                            .setParameter("clientId", event.clientId)
                            .executeUpdate()
                            .flatMap(updated -> {
                                EntityEvent resolved = new EntityEvent();
                                resolved.clientId = event.clientId;
                                resolved.entityType = event.entityType;
                                resolved.entityId = event.entityId;
                                resolved.eventType = EventTypes.FK_RESOLVED;
                                resolved.eventSource = "reconciliation";
                                resolved.actor = "system";
                                resolved.payload = JsonUtil.toJson(Map.of(
                                        "field", "carrier_id",
                                        "external_ref", externalRef,
                                        "resolved_id", carrierId));
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
