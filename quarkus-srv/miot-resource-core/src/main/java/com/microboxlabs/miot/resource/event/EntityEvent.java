package com.microboxlabs.miot.resource.event;

import io.quarkus.hibernate.reactive.panache.PanacheEntityBase;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "rd_entity_events", schema = "miot_resource")
public class EntityEvent extends PanacheEntityBase {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    public Long id;

    @Column(name = "client_id", nullable = false)
    public String clientId;

    @Column(name = "entity_type", nullable = false)
    @Enumerated(EnumType.STRING)
    public EntityType entityType;

    @Column(name = "entity_id", nullable = false)
    public UUID entityId;

    @Column(name = "event_type", nullable = false)
    public String eventType;

    @Column(name = "event_source", nullable = false)
    public String eventSource;

    public String actor;

    @Column(columnDefinition = "jsonb")
    public String payload;

    @Column(columnDefinition = "jsonb")
    public String metadata;

    @Column(name = "created_at", nullable = false, updatable = false)
    public Instant createdAt;

    @PrePersist
    void prePersist() {
        if (createdAt == null) {
            createdAt = Instant.now();
        }
    }
}
