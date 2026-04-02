package com.microboxlabs.miot.driver.service;

import com.microboxlabs.miot.driver.dto.CreateDriverRequest;
import com.microboxlabs.miot.driver.dto.UpdateDriverRequest;
import com.microboxlabs.miot.driver.model.Driver;
import com.microboxlabs.miot.resource.alfresco.IAlfrescoClient;
import com.microboxlabs.miot.resource.dto.StatusChangeRequest;
import com.microboxlabs.miot.resource.event.EntityEventService;
import com.microboxlabs.miot.resource.event.EntityType;
import com.microboxlabs.miot.resource.event.EventTypes;
import com.microboxlabs.miot.resource.util.JsonUtil;
import io.quarkus.hibernate.reactive.panache.common.WithSession;
import io.quarkus.hibernate.reactive.panache.common.WithTransaction;
import io.quarkus.panache.common.Page;
import io.smallrye.mutiny.Uni;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import java.time.Instant;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;

@ApplicationScoped
public class DriverService {

    @Inject EntityEventService eventService;
    @Inject IAlfrescoClient alfrescoClient;

    @WithSession
    public Uni<List<Driver>> list(List<String> clientIds, int page, int size) {
        return Driver.find("clientId in ?1 and active = true order by lastName, firstName", clientIds)
                .page(Page.of(page, size)).list();
    }

    @WithSession
    public Uni<Long> count(List<String> clientIds) {
        return Driver.count("clientId in ?1 and active = true", clientIds);
    }

    @WithSession
    public Uni<Driver> findById(List<String> clientIds, Long id) {
        return Driver.find("id = ?1 and clientId in ?2", id, clientIds).firstResult();
    }

    @WithSession
    public Uni<Driver> findByExternalId(List<String> clientIds, String externalId) {
        return Driver.find("clientId in ?1 and externalId = ?2", clientIds, externalId).firstResult();
    }

    @WithTransaction
    public Uni<Driver> create(String clientId, CreateDriverRequest req, String actor) {
        Driver d = new Driver();
        d.clientId = clientId;
        d.externalId = req.externalId();
        d.firstName = req.firstName();
        d.lastName = req.lastName();
        d.rut = req.rut();
        d.phone = req.phone();
        d.mobilePhone = req.mobilePhone();
        d.email = req.email();
        d.licenseNumber = req.licenseNumber();
        d.licenseCategory = req.licenseCategory();
        d.licenseExpires = req.licenseExpires() != null ? Instant.parse(req.licenseExpires()) : null;
        d.isOccasional = req.isOccasional();
        d.operationBlocked = req.operationBlocked();

        return d.<Driver>persist()
                .flatMap(driver -> alfrescoClient.createEntityFolder(clientId, EntityType.DRIVER,
                                driver.entityId, Map.of("firstName", driver.firstName, "lastName", driver.lastName))
                        .map(nodeId -> { driver.alfrescoNodeId = nodeId; return driver; }))
                .flatMap(driver -> eventService.record(clientId, EntityType.DRIVER, driver.entityId,
                                EventTypes.ENTITY_CREATED, "api", actor,
                                JsonUtil.toJson(Map.of("externalId", driver.externalId)))
                        .replaceWith(driver));
    }

    @WithTransaction
    public Uni<Driver> update(List<String> clientIds, Long id, UpdateDriverRequest req, String actor) {
        return Driver.<Driver>find("id = ?1 and clientId in ?2", id, clientIds).firstResult()
                .onItem().ifNull().failWith(() -> new IllegalArgumentException("Driver not found: " + id))
                .flatMap(driver -> {
                    Map<String, Object> changes = new HashMap<>();
                    diffField(changes, "firstName", driver.firstName, req.firstName(), v -> driver.firstName = v);
                    diffField(changes, "lastName", driver.lastName, req.lastName(), v -> driver.lastName = v);
                    diffField(changes, "rut", driver.rut, req.rut(), v -> driver.rut = v);
                    diffField(changes, "phone", driver.phone, req.phone(), v -> driver.phone = v);
                    diffField(changes, "mobilePhone", driver.mobilePhone, req.mobilePhone(), v -> driver.mobilePhone = v);
                    diffField(changes, "email", driver.email, req.email(), v -> driver.email = v);
                    diffField(changes, "licenseNumber", driver.licenseNumber, req.licenseNumber(), v -> driver.licenseNumber = v);
                    diffField(changes, "licenseCategory", driver.licenseCategory, req.licenseCategory(), v -> driver.licenseCategory = v);

                    if (req.isOccasional() != null && !Objects.equals(req.isOccasional(), driver.isOccasional)) {
                        changes.put("isOccasional", Map.of("old", driver.isOccasional, "new", req.isOccasional()));
                        driver.isOccasional = req.isOccasional();
                    }
                    if (req.operationBlocked() != null && !Objects.equals(req.operationBlocked(), driver.operationBlocked)) {
                        changes.put("operationBlocked", Map.of("old", driver.operationBlocked, "new", req.operationBlocked()));
                        driver.operationBlocked = req.operationBlocked();
                    }

                    driver.updatedAt = Instant.now();

                    if (changes.isEmpty()) {
                        return Uni.createFrom().item(driver);
                    }

                    Uni<Void> alfrescoUpdate = driver.alfrescoNodeId != null
                            ? alfrescoClient.updateEntityProperties(driver.alfrescoNodeId, changes)
                            : Uni.createFrom().voidItem();

                    return alfrescoUpdate
                            .flatMap(v -> eventService.record(driver.clientId, EntityType.DRIVER, driver.entityId,
                                    EventTypes.ENTITY_UPDATED, "api", actor,
                                    JsonUtil.toJson(Map.of("changes", changes))))
                            .replaceWith(driver);
                });
    }

    @WithTransaction
    public Uni<Driver> changeStatus(List<String> clientIds, Long id, StatusChangeRequest req, String actor) {
        return Driver.<Driver>find("id = ?1 and clientId in ?2", id, clientIds).firstResult()
                .onItem().ifNull().failWith(() -> new IllegalArgumentException("Driver not found: " + id))
                .flatMap(driver -> {
                    String oldStatus = driver.status;
                    driver.status = req.status();
                    driver.updatedAt = Instant.now();
                    if ("INACTIVE".equals(req.status())) {
                        driver.active = false;
                        driver.deactivatedAt = Instant.now();
                    }

                    return eventService.record(driver.clientId, EntityType.DRIVER, driver.entityId,
                                    EventTypes.STATUS_CHANGED, "api", actor,
                                    JsonUtil.toJson(Map.of("old", oldStatus, "new", req.status(),
                                            "reason", JsonUtil.nvl(req.reason()))))
                            .replaceWith(driver);
                });
    }

    private static void diffField(Map<String, Object> changes, String name, String current, String incoming,
            java.util.function.Consumer<String> setter) {
        if (incoming != null && !Objects.equals(incoming, current)) {
            changes.put(name, Map.of("old", JsonUtil.nvl(current), "new", incoming));
            setter.accept(incoming);
        }
    }
}
