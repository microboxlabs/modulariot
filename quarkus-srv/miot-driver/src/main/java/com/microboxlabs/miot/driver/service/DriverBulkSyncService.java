package com.microboxlabs.miot.driver.service;

import com.microboxlabs.miot.driver.model.Driver;
import com.microboxlabs.miot.resource.alfresco.IAlfrescoClient;
import com.microboxlabs.miot.resource.dto.BulkSyncRequest;
import com.microboxlabs.miot.resource.dto.BulkSyncResponse;
import com.microboxlabs.miot.resource.dto.BulkSyncResponse.BulkSyncError;
import com.microboxlabs.miot.resource.event.EntityEventService;
import com.microboxlabs.miot.resource.event.EntityType;
import com.microboxlabs.miot.resource.event.EventTypes;
import com.microboxlabs.miot.resource.sync.SyncCursorService;
import com.microboxlabs.miot.resource.util.JsonUtil;
import io.quarkus.hibernate.reactive.panache.common.WithTransaction;
import io.smallrye.mutiny.Uni;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import java.time.Instant;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;
import org.eclipse.microprofile.config.inject.ConfigProperty;
import org.hibernate.reactive.mutiny.Mutiny;
import org.jboss.logging.Logger;

@ApplicationScoped
public class DriverBulkSyncService {

    private static final Logger LOG = Logger.getLogger(DriverBulkSyncService.class);

    @Inject EntityEventService eventService;
    @Inject IAlfrescoClient alfrescoClient;
    @Inject SyncCursorService cursorService;

    @Inject
    Mutiny.SessionFactory sessionFactory;

    @ConfigProperty(name = "miot.bulk-sync.max-batch-size", defaultValue = "1000")
    int maxBatchSize;

    @WithTransaction
    public Uni<BulkSyncResponse> process(String clientId, BulkSyncRequest request) {
        List<BulkSyncRequest.BulkSyncEntity> entities = request.entities();
        if (entities == null || entities.isEmpty()) {
            return Uni.createFrom().item(new BulkSyncResponse(0, 0, 0, List.of()));
        }
        if (entities.size() > maxBatchSize) {
            return Uni.createFrom().item(new BulkSyncResponse(0, 0, 0,
                    List.of(new BulkSyncError(null, "Batch size " + entities.size() + " exceeds max " + maxBatchSize))));
        }

        return processEntities(clientId, request.sourceSystem(), entities, 0,
                new int[]{0, 0, 0}, new ArrayList<>());
    }

    private Uni<BulkSyncResponse> processEntities(String clientId, String sourceSystem,
            List<BulkSyncRequest.BulkSyncEntity> entities, int index,
            int[] counters, List<BulkSyncError> errors) {
        if (index >= entities.size()) {
            return Uni.createFrom().item(new BulkSyncResponse(counters[0], counters[1], counters[2], errors));
        }

        BulkSyncRequest.BulkSyncEntity entity = entities.get(index);
        return processOneEntity(clientId, sourceSystem, entity)
                .map(result -> {
                    switch (result) {
                        case "created" -> counters[0]++;
                        case "updated" -> counters[1]++;
                        case "skipped" -> counters[2]++;
                    }
                    return result;
                })
                .onFailure().recoverWithItem(e -> {
                    errors.add(new BulkSyncError(entity.externalId(), e.getMessage()));
                    return "error";
                })
                .flatMap(r -> processEntities(clientId, sourceSystem, entities, index + 1, counters, errors));
    }

    private Uni<String> processOneEntity(String clientId, String sourceSystem,
            BulkSyncRequest.BulkSyncEntity entity) {
        String externalId = entity.externalId();
        if (externalId == null || externalId.isBlank()) {
            return Uni.createFrom().failure(new IllegalArgumentException("Missing externalId"));
        }

        Map<String, Object> fields = entity.fields() != null ? entity.fields() : Map.of();

        return Driver.<Driver>find("clientId = ?1 and externalId = ?2", clientId, externalId).firstResult()
                .flatMap(existing -> {
                    if (existing == null) {
                        return createFromSync(clientId, sourceSystem, externalId, fields, entity);
                    } else {
                        return updateFromSync(clientId, sourceSystem, existing, fields, entity);
                    }
                });
    }

    private Uni<String> createFromSync(String clientId, String sourceSystem, String externalId,
            Map<String, Object> fields, BulkSyncRequest.BulkSyncEntity entity) {
        Driver d = new Driver();
        d.clientId = clientId;
        d.externalId = externalId;
        d.firstName = strField(fields, "firstName", "");
        d.lastName = strField(fields, "lastName", "");
        d.rut = strField(fields, "rut", null);
        d.phone = strField(fields, "phone", null);
        d.mobilePhone = strField(fields, "mobilePhone", null);
        d.email = strField(fields, "email", null);
        d.licenseNumber = strField(fields, "licenseNumber", null);
        d.licenseCategory = strField(fields, "licenseCategory", null);
        d.isOccasional = boolField(fields, "isOccasional", false);
        d.operationBlocked = boolField(fields, "operationBlocked", false);
        d.addressStreet = strField(fields, "addressStreet", null);
        d.addressCity = strField(fields, "addressCity", null);
        d.addressPostalCode = strField(fields, "addressPostalCode", null);
        d.addressCountry = strField(fields, "addressCountry", null);
        d.sourceSystem = sourceSystem;

        // Derive status
        String deactivatedAt = strField(fields, "deactivatedAt", null);
        boolean blocked = boolField(fields, "operationBlocked", false);
        if (deactivatedAt != null && !deactivatedAt.isBlank()) {
            d.status = "INACTIVE";
            d.active = false;
            d.deactivatedAt = Instant.parse(deactivatedAt);
        } else if (blocked) {
            d.status = "SUSPENDED";
        }

        // Resolve carrier FK
        String carrierExternalId = strField(fields, "carrierExternalId", null);

        Uni<Driver> persisted = d.<Driver>persist();

        return persisted.flatMap(driver -> {
            Uni<Void> carrierResolution = resolveCarrier(clientId, driver, carrierExternalId);
            Uni<String> alfrescoSync = alfrescoClient.createEntityFolder(clientId, EntityType.DRIVER,
                            driver.entityId, fields)
                    .invoke(nodeId -> driver.alfrescoNodeId = nodeId);
            Uni<Void> eventWrite = eventService.record(clientId, EntityType.DRIVER, driver.entityId,
                    EventTypes.ENTITY_CREATED, sourceSystem, "bulk-sync",
                    JsonUtil.toJson(Map.of("externalId", externalId))).replaceWithVoid();

            return Uni.combine().all().unis(carrierResolution, alfrescoSync, eventWrite)
                    .discardItems()
                    .replaceWith("created");
        });
    }

    private Uni<String> updateFromSync(String clientId, String sourceSystem, Driver driver,
            Map<String, Object> fields, BulkSyncRequest.BulkSyncEntity entity) {
        Map<String, Object> changes = new HashMap<>();

        diffField(changes, "firstName", driver.firstName, strField(fields, "firstName", null), v -> driver.firstName = v);
        diffField(changes, "lastName", driver.lastName, strField(fields, "lastName", null), v -> driver.lastName = v);
        diffField(changes, "rut", driver.rut, strField(fields, "rut", null), v -> driver.rut = v);
        diffField(changes, "phone", driver.phone, strField(fields, "phone", null), v -> driver.phone = v);
        diffField(changes, "mobilePhone", driver.mobilePhone, strField(fields, "mobilePhone", null), v -> driver.mobilePhone = v);
        diffField(changes, "email", driver.email, strField(fields, "email", null), v -> driver.email = v);
        diffField(changes, "licenseNumber", driver.licenseNumber, strField(fields, "licenseNumber", null), v -> driver.licenseNumber = v);
        diffField(changes, "licenseCategory", driver.licenseCategory, strField(fields, "licenseCategory", null), v -> driver.licenseCategory = v);
        diffField(changes, "addressStreet", driver.addressStreet, strField(fields, "addressStreet", null), v -> driver.addressStreet = v);
        diffField(changes, "addressCity", driver.addressCity, strField(fields, "addressCity", null), v -> driver.addressCity = v);
        diffField(changes, "addressPostalCode", driver.addressPostalCode, strField(fields, "addressPostalCode", null), v -> driver.addressPostalCode = v);
        diffField(changes, "addressCountry", driver.addressCountry, strField(fields, "addressCountry", null), v -> driver.addressCountry = v);

        // Derive status from deactivatedAt and operationBlocked
        String deactivatedAt = strField(fields, "deactivatedAt", null);
        if (deactivatedAt != null && !deactivatedAt.isBlank() && !"INACTIVE".equals(driver.status)) {
            changes.put("status", Map.of("old", driver.status, "new", "INACTIVE"));
            driver.status = "INACTIVE";
            driver.active = false;
            driver.deactivatedAt = Instant.parse(deactivatedAt);
        }

        Boolean isOccasional = boolFieldNullable(fields, "isOccasional");
        if (isOccasional != null && !Objects.equals(isOccasional, driver.isOccasional)) {
            changes.put("isOccasional", Map.of("old", driver.isOccasional, "new", isOccasional));
            driver.isOccasional = isOccasional;
        }
        Boolean operationBlocked = boolFieldNullable(fields, "operationBlocked");
        if (operationBlocked != null && !Objects.equals(operationBlocked, driver.operationBlocked)) {
            changes.put("operationBlocked", Map.of("old", driver.operationBlocked, "new", operationBlocked));
            driver.operationBlocked = operationBlocked;
        }

        if (changes.isEmpty()) {
            return Uni.createFrom().item("skipped");
        }

        driver.updatedAt = Instant.now();

        // Resolve carrier FK if provided
        String carrierExternalId = strField(fields, "carrierExternalId", null);
        Uni<Void> carrierResolution = resolveCarrier(clientId, driver, carrierExternalId);

        return carrierResolution
                .flatMap(v -> alfrescoClient.updateEntityProperties(driver.alfrescoNodeId, changes))
                .flatMap(v -> eventService.record(clientId, EntityType.DRIVER, driver.entityId,
                        EventTypes.ENTITY_UPDATED, sourceSystem, "bulk-sync",
                        JsonUtil.toJson(Map.of("changes", changes))))
                .replaceWith("updated");
    }

    private Uni<Void> resolveCarrier(String clientId, Driver driver, String carrierExternalId) {
        if (carrierExternalId == null || carrierExternalId.isBlank()) {
            return Uni.createFrom().voidItem();
        }

        // Use native query to avoid cross-module dependency on miot-fleet
        return sessionFactory.withSession(session ->
            session.createNativeQuery(
                    "SELECT id FROM miot_fleet.rd_carriers WHERE client_id = :clientId AND external_id = :externalId",
                    Long.class)
                .setParameter("clientId", clientId)
                .setParameter("externalId", carrierExternalId)
                .getSingleResultOrNull()
        ).flatMap(carrierId -> {
            if (carrierId != null) {
                driver.carrierId = carrierId;
                return Uni.createFrom().voidItem();
            } else {
                // Deferred FK resolution
                return eventService.record(clientId, EntityType.DRIVER, driver.entityId,
                                EventTypes.DEFERRED_FK, "bulk-sync", "system",
                                JsonUtil.toJson(Map.of("field", "carrier_id", "external_ref", carrierExternalId, "ref_type", "CARRIER")))
                        .replaceWithVoid();
            }
        });
    }

    private void diffField(Map<String, Object> changes, String name, String current, String incoming,
            java.util.function.Consumer<String> setter) {
        if (incoming != null && !Objects.equals(incoming, current)) {
            changes.put(name, Map.of("old", current != null ? current : "", "new", incoming));
            setter.accept(incoming);
        }
    }

    private static String strField(Map<String, Object> fields, String key, String defaultValue) {
        Object val = fields.get(key);
        return val != null ? val.toString() : defaultValue;
    }

    private static boolean boolField(Map<String, Object> fields, String key, boolean defaultValue) {
        Object val = fields.get(key);
        if (val instanceof Boolean b) return b;
        if (val != null) return Boolean.parseBoolean(val.toString());
        return defaultValue;
    }

    private static Boolean boolFieldNullable(Map<String, Object> fields, String key) {
        Object val = fields.get(key);
        if (val instanceof Boolean b) return b;
        if (val != null) return Boolean.parseBoolean(val.toString());
        return null;
    }

}
