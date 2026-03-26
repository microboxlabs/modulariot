package com.microboxlabs.miot.resource.model;

import com.microboxlabs.miot.core.model.Tenant;
import io.quarkus.hibernate.reactive.panache.PanacheEntityBase;
import jakarta.persistence.Column;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.MappedSuperclass;
import jakarta.persistence.PrePersist;
import java.time.Instant;
import java.util.UUID;

@MappedSuperclass
public abstract class BaseResourceEntity extends PanacheEntityBase {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    public Long id;

    @ManyToOne
    public Tenant tenant;

    @Column(name = "client_id", nullable = false)
    public String clientId;

    @Column(name = "entity_id", nullable = false)
    public UUID entityId;

    @Column(name = "external_id", nullable = false)
    public String externalId;

    public String status = "ACTIVE";

    @Column(name = "alfresco_node_id")
    public String alfrescoNodeId;

    public boolean active = true;

    @Column(name = "created_at", nullable = false, updatable = false)
    public Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    public Instant updatedAt;

    @PrePersist
    void prePersist() {
        if (entityId == null) entityId = UUID.randomUUID();
        Instant now = Instant.now();
        if (createdAt == null) createdAt = now;
        updatedAt = now;
    }
}
