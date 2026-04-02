package com.microboxlabs.miot.fleet.service;

import com.microboxlabs.miot.fleet.dto.CreateTrailerRequest;
import com.microboxlabs.miot.fleet.model.Trailer;
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
public class TrailerService {

    @Inject EntityEventService eventService;
    @Inject IAlfrescoClient alfrescoClient;

    @WithSession
    public Uni<List<Trailer>> list(List<String> clientIds, int page, int size) {
        return Trailer.find("clientId in ?1 and active = true", clientIds).page(Page.of(page, size)).list();
    }

    @WithSession
    public Uni<Long> count(List<String> clientIds) {
        return Trailer.count("clientId in ?1 and active = true", clientIds);
    }

    @WithSession
    public Uni<Trailer> findById(List<String> clientIds, Long id) {
        return Trailer.find("id = ?1 and clientId in ?2", id, clientIds).firstResult();
    }

    @WithSession
    public Uni<Trailer> findByExternalId(List<String> clientIds, String externalId) {
        return Trailer.find("clientId in ?1 and externalId = ?2", clientIds, externalId).firstResult();
    }

    @WithTransaction
    public Uni<Trailer> create(String clientId, CreateTrailerRequest req, String actor) {
        Trailer t = new Trailer();
        t.clientId = clientId;
        t.externalId = req.externalId();
        t.licensePlate = req.licensePlate();
        t.trailerType = req.trailerType();
        t.maxWeight = req.maxWeight();
        t.axleCount = req.axleCount();

        return t.<Trailer>persist()
                .flatMap(trailer -> alfrescoClient.createEntityFolder(clientId, EntityType.TRAILER,
                                trailer.entityId, Map.of("licensePlate", trailer.licensePlate))
                        .map(nodeId -> { trailer.alfrescoNodeId = nodeId; return trailer; }))
                .flatMap(trailer -> eventService.record(clientId, EntityType.TRAILER, trailer.entityId,
                                EventTypes.ENTITY_CREATED, "api", actor,
                                JsonUtil.toJson(Map.of("externalId", trailer.externalId)))
                        .replaceWith(trailer));
    }

    @WithTransaction
    public Uni<Trailer> changeStatus(List<String> clientIds, Long id, StatusChangeRequest req, String actor) {
        return Trailer.<Trailer>find("id = ?1 and clientId in ?2", id, clientIds).firstResult()
                .onItem().ifNull().failWith(() -> new IllegalArgumentException("Trailer not found: " + id))
                .flatMap(trailer -> {
                    String oldStatus = trailer.status;
                    trailer.status = req.status();
                    trailer.updatedAt = Instant.now();
                    if ("INACTIVE".equals(req.status())) trailer.active = false;
                    return eventService.record(trailer.clientId, EntityType.TRAILER, trailer.entityId,
                                    EventTypes.STATUS_CHANGED, "api", actor,
                                    JsonUtil.toJson(Map.of("old", oldStatus, "new", req.status())))
                            .replaceWith(trailer);
                });
    }
}
