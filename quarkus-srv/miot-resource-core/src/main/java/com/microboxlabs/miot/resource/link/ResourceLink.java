package com.microboxlabs.miot.resource.link;

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
@Table(name = "rd_resource_links", schema = "miot_resource")
public class ResourceLink extends PanacheEntityBase {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    public Long id;

    @Column(name = "client_id", nullable = false)
    public String clientId;

    @Column(name = "parent_type", nullable = false)
    public String parentType;

    @Column(name = "parent_id", nullable = false)
    public UUID parentId;

    @Column(name = "child_type", nullable = false)
    public String childType;

    @Column(name = "child_id", nullable = false)
    public UUID childId;

    @Column(name = "link_type", nullable = false)
    public String linkType;

    @Column(name = "valid_from")
    public Instant validFrom;

    @Column(name = "valid_to")
    public Instant validTo;

    @Column(name = "created_at", nullable = false, updatable = false)
    public Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    public Instant updatedAt;

    @PrePersist
    void prePersist() {
        Instant now = Instant.now();
        if (createdAt == null) {
            createdAt = now;
        }
        updatedAt = now;
    }
}
