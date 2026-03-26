package com.microboxlabs.miot.resource.schedule;

import io.quarkus.hibernate.reactive.panache.PanacheEntityBase;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "rd_resource_schedules", schema = "miot_resource")
public class ResourceSchedule extends PanacheEntityBase {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    public Long id;

    @Column(name = "client_id", nullable = false)
    public String clientId;

    @Column(name = "resource_type", nullable = false)
    public String resourceType;

    @Column(name = "resource_id", nullable = false)
    public UUID resourceId;

    @Column(name = "available_from", nullable = false)
    public Instant availableFrom;

    @Column(name = "available_to")
    public Instant availableTo;

    public Integer capacity;

    @Column(name = "current_usage")
    public Integer currentUsage = 0;

    @Column(name = "created_at", nullable = false, updatable = false)
    public Instant createdAt;

    @PrePersist
    void prePersist() {
        if (createdAt == null) {
            createdAt = Instant.now();
        }
    }
}
