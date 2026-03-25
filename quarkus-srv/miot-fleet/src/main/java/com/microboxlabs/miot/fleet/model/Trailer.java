package com.microboxlabs.miot.fleet.model;

import com.microboxlabs.miot.core.model.Tenant;
import io.quarkus.hibernate.reactive.panache.PanacheEntityBase;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "rd_trailers", schema = "miot_fleet")
public class Trailer extends PanacheEntityBase {

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

    @Column(name = "license_plate", nullable = false)
    public String licensePlate;

    @Column(name = "trailer_type")
    public String trailerType;

    @Column(name = "max_weight")
    public BigDecimal maxWeight;

    @Column(name = "axle_count")
    public Integer axleCount;

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
