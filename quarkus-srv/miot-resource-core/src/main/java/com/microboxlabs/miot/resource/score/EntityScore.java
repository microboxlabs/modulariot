package com.microboxlabs.miot.resource.score;

import com.microboxlabs.miot.resource.event.EntityType;
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
@Table(name = "rd_entity_scores", schema = "miot_resource")
public class EntityScore extends PanacheEntityBase {

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

    @Column(nullable = false)
    public String dimension;

    @Column(nullable = false)
    public Integer score;

    @Column(name = "snapshot_at", nullable = false)
    public Instant snapshotAt;

    @Column(name = "is_current", nullable = false)
    public boolean isCurrent = true;

    @Column(name = "created_at", nullable = false, updatable = false)
    public Instant createdAt;

    @PrePersist
    void prePersist() {
        if (createdAt == null) {
            createdAt = Instant.now();
        }
    }
}
