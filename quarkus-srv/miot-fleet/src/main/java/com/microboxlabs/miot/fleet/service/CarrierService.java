package com.microboxlabs.miot.fleet.service;

import com.microboxlabs.miot.fleet.dto.CreateCarrierRequest;
import com.microboxlabs.miot.fleet.model.Carrier;
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
public class CarrierService {

    @Inject EntityEventService eventService;
    @Inject IAlfrescoClient alfrescoClient;

    @WithSession
    public Uni<List<Carrier>> list(String clientId, int page, int size) {
        return Carrier.find("clientId = ?1 and active = true", clientId).page(Page.of(page, size)).list();
    }

    @WithSession
    public Uni<Long> count(String clientId) {
        return Carrier.count("clientId = ?1 and active = true", clientId);
    }

    @WithSession
    public Uni<Carrier> findById(String clientId, Long id) {
        return Carrier.find("id = ?1 and clientId = ?2", id, clientId).firstResult();
    }

    @WithSession
    public Uni<Carrier> findByExternalId(String clientId, String externalId) {
        return Carrier.find("clientId = ?1 and externalId = ?2", clientId, externalId).firstResult();
    }

    @WithTransaction
    public Uni<Carrier> create(String clientId, CreateCarrierRequest req, String actor) {
        Carrier c = new Carrier();
        c.clientId = clientId;
        c.externalId = req.externalId();
        c.name = req.name();
        c.rut = req.rut();
        c.transportLicense = req.transportLicense();
        c.transportLicenseExpires = req.transportLicenseExpires() != null ? Instant.parse(req.transportLicenseExpires()) : null;

        return c.<Carrier>persist()
                .flatMap(carrier -> alfrescoClient.createEntityFolder(clientId, EntityType.CARRIER,
                                carrier.entityId, Map.of("name", carrier.name))
                        .map(nodeId -> { carrier.alfrescoNodeId = nodeId; return carrier; }))
                .flatMap(carrier -> eventService.record(clientId, EntityType.CARRIER, carrier.entityId,
                                EventTypes.ENTITY_CREATED, "api", actor,
                                JsonUtil.toJson(Map.of("externalId", carrier.externalId)))
                        .replaceWith(carrier));
    }

    @WithTransaction
    public Uni<Carrier> changeStatus(String clientId, Long id, StatusChangeRequest req, String actor) {
        return Carrier.<Carrier>find("id = ?1 and clientId = ?2", id, clientId).firstResult()
                .onItem().ifNull().failWith(() -> new IllegalArgumentException("Carrier not found: " + id))
                .flatMap(carrier -> {
                    String oldStatus = carrier.status;
                    carrier.status = req.status();
                    carrier.updatedAt = Instant.now();
                    if ("INACTIVE".equals(req.status())) carrier.active = false;
                    return eventService.record(clientId, EntityType.CARRIER, carrier.entityId,
                                    EventTypes.STATUS_CHANGED, "api", actor,
                                    JsonUtil.toJson(Map.of("old", oldStatus, "new", req.status())))
                            .replaceWith(carrier);
                });
    }
}
