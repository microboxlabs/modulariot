package com.microboxlabs.miot.fleet.service;

import com.microboxlabs.miot.fleet.dto.CreateTruckRequest;
import com.microboxlabs.miot.fleet.model.Truck;
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
import java.util.List;
import java.util.Map;

@ApplicationScoped
public class TruckService {

    @Inject EntityEventService eventService;
    @Inject IAlfrescoClient alfrescoClient;

    @WithSession
    public Uni<List<Truck>> list(List<String> clientIds, int page, int size) {
        return Truck.find("clientId in ?1 and active = true", clientIds).page(Page.of(page, size)).list();
    }

    @WithSession
    public Uni<Long> count(List<String> clientIds) {
        return Truck.count("clientId in ?1 and active = true", clientIds);
    }

    @WithSession
    public Uni<Truck> findById(List<String> clientIds, Long id) {
        return Truck.find("id = ?1 and clientId in ?2", id, clientIds).firstResult();
    }

    @WithSession
    public Uni<Truck> findByExternalId(List<String> clientIds, String externalId) {
        return Truck.find("clientId in ?1 and externalId = ?2", clientIds, externalId).firstResult();
    }

    @WithTransaction
    public Uni<Truck> create(String clientId, CreateTruckRequest req, String actor) {
        Truck t = new Truck();
        t.clientId = clientId;
        t.externalId = req.externalId();
        t.licensePlate = req.licensePlate();
        t.vin = req.vin();
        t.brand = req.brand();
        t.model = req.model();
        t.year = req.year();
        t.maxWeight = req.maxWeight();
        t.volume = req.volume();
        t.truckType = req.truckType();

        return t.<Truck>persist()
                .flatMap(truck -> alfrescoClient.createEntityFolder(clientId, EntityType.TRUCK,
                                truck.entityId, Map.of("licensePlate", truck.licensePlate))
                        .map(nodeId -> { truck.alfrescoNodeId = nodeId; return truck; }))
                .flatMap(truck -> eventService.record(clientId, EntityType.TRUCK, truck.entityId,
                                EventTypes.ENTITY_CREATED, "api", actor,
                                JsonUtil.toJson(Map.of("externalId", truck.externalId)))
                        .replaceWith(truck));
    }

    @WithTransaction
    public Uni<Truck> changeStatus(List<String> clientIds, Long id, StatusChangeRequest req, String actor) {
        return Truck.<Truck>find("id = ?1 and clientId in ?2", id, clientIds).firstResult()
                .onItem().ifNull().failWith(() -> new IllegalArgumentException("Truck not found: " + id))
                .flatMap(truck -> {
                    String oldStatus = truck.status;
                    truck.status = req.status();
                    truck.updatedAt = Instant.now();
                    if ("INACTIVE".equals(req.status())) truck.active = false;
                    return eventService.record(truck.clientId, EntityType.TRUCK, truck.entityId,
                                    EventTypes.STATUS_CHANGED, "api", actor,
                                    JsonUtil.toJson(Map.of("old", oldStatus, "new", req.status())))
                            .replaceWith(truck);
                });
    }
}
