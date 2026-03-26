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
    public Uni<List<Truck>> list(String clientId, int page, int size) {
        return Truck.find("clientId = ?1 and active = true", clientId).page(Page.of(page, size)).list();
    }

    @WithSession
    public Uni<Long> count(String clientId) {
        return Truck.count("clientId = ?1 and active = true", clientId);
    }

    @WithSession
    public Uni<Truck> findById(String clientId, Long id) {
        return Truck.find("id = ?1 and clientId = ?2", id, clientId).firstResult();
    }

    @WithSession
    public Uni<Truck> findByExternalId(String clientId, String externalId) {
        return Truck.find("clientId = ?1 and externalId = ?2", clientId, externalId).firstResult();
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
    public Uni<Truck> changeStatus(String clientId, Long id, StatusChangeRequest req, String actor) {
        return Truck.<Truck>find("id = ?1 and clientId = ?2", id, clientId).firstResult()
                .onItem().ifNull().failWith(() -> new IllegalArgumentException("Truck not found: " + id))
                .flatMap(truck -> {
                    String oldStatus = truck.status;
                    truck.status = req.status();
                    truck.updatedAt = Instant.now();
                    if ("DEACTIVATED".equals(req.status())) truck.active = false;
                    return eventService.record(clientId, EntityType.TRUCK, truck.entityId,
                                    EventTypes.STATUS_CHANGED, "api", actor,
                                    JsonUtil.toJson(Map.of("old", oldStatus, "new", req.status())))
                            .replaceWith(truck);
                });
    }
}
